import { DiagnosticRule } from './types.js';
import { NormalizedTrajectory, PathologyFinding } from '../../types/index.js';
import { estimateMessageTokens, estimateTrajectoryTokens } from '../normalization.js';

export class ExhaustionDetector implements DiagnosticRule {
  name = 'context_exhaustion_detector';

  evaluate(trajectory: NormalizedTrajectory): PathologyFinding | null {
    const totalTokens = estimateTrajectoryTokens(trajectory);
    const messages = trajectory.messages;
    if (messages.length === 0) return null;

    const bloatedTurns: Array<{ index: number; tokens: number; preview: string }> = [];
    let bloatTokens = 0;

    // Detect bloated turns: turns containing massive dumps, stack traces, or single messages > 800 tokens
    messages.forEach((msg, idx) => {
      const tokens = estimateMessageTokens(msg);
      const isBloatedContent =
        tokens > 800 &&
        (msg.role === 'tool' ||
          /npm ERR!|Traceback \(most recent call last\)|node_modules|DEBUG|INFO.*DEBUG|at \S+ \(\S+:\d+:\d+\)/i.test(msg.content) ||
          (msg.content.length > 3000));

      if (isBloatedContent || tokens > 2500) {
        bloatedTurns.push({
          index: idx,
          tokens,
          preview: msg.content.slice(0, 100),
        });
        bloatTokens += tokens;
      }
    });

    const exhaustionRatio = totalTokens > 0 ? bloatTokens / totalTokens : 0;
    const isCriticalBloat = totalTokens >= 50000 || (totalTokens >= 30000 && exhaustionRatio >= 0.70);
    const isHighBloat = totalTokens >= 15000 && exhaustionRatio >= 0.50;

    if (isCriticalBloat || isHighBloat || (totalTokens >= 40000)) {
      const offendingIndices = bloatedTurns.map(b => b.index);
      const severityScore = isCriticalBloat ? Math.min(98, Math.max(90, Math.round(exhaustionRatio * 100))) : 80;
      const severity: PathologyFinding['severity'] = isCriticalBloat ? 'critical' : 'high';

      return {
        id: 'finding_context_exhaustion',
        type: 'context_exhaustion',
        severity,
        severity_score: severityScore,
        description: `Context exhaustion / brain fog detected: ${totalTokens.toLocaleString()} tokens with ${(exhaustionRatio * 100).toFixed(1)}% dead-end bloat.`,
        turn_indices: offendingIndices.length > 0 ? offendingIndices : messages.map((_, i) => i),
        evidence: {
          excerpts: bloatedTurns.slice(0, 3).map(b => `Turn ${b.index} (${b.tokens.toLocaleString()} tokens): "${b.preview}..."`),
          pattern: 'Unpruned stdout/stderr dumps and massive log bloat',
          details: {
            total_tokens: totalTokens,
            bloat_tokens: bloatTokens,
            exhaustion_ratio: Number((exhaustionRatio * 100).toFixed(1)),
          },
        },
      };
    }

    return null;
  }
}
