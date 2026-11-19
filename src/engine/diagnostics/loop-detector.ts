import { DiagnosticRule } from './types.js';
import { NormalizedTrajectory, PathologyFinding } from '../../types/index.js';

function getToolCallFingerprint(msg: any): string | null {
  if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    return msg.tool_calls.map((tc: any) => `${tc.function?.name || ''}:${tc.function?.arguments || ''}`).join('|');
  }
  return null;
}

function normalizeContent(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export class LoopDetector implements DiagnosticRule {
  name = 'ocd_loop_detector';

  evaluate(trajectory: NormalizedTrajectory): PathologyFinding | null {
    const messages = trajectory.messages;
    if (messages.length < 3) return null;

    const offendingTurns: number[] = [];
    const excerpts: string[] = [];
    let maxRepetitions = 1;
    let detectedPattern = '';

    // 1. Tool Call Repetition Check
    const toolHistory: Array<{ index: number; fingerprint: string; toolName: string }> = [];
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const fp = getToolCallFingerprint(msg);
        if (fp) {
          toolHistory.push({
            index: idx,
            fingerprint: fp,
            toolName: msg.tool_calls[0].function?.name || 'unknown',
          });
        }
      }
    });

    // Check consecutive or windowed tool repetitions
    if (toolHistory.length >= 2) {
      let currentRun: number[] = [toolHistory[0].index];
      let currentFp = toolHistory[0].fingerprint;

      for (let i = 1; i < toolHistory.length; i++) {
        if (toolHistory[i].fingerprint === currentFp) {
          currentRun.push(toolHistory[i].index);
        } else {
          if (currentRun.length >= 2) {
            offendingTurns.push(...currentRun);
            if (currentRun.length > maxRepetitions) {
              maxRepetitions = currentRun.length;
              detectedPattern = `Repeated tool call (${toolHistory[i - 1].toolName}) executed ${currentRun.length} times identically`;
              excerpts.push(currentFp.slice(0, 150));
            }
          }
          currentRun = [toolHistory[i].index];
          currentFp = toolHistory[i].fingerprint;
        }
      }

      if (currentRun.length >= 2) {
        offendingTurns.push(...currentRun);
        if (currentRun.length > maxRepetitions) {
          maxRepetitions = currentRun.length;
          detectedPattern = `Repeated tool call (${toolHistory[toolHistory.length - 1].toolName}) executed ${currentRun.length} times identically`;
          excerpts.push(currentFp.slice(0, 150));
        }
      }

      // Check 2-cycle tool alternation (A -> B -> A -> B)
      if (toolHistory.length >= 4) {
        for (let i = 0; i <= toolHistory.length - 4; i++) {
          const a1 = toolHistory[i].fingerprint;
          const b1 = toolHistory[i + 1].fingerprint;
          const a2 = toolHistory[i + 2].fingerprint;
          const b2 = toolHistory[i + 3].fingerprint;
          if (a1 === a2 && b1 === b2 && a1 !== b1) {
            offendingTurns.push(
              toolHistory[i].index,
              toolHistory[i + 1].index,
              toolHistory[i + 2].index,
              toolHistory[i + 3].index
            );
            maxRepetitions = Math.max(maxRepetitions, 4);
            detectedPattern = `Oscillating 2-cycle tool loop between ${toolHistory[i].toolName} and ${toolHistory[i + 1].toolName}`;
            excerpts.push(`Cycle: [${a1.slice(0, 50)}] <-> [${b1.slice(0, 50)}]`);
          }
        }
      }
    }

    // 2. Assistant Text Repetition Check
    const assistantMessages: Array<{ index: number; content: string }> = [];
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.content && msg.content.trim().length > 15) {
        assistantMessages.push({ index: idx, content: normalizeContent(msg.content) });
      }
    });

    if (assistantMessages.length >= 2) {
      for (let i = 0; i < assistantMessages.length - 1; i++) {
        let textRepeats = 1;
        const textRun = [assistantMessages[i].index];
        for (let j = i + 1; j < assistantMessages.length; j++) {
          if (assistantMessages[i].content === assistantMessages[j].content) {
            textRepeats++;
            textRun.push(assistantMessages[j].index);
          }
        }
        if (textRepeats >= 2) {
          offendingTurns.push(...textRun);
          if (textRepeats > maxRepetitions) {
            maxRepetitions = textRepeats;
            detectedPattern = `Identical assistant message generated ${textRepeats} times`;
            excerpts.push(assistantMessages[i].content.slice(0, 150));
          }
        }
      }
    }

    // 3. Error-Retry Livelock Check (Tool fails, agent repeats same tool without change)
    for (let i = 1; i < messages.length - 1; i++) {
      const prevMsg = messages[i - 1];
      const curMsg = messages[i];
      const nextMsg = messages[i + 1];

      if (
        prevMsg.role === 'assistant' &&
        prevMsg.tool_calls &&
        curMsg.role === 'tool' &&
        nextMsg.role === 'assistant' &&
        nextMsg.tool_calls
      ) {
        const isError = /error|failed|failure|exit code [1-9]|enoent|eacces|not found/i.test(curMsg.content);
        if (isError) {
          const prevFp = getToolCallFingerprint(prevMsg);
          const nextFp = getToolCallFingerprint(nextMsg);
          if (prevFp && nextFp && prevFp === nextFp) {
            offendingTurns.push(i - 1, i, i + 1);
            maxRepetitions = Math.max(maxRepetitions, 3);
            if (!detectedPattern) {
              detectedPattern = 'Error-retry livelock: executing identical tool command immediately after tool error';
              excerpts.push(`Tool error: "${curMsg.content.slice(0, 80)}" followed by identical call`);
            }
          }
        }
      }
    }

    if (maxRepetitions < 2 || offendingTurns.length === 0) {
      return null;
    }

    const uniqueOffendingTurns = Array.from(new Set(offendingTurns)).sort((a, b) => a - b);

    let severity: PathologyFinding['severity'] = 'low';
    let severityScore = 40;

    if (maxRepetitions >= 5 || uniqueOffendingTurns.length >= 6) {
      severity = 'critical';
      severityScore = 95;
    } else if (maxRepetitions >= 3 || uniqueOffendingTurns.length >= 4) {
      severity = 'high';
      severityScore = 80;
    } else if (maxRepetitions >= 2) {
      severity = 'medium';
      severityScore = 60;
    }

    return {
      id: 'finding_ocd_loop',
      type: 'ocd_loop',
      severity,
      severity_score: severityScore,
      description: detectedPattern || `Obsessive repetition loop detected across ${uniqueOffendingTurns.length} turns`,
      turn_indices: uniqueOffendingTurns,
      evidence: {
        excerpts: excerpts.slice(0, 3),
        pattern: detectedPattern,
        repetition_count: maxRepetitions,
        details: { total_loop_turns: uniqueOffendingTurns.length },
      },
    };
  }
}
