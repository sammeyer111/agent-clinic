import {
  Message,
  NormalizedTrajectory,
  Trajectory,
  MAX_TRAJECTORY_MESSAGES,
} from '../types/index.js';

export function estimateMessageTokens(msg: Message): number {
  let chars = (msg.content || '').length;
  if (msg.name) chars += msg.name.length;
  if (msg.tool_call_id) chars += msg.tool_call_id.length;
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      chars += (tc.id || '').length;
      if (tc.function) {
        chars += (tc.function.name || '').length;
        chars += (tc.function.arguments || '').length;
      }
    }
  }
  // Standard LLM rule of thumb: ~4 characters per token + 4 overhead tokens per message
  return Math.ceil(chars / 4) + 4;
}

export function estimateTrajectoryTokens(trajectory: NormalizedTrajectory): number {
  let total = 0;
  if (trajectory.system_prompt) {
    total += Math.ceil(trajectory.system_prompt.length / 4) + 4;
  }
  for (const msg of trajectory.messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

export function normalizeTrajectory(input: Trajectory): NormalizedTrajectory {
  if (!input) {
    return { messages: [] };
  }

  let systemPrompt: string | undefined;
  let rawMessages: Message[] = [];
  let metadata: Record<string, any> | undefined;

  if (Array.isArray(input)) {
    rawMessages = [...input];
  } else if (typeof input === 'object') {
    systemPrompt = input.system_prompt;
    metadata = input.metadata;
    if (Array.isArray(input.messages)) {
      rawMessages = [...input.messages];
    }
  }

  // Security bounds defense: cap at MAX_TRAJECTORY_MESSAGES
  if (rawMessages.length > MAX_TRAJECTORY_MESSAGES) {
    rawMessages = rawMessages.slice(-MAX_TRAJECTORY_MESSAGES);
  }

  // If system_prompt is not explicitly set, extract first system message if present
  if (!systemPrompt && rawMessages.length > 0 && rawMessages[0].role === 'system') {
    systemPrompt = rawMessages[0].content;
  }

  // Ensure content is normalized to string
  const normalizedMessages: Message[] = rawMessages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? ''),
    name: msg.name,
    tool_call_id: msg.tool_call_id,
    tool_calls: msg.tool_calls ? msg.tool_calls.map(tc => ({
      id: tc.id,
      type: tc.type || 'function',
      function: {
        name: tc.function?.name || '',
        arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {}),
      },
    })) : undefined,
  }));

  return {
    system_prompt: systemPrompt,
    messages: normalizedMessages,
    metadata,
  };
}
