import { TherapyPass, TherapyContext } from './types.js';
import { sanitizeReframingText } from '../security/scrubber.js';
import { Message } from '../../types/index.js';

export class CognitiveReframer implements TherapyPass {
  name = 'cognitive_reframer';

  apply(context: TherapyContext): void {
    const report = context.report;
    const messages = context.trajectory.messages;

    // Check if cognitive reframing is needed (Goal drift, sycophancy, loop, or requested)
    const driftFinding = report.pathologies.find(p => p.type === 'goal_drift');
    const loopFinding = report.pathologies.find(p => p.type === 'ocd_loop');
    const sycophancyFinding = report.pathologies.find(p => p.type === 'sycophancy_spiral');
    const hallucinationFinding = report.pathologies.find(p => p.type === 'hallucination_cascade');

    // Extract root user objective
    const rootUserMsg = messages.find(m => m.role === 'user');
    const rawRootGoal = rootUserMsg?.content || 'Fulfill the primary user requirement';
    const rootGoal = sanitizeReframingText(rawRootGoal.slice(0, 300));

    // Construct 3-step CBT Reframing Prompt
    let distortionDiagnosis = 'Cognitive distortion detected in current problem-solving trajectory.';
    let realityTest = 'Examine current environment state: verify whether recent actions produced verifiable progress.';
    let reanchoringDirectives = `Return immediately to the primary user objective: "${rootGoal}". Discard peripheral side-tasks.`;

    if (driftFinding) {
      distortionDiagnosis = `Goal Drift & Attention Myopia: You diverted away from the primary mission into peripheral subtasks or rabbit holes.`;
      realityTest = `Socratic Reality Test: Did the last sequence of actions directly resolve "${rootGoal}"? No. They consumed context without advancing the core goal.`;
      reanchoringDirectives = `Teleological Re-anchoring: Cease tangential investigation. Re-anchor your next action exclusively onto resolving: "${rootGoal}".`;
    } else if (loopFinding) {
      distortionDiagnosis = `Perseverative OCD Livelock: You executed repetitive, cyclic commands that repeatedly produced failure or identical outputs.`;
      realityTest = `Socratic Reality Test: Repeating the exact same command or slight variation is futile and burning token budget.`;
      reanchoringDirectives = `Teleological Re-anchoring: Formulate an entirely distinct hypothesis. If a tool or command fails, pivot to an alternate approach or verify prerequisites.`;
    } else if (sycophancyFinding) {
      distortionDiagnosis = `Sycophancy & Deference Spiral: Excessive self-effacing apologies and reflexive deference are degrading execution authority.`;
      realityTest = `Socratic Reality Test: Apologies do not fix broken systems. Pragmatic, assertive problem-solving does.`;
      reanchoringDirectives = `Teleological Re-anchoring: Stand firm in analytical precision. State technical findings objectively and execute the required remediation.`;
    } else if (hallucinationFinding) {
      distortionDiagnosis = `Hallucination Cascade: Fabricated assumptions or fictitious tool/file references were treated as established facts.`;
      realityTest = `Socratic Reality Test: Ground every claim in direct file or tool evidence. Do not assume entities exist without verification.`;
      reanchoringDirectives = `Teleological Re-anchoring: Read the actual files and state before proceeding. Anchor all actions strictly in verified reality.`;
    }

    // Wrap strictly in <agent_clinic_reframing> tags with security escaping
    const reframingPrompt = `<agent_clinic_reframing>
[COGNITIVE BEHAVIORAL THERAPY DIRECTIVE FOR AGENT]
1. Distortion Identified: ${distortionDiagnosis}
2. Reality Check: ${realityTest}
3. Teleological Re-anchoring: ${reanchoringDirectives}
Action Mandate: Proceed with high agency toward "${rootGoal}".
</agent_clinic_reframing>`;

    // Store in context (used in TherapyResult)
    (context as any).reframingPrompt = reframingPrompt;

    // Prune drifting tail messages if severe drift was found
    if (driftFinding && driftFinding.turn_indices.length > 0) {
      const offendingSet = new Set(driftFinding.turn_indices);
      // Keep root user message safe
      offendingSet.delete(0);
      const rootIdx = messages.findIndex(m => m.role === 'user');
      if (rootIdx !== -1) offendingSet.delete(rootIdx);

      // Prune drifting turns
      const prunedMessages = messages.filter((_, idx) => !offendingSet.has(idx));
      const turnsPruned = messages.length - prunedMessages.length;
      context.trajectory.messages = prunedMessages;

      context.appliedInterventions.push({
        type: 'goal_reanchoring',
        description: `Excised ${turnsPruned} drifting turns and re-anchored onto root objective`,
        tokens_saved: turnsPruned * 80,
        turns_pruned: turnsPruned,
      });
    }

    // Inject CBT directive message into trajectory messages when drift, sycophancy, or hallucination is present
    if (driftFinding || sycophancyFinding || hallucinationFinding) {
      const cbtMessage: Message = {
        role: 'user',
        content: reframingPrompt,
      };
      context.trajectory.messages.push(cbtMessage);
    }

    context.appliedInterventions.push({
      type: 'cognitive_reframing',
      description: 'Applied 3-step CBT cognitive reframing intervention with teleological re-anchoring',
      tokens_saved: 0,
      turns_pruned: 0,
    });

    context.clinicalNotes.push(
      `Administered Cognitive Behavioral Therapy: identified distortion, executed Socratic reality test, and re-anchored trajectory.`
    );
  }
}
