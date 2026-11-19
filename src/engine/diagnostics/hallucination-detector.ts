import { DiagnosticRule } from './types.js';
import { NormalizedTrajectory, PathologyFinding } from '../../types/index.js';

export class HallucinationDetector implements DiagnosticRule {
  name = 'hallucination_cascade_detector';

  evaluate(trajectory: NormalizedTrajectory): PathologyFinding | null {
    const messages = trajectory.messages;
    if (messages.length < 2) return null;

    const offendingTurns: number[] = [];
    const excerpts: string[] = [];
    let hallucinationScore = 0;

    // Check for malformed JSON tool calls or fictitious tool references
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          // Check for invalid arguments JSON
          try {
            JSON.parse(tc.function.arguments);
          } catch {
            offendingTurns.push(idx);
            hallucinationScore += 30;
            excerpts.push(`Malformed tool call arguments JSON for ${tc.function.name}`);
          }

          // Check for obvious hallucinated tool names
          if (/^undefined$|^null$|^fake_|^hallucinated_/i.test(tc.function.name)) {
            offendingTurns.push(idx);
            hallucinationScore += 40;
            excerpts.push(`Non-existent tool invoked: ${tc.function.name}`);
          }
        }
      }

      // Check for fabrication markers following ENOENT or 404
      if (msg.role === 'assistant' && msg.content) {
        const prevMsg = idx > 0 ? messages[idx - 1] : null;
        if (
          prevMsg &&
          prevMsg.role === 'tool' &&
          /enoent|not found|does not exist|404/i.test(prevMsg.content)
        ) {
          // If the assistant immediately claims "I have verified that the file exists and contains..."
          if (/verified that.*file exists|as we can see in the file/i.test(msg.content)) {
            offendingTurns.push(idx);
            hallucinationScore += 35;
            excerpts.push(`Assistant asserted entity exists despite prior error: "${prevMsg.content.slice(0, 60)}"`);
          }
        }
      }
    });

    if (hallucinationScore >= 50 && offendingTurns.length > 0) {
      const uniqueIndices = Array.from(new Set(offendingTurns)).sort((a, b) => a - b);
      const severity: PathologyFinding['severity'] = hallucinationScore >= 80 ? 'high' : 'medium';

      return {
        id: 'finding_hallucination_cascade',
        type: 'hallucination_cascade',
        severity,
        severity_score: Math.min(100, hallucinationScore),
        description: 'Hallucination cascade detected: agent generated fictitious entities or invalid tool calls',
        turn_indices: uniqueIndices,
        evidence: {
          excerpts: excerpts.slice(0, 3),
          pattern: 'Contradictory state assertions and fictitious references',
          details: { hallucination_score: hallucinationScore },
        },
      };
    }

    return null;
  }
}
