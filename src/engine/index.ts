import {
  DiagnosticReport,
  NormalizedTrajectory,
  TherapyOptions,
  TherapyResult,
  Trajectory,
} from '../types/index.js';
import {
  estimateMessageTokens,
  estimateTrajectoryTokens,
  normalizeTrajectory,
} from './normalization.js';
import { DiagnosticPipeline } from './diagnostics/index.js';
import { TherapyPipeline } from './therapy/index.js';
import { scrubText, sanitizeReframingText } from './security/scrubber.js';

// Singleton pipeline instances
const diagnosticPipeline = new DiagnosticPipeline();
const therapyPipeline = new TherapyPipeline(diagnosticPipeline);

/**
 * Diagnoses an agent's conversation trajectory across the 5 clinical pathology axes:
 * 1. OCD Looping
 * 2. Goal Drift
 * 3. Context Exhaustion (Brain Fog)
 * 4. Hallucination Cascades
 * 5. Sycophancy Spirals
 *
 * Accepts either structured TrajectoryInput ({ system_prompt, messages, metadata })
 * or raw Message[] for ergonomic 1-line integration.
 */
export function diagnoseTrajectory(
  trajectory: Trajectory,
  agentId?: string
): DiagnosticReport {
  const normalized = normalizeTrajectory(trajectory);
  return diagnosticPipeline.run(normalized, agentId);
}

/**
 * Cures an agent's conversation trajectory through composable therapy passes:
 * - OCD loop pruning + Epistemic Marker injection (Anti-Amnesia mandate)
 * - Atomic tool_call / tool response pair preservation
 * - Context de-fragmentation for 50k+ noisy log dumps
 * - 3-step CBT Cognitive Reframing encapsulated in <agent_clinic_reframing> tags
 * - Automated credential and PII scrubbing
 */
export function cureTrajectory(
  trajectory: Trajectory,
  options: TherapyOptions = {}
): TherapyResult {
  const normalized = normalizeTrajectory(trajectory);
  const report = diagnosticPipeline.run(normalized, options.agent_id);
  return therapyPipeline.run(normalized, report, options);
}

export {
  normalizeTrajectory,
  estimateTrajectoryTokens,
  estimateMessageTokens,
  scrubText,
  sanitizeReframingText,
  diagnosticPipeline,
  therapyPipeline,
};

export * from '../types/index.js';
