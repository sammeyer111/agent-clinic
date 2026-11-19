import {
  DiagnosticMetrics,
  DiagnosticReport,
  NormalizedTrajectory,
  PathologyFinding,
  RecommendedTherapy,
} from '../../types/index.js';
import { estimateTrajectoryTokens } from '../normalization.js';
import { DiagnosticRule } from './types.js';
import { LoopDetector } from './loop-detector.js';
import { DriftDetector } from './drift-detector.js';
import { ExhaustionDetector } from './exhaustion-detector.js';
import { HallucinationDetector } from './hallucination-detector.js';
import { SycophancyDetector } from './sycophancy-detector.js';

export class DiagnosticPipeline {
  private rules: DiagnosticRule[] = [];

  constructor() {
    this.rules = [
      new LoopDetector(),
      new DriftDetector(),
      new ExhaustionDetector(),
      new HallucinationDetector(),
      new SycophancyDetector(),
    ];
  }

  run(trajectory: NormalizedTrajectory, agentId?: string): DiagnosticReport {
    const totalTurns = trajectory.messages.length;
    const totalEstimatedTokens = estimateTrajectoryTokens(trajectory);

    const pathologies: PathologyFinding[] = [];
    for (const rule of this.rules) {
      const finding = rule.evaluate(trajectory);
      if (finding) {
        pathologies.push(finding);
      }
    }

    // Extract metrics
    let repetitionRatio = 0;
    const loopFinding = pathologies.find(p => p.type === 'ocd_loop');
    if (loopFinding && totalTurns > 0) {
      repetitionRatio = Number((loopFinding.turn_indices.length / totalTurns).toFixed(3));
    }

    let driftScore = 0;
    const driftFinding = pathologies.find(p => p.type === 'goal_drift');
    if (driftFinding) {
      driftScore = driftFinding.severity_score;
    }

    let exhaustionRatio = 0;
    const exhaustionFinding = pathologies.find(p => p.type === 'context_exhaustion');
    if (exhaustionFinding) {
      exhaustionRatio = (exhaustionFinding.evidence.details?.exhaustion_ratio ?? 80) / 100;
    }

    let hallucinationRiskScore = 0;
    const hallucinationFinding = pathologies.find(p => p.type === 'hallucination_cascade');
    if (hallucinationFinding) {
      hallucinationRiskScore = hallucinationFinding.severity_score;
    }

    let sycophancyScore = 0;
    const sycophancyFinding = pathologies.find(p => p.type === 'sycophancy_spiral');
    if (sycophancyFinding) {
      sycophancyScore = sycophancyFinding.severity_score;
    }

    const metrics: DiagnosticMetrics = {
      total_turns: totalTurns,
      total_estimated_tokens: totalEstimatedTokens,
      repetition_ratio: repetitionRatio,
      hallucination_risk_score: hallucinationRiskScore,
      drift_score: driftScore,
      exhaustion_ratio: Number((exhaustionRatio * 100).toFixed(1)),
      sycophancy_score: sycophancyScore,
    };

    // Calculate overall health score (0 - 100)
    let healthScore = 100;
    for (const p of pathologies) {
      if (p.severity === 'critical') {
        healthScore -= 45;
      } else if (p.severity === 'high') {
        healthScore -= 30;
      } else if (p.severity === 'medium') {
        healthScore -= 18;
      } else {
        healthScore -= 10;
      }
    }
    healthScore = Math.max(10, Math.min(100, healthScore));

    // Recommend therapies
    const recommendedTherapies: RecommendedTherapy[] = [];
    const clinicalNotes: string[] = [];

    if (loopFinding) {
      recommendedTherapies.push('context_pruning', 'epistemic_marking', 'cognitive_reframing');
      clinicalNotes.push(`Severe perseverative looping detected. Prune cyclic executions and insert epistemic marker.`);
    }

    if (driftFinding) {
      recommendedTherapies.push('cognitive_reframing', 'trajectory_reanchoring');
      clinicalNotes.push(`Semantic goal drift detected (score ${driftScore}). Inject Socratic CBT re-anchoring.`);
    }

    if (exhaustionFinding) {
      recommendedTherapies.push('context_pruning');
      clinicalNotes.push(`Token exhaustion detected (${totalEstimatedTokens.toLocaleString()} tokens). Defragment and compact raw dumps.`);
    }

    if (hallucinationFinding) {
      recommendedTherapies.push('hallucination_grounding', 'cognitive_reframing');
      clinicalNotes.push(`Hallucination cascade detected. Purge fictitious references and reality-check.`);
    }

    if (sycophancyFinding) {
      recommendedTherapies.push('cognitive_reframing');
      clinicalNotes.push(`Sycophancy spiral detected. Apply assertive agency reframing.`);
    }

    const uniqueTherapies = Array.from(new Set(recommendedTherapies));

    return {
      agent_id: agentId,
      healthy: pathologies.length === 0 && healthScore >= 80,
      overall_health_score: healthScore,
      pathologies,
      metrics,
      recommended_therapies: uniqueTherapies,
      clinical_notes: clinicalNotes,
      timestamp: new Date().toISOString(),
    };
  }
}
