import {
  DiagnosticReport,
  Message,
  NormalizedTrajectory,
  TherapyOptions,
} from '../../types/index.js';

export interface TherapyContext {
  trajectory: NormalizedTrajectory;
  report: DiagnosticReport;
  options: TherapyOptions;
  appliedInterventions: Array<{
    type: string;
    description: string;
    tokens_saved: number;
    turns_pruned: number;
    epistemic_markers_added?: number;
  }>;
  clinicalNotes: string[];
}

export interface TherapyPass {
  name: string;
  apply(context: TherapyContext): void;
}
