import { z } from 'zod';

// ==========================================
// 1. Core Message & Trajectory Interfaces
// ==========================================

export interface ToolCall {
  id: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface TrajectoryInput {
  system_prompt?: string;
  messages?: Message[];
  metadata?: Record<string, any>;
}

// Loose trajectory input: either structured TrajectoryInput or raw Message[]
export type Trajectory = TrajectoryInput | Message[];

export interface NormalizedTrajectory {
  system_prompt?: string;
  messages: Message[];
  metadata?: Record<string, any>;
}

// ==========================================
// 2. Clinical Diagnostic Taxonomy
// ==========================================

export type PathologyType =
  | 'ocd_loop'
  | 'hallucination_cascade'
  | 'goal_drift'
  | 'context_exhaustion'
  | 'sycophancy_spiral';

export type PathologySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PathologyFinding {
  id: string;
  type: PathologyType;
  severity: PathologySeverity;
  severity_score: number; // 0 - 100
  description: string;
  turn_indices: number[]; // Offending message indices in normalized trajectory
  evidence: {
    excerpts?: string[];
    pattern?: string;
    repetition_count?: number;
    details?: Record<string, any>;
  };
}

export interface DiagnosticMetrics {
  total_turns: number;
  total_estimated_tokens: number;
  repetition_ratio: number; // 0.0 - 1.0
  hallucination_risk_score: number; // 0 - 100
  drift_score: number; // 0 - 100
  exhaustion_ratio: number; // 0 - 100
  sycophancy_score: number; // 0 - 100
}

export type RecommendedTherapy =
  | 'cognitive_reframing'
  | 'context_pruning'
  | 'hallucination_grounding'
  | 'trajectory_reanchoring'
  | 'epistemic_marking';

export interface DiagnosticReport {
  agent_id?: string;
  healthy: boolean;
  overall_health_score: number; // 0 - 100 (100 = clean, <60 = therapy needed)
  pathologies: PathologyFinding[];
  metrics: DiagnosticMetrics;
  recommended_therapies: RecommendedTherapy[];
  clinical_notes: string[];
  timestamp: string;
}

// ==========================================
// 3. Therapy & Rehabilitation Contracts
// ==========================================

export interface AppliedIntervention {
  type: string;
  description: string;
  tokens_saved: number;
  turns_pruned: number;
  epistemic_markers_added?: number;
}

export interface ClinicalCertificate {
  id: string;
  certified_clean: boolean;
  hash: string;
  health_score: number;
  issued_at: string;
}

export interface TherapyResult {
  original_report: DiagnosticReport;
  cured_trajectory: NormalizedTrajectory;
  interventions_applied: AppliedIntervention[];
  cognitive_reframing_prompt: string; // Structured <agent_clinic_reframing> prompt
  new_health_score: number; // 0 - 100
  tokens_saved: number;
  estimated_cost_saved_usd: number;
  summary: string;
  clinical_notes: string[];
  certificate?: ClinicalCertificate;
}

export interface TherapyOptions {
  agent_id?: string;
  target_token_budget?: number;
  treatments?: string[];
  preserve_system_prompt?: boolean; // Always defaults to true (Immutable Guardrail)
  max_prune_ratio?: number; // Defaults to 0.70
  scrub_secrets?: boolean; // Defaults to true
}

// ==========================================
// 4. Zod Schemas & Validation Boundaries
// ==========================================

// Enforcing Council Seat 2 (Security) bounds:
// - Max 500 messages
// - Max 2MB content string size
const MAX_MESSAGE_CONTENT_LENGTH = 2 * 1024 * 1024; // 2MB
export const MAX_TRAJECTORY_MESSAGES = 500;

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function').optional(),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([
    z.string().max(MAX_MESSAGE_CONTENT_LENGTH),
    z.any().transform(val => (typeof val === 'string' ? val : JSON.stringify(val))),
  ]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
});

export const TrajectoryInputSchema = z.object({
  system_prompt: z.string().max(MAX_MESSAGE_CONTENT_LENGTH).optional(),
  messages: z.array(MessageSchema).max(MAX_TRAJECTORY_MESSAGES).optional(),
  metadata: z.record(z.any()).optional(),
});

export const TrajectorySchema = z.union([
  TrajectoryInputSchema,
  z.array(MessageSchema).max(MAX_TRAJECTORY_MESSAGES),
]);

export const TriageRequestSchema = z.object({
  agent_id: z.string().optional(),
  trajectory: TrajectorySchema,
  symptoms: z.array(z.string()).optional(),
});

export const TherapyRequestSchema = z.object({
  agent_id: z.string().optional(),
  trajectory: TrajectorySchema,
  treatments: z.array(z.string()).optional(),
  target_token_budget: z.number().positive().optional(),
  scrub_secrets: z.boolean().optional(),
});
