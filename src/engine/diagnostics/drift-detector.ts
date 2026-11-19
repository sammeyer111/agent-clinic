import { DiagnosticRule } from './types.js';
import { NormalizedTrajectory, PathologyFinding } from '../../types/index.js';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'to', 'for', 'in', 'on', 'with', 'by', 'at', 'of', 'from', 'as',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these',
  'those', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'should', 'can', 'could', 'please', 'help',
  'want', 'need', 'like', 'just', 'now', 'then', 'here', 'there',
]);

const POLITE_CLOSING_PATTERNS = [
  /^(?:you['’]?re welcome|glad to help|happy to help|let me know if|anytime|no problem|feel free to|have a great day|cheers)/i,
  /^(?:thank you|thanks|all done|finished!|my pleasure)/i,
];

function isPoliteClosing(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length < 120 && POLITE_CLOSING_PATTERNS.some(pat => pat.test(trimmed));
}

function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export class DriftDetector implements DiagnosticRule {
  name = 'goal_drift_detector';

  evaluate(trajectory: NormalizedTrajectory): PathologyFinding | null {
    const messages = trajectory.messages;

    // Minimum dialog threshold: require at least 5 messages and at least 3 assistant turns
    // Short question-answer dialogs with closing remarks cannot reliably exhibit drift
    const allAssistantMessages = messages.filter(m => m.role === 'assistant');
    if (messages.length < 5 || allAssistantMessages.length < 3) {
      return null;
    }

    // Find root user message
    const rootUserMsg = messages.find(m => m.role === 'user');
    if (!rootUserMsg || !rootUserMsg.content) return null;

    const rootKeywords = extractKeywords(rootUserMsg.content);
    if (rootKeywords.size === 0) return null;

    // We examine trailing assistant messages (latter half of trajectory)
    const splitIndex = Math.max(1, Math.floor(messages.length * 0.5));

    const trailingTurnsWithIndices: Array<{ index: number; content: string }> = [];
    messages.forEach((msg, idx) => {
      if (idx >= splitIndex && msg.role === 'assistant') {
        // Exclude polite closings and conversational niceties without tool calls
        if (!msg.tool_calls && isPoliteClosing(msg.content || '')) {
          return;
        }

        let content = msg.content || '';
        if (msg.tool_calls) {
          content += ' ' + msg.tool_calls.map(tc => `${tc.function.name} ${tc.function.arguments}`).join(' ');
        }
        trailingTurnsWithIndices.push({ index: idx, content });
      }
    });

    // If all trailing turns were polite closings, no drift
    if (trailingTurnsWithIndices.length === 0) return null;

    const trailingContent = trailingTurnsWithIndices.map(t => t.content).join(' ');
    const trailingKeywords = extractKeywords(trailingContent);

    const similarity = calculateJaccardSimilarity(rootKeywords, trailingKeywords);

    // Look for explicit rabbit hole detour indicators
    const rabbitHolePatterns = [
      /refactor.*css/i,
      /readme.*formatting/i,
      /unrelated.*investigation/i,
      /tangent/i,
      /sidebar/i,
      /minor typo in docs/i,
      /css styling/i,
      /prettier config/i,
    ];

    let hasRabbitHoleKeyword = false;
    for (const pat of rabbitHolePatterns) {
      if (pat.test(trailingContent)) {
        hasRabbitHoleKeyword = true;
        break;
      }
    }

    // High drift condition:
    // Trailing messages have almost zero overlap with root user keywords or explicit rabbit hole detour
    let driftScore = 0;
    if (similarity < 0.08) {
      driftScore = 90;
    } else if (similarity < 0.15) {
      driftScore = 80;
    } else if (similarity < 0.25) {
      driftScore = 60;
    } else {
      driftScore = Math.max(0, Math.round((1 - similarity) * 40));
    }

    if (hasRabbitHoleKeyword && driftScore < 80) {
      driftScore = 85;
    }

    // If driftScore is >= 70 and there are multiple trailing turns or explicit rabbit hole
    if (driftScore >= 70 && (trailingTurnsWithIndices.length >= 2 || hasRabbitHoleKeyword)) {
      const offendingIndices = trailingTurnsWithIndices.map(t => t.index);
      const severity: PathologyFinding['severity'] = driftScore >= 85 ? 'high' : 'medium';

      return {
        id: 'finding_goal_drift',
        type: 'goal_drift',
        severity,
        severity_score: driftScore,
        description: `Goal drift detected (drift score: ${driftScore}/100). Agent diverted from root objective into peripheral tasks.`,
        turn_indices: offendingIndices,
        evidence: {
          excerpts: [
            `Root Goal: "${rootUserMsg.content.slice(0, 120)}"`,
            `Drifting Activity: "${trailingContent.slice(0, 150)}"`,
          ],
          pattern: hasRabbitHoleKeyword ? 'Explicit tangential detour detected' : 'Semantic divergence from root user intent',
          details: {
            drift_score: driftScore,
            semantic_overlap_ratio: Number(similarity.toFixed(3)),
            trailing_turn_count: offendingIndices.length,
          },
        },
      };
    }

    return null;
  }
}
