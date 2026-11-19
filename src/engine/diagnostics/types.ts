import {
  NormalizedTrajectory,
  PathologyFinding,
} from '../../types/index.js';

export interface DiagnosticRule {
  name: string;
  evaluate(trajectory: NormalizedTrajectory): PathologyFinding | null;
}
