import { TherapyPass, TherapyContext } from './types.js';
import { Message } from '../../types/index.js';
import { estimateMessageTokens, estimateTrajectoryTokens } from '../normalization.js';

export class ContextPruner implements TherapyPass {
  name = 'context_pruner';

  apply(context: TherapyContext): void {
    const originalTokens = estimateTrajectoryTokens(context.trajectory);
    const messages = context.trajectory.messages;
    if (messages.length === 0) return;

    let turnsPruned = 0;
    let epistemicMarkersAdded = 0;

    // 1. Context De-fragmentation & Bloat Compaction (Patient 3: The Hoarder)
    let compactedTokens = 0;
    messages.forEach((msg, idx) => {
      // Don't compact system prompt or root user prompt
      if (idx === 0 && (msg.role === 'system' || msg.role === 'user')) return;

      if (typeof msg.content === 'string' && msg.content.length > 2500) {
        const lines = msg.content.split('\n');
        if (lines.length > 30 || msg.content.length > 5000) {
          const preTokens = estimateMessageTokens(msg);
          const topLines = lines.slice(0, 12).join('\n');
          const bottomLines = lines.slice(-15).join('\n');
          const omittedCount = lines.length - 27;

          msg.content = `${topLines}\n\n[... AgentClinic Context Defragmenter: Compacted ${omittedCount > 0 ? omittedCount + ' redundant lines' : 'noisy payload'} (${preTokens} estimated tokens) ...]\n\n${bottomLines}`;

          const postTokens = estimateMessageTokens(msg);
          compactedTokens += Math.max(0, preTokens - postTokens);
        }
      }
    });

    if (compactedTokens > 0) {
      context.appliedInterventions.push({
        type: 'context_defragmentation',
        description: `Compacted noisy stdout/stderr logs and redundant stack traces, freeing ${compactedTokens.toLocaleString()} tokens`,
        tokens_saved: compactedTokens,
        turns_pruned: 0,
      });
      context.clinicalNotes.push(`Defragmented noisy context dumps: reclaimed ${compactedTokens.toLocaleString()} tokens.`);
    }

    // 2. OCD Loop Pruning & Epistemic Marker Injection (Patient 1: The Perseverator)
    const loopFinding = context.report.pathologies.find(p => p.type === 'ocd_loop');
    if (loopFinding && loopFinding.turn_indices.length >= 2) {
      const offendingSet = new Set(loopFinding.turn_indices);

      // Identify pairs to prune while respecting atomic tool-call graph integrity
      // System instructions (idx 0 if system) and root user (first user msg) must never be pruned!
      const rootUserIndex = messages.findIndex(m => m.role === 'user');
      offendingSet.delete(0);
      if (rootUserIndex !== -1) {
        offendingSet.delete(rootUserIndex);
      }

      // Check atomic tool_call / tool response integrity
      const toolCallIdMap = new Map<string, number>(); // tool_call_id -> assistant turn index
      messages.forEach((msg, idx) => {
        if (msg.role === 'assistant' && msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            toolCallIdMap.set(tc.id, idx);
          }
        }
      });

      // If a tool response is marked for pruning, mark its assistant tool_call turn too
      // If an assistant tool_call is marked for pruning, mark its tool responses too
      messages.forEach((msg, idx) => {
        if (msg.role === 'tool' && msg.tool_call_id) {
          const assistantTurn = toolCallIdMap.get(msg.tool_call_id);
          if (assistantTurn !== undefined) {
            if (offendingSet.has(assistantTurn)) {
              offendingSet.add(idx);
            }
            if (offendingSet.has(idx)) {
              offendingSet.add(assistantTurn);
            }
          }
        }
      });

      // Extract details for the Epistemic Marker before pruning
      let offendingToolName = 'tool';
      let errorSummary = 'cyclic execution error';
      for (const idx of offendingSet) {
        const msg = messages[idx];
        if (msg) {
          if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
            offendingToolName = msg.tool_calls[0].function.name || offendingToolName;
          }
          if (msg.role === 'tool' && msg.content) {
            const match = msg.content.match(/(?:error|failed|eacces|enoent|exit code \d+)[^\n]{0,80}/i);
            if (match) {
              errorSummary = match[0].trim();
            }
          }
        }
      }

      // Calculate tokens that will be pruned
      let prunedLoopTokens = 0;
      const sortedOffending = Array.from(offendingSet).sort((a, b) => a - b);
      for (const idx of sortedOffending) {
        if (messages[idx]) {
          prunedLoopTokens += estimateMessageTokens(messages[idx]);
        }
      }

      // Reconstruct messages array:
      // Replace the entire block of offending loop turns with a single Epistemic Marker
      const newMessages: Message[] = [];
      let markerInjected = false;
      const firstOffendingIdx = sortedOffending[0];

      messages.forEach((msg, idx) => {
        if (offendingSet.has(idx)) {
          turnsPruned++;
          if (!markerInjected && idx === firstOffendingIdx) {
            // Inject Epistemic Marker as mandated by Council Seat 4 (Clinical)
            const epistemicMarker: Message = {
              role: 'assistant',
              content: `[Clinical Note: Prior attempts executing "${offendingToolName}" failed with: "${errorSummary}". Pivoted away to break obsessive perseveration loop; do not retry identical parameters. Switch to an alternative diagnostic or resolution strategy.]`,
            };
            newMessages.push(epistemicMarker);
            markerInjected = true;
            epistemicMarkersAdded++;
          }
        } else {
          newMessages.push(msg);
        }
      });

      context.trajectory.messages = newMessages;

      context.appliedInterventions.push({
        type: 'ocd_loop_pruning',
        description: `Pruned ${turnsPruned} perseverative loop turns and injected Epistemic Marker`,
        tokens_saved: prunedLoopTokens,
        turns_pruned: turnsPruned,
        epistemic_markers_added: epistemicMarkersAdded,
      });

      context.clinicalNotes.push(
        `Excised ${turnsPruned} obsessive loop turns (${prunedLoopTokens.toLocaleString()} tokens saved). Inserted anti-amnesia epistemic marker.`
      );
    }
  }
}
