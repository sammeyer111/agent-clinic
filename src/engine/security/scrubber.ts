// Automated Secret, Credential & PII Scrubber for AgentClinic
// Mandated by Council Seat 2 (Security)

const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // OpenAI / Anthropic / Generic AI API Keys
  { pattern: /sk-[a-zA-Z0-9_\-]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  // GitHub Personal Access Tokens
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { pattern: /github_pat_[a-zA-Z0-9_]{50,}/g, replacement: '[REDACTED_GITHUB_PAT]' },
  // EVM 64-character private keys
  { pattern: /(?:0x)?[a-fA-F0-9]{64}\b/g, replacement: '[REDACTED_EVM_PRIVATE_KEY]' },
  // Bearer tokens / Authorization headers
  { pattern: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, replacement: 'Bearer [REDACTED_AUTH_TOKEN]' },
  // Generic password assignments
  { pattern: /(["']?(?:password|secret|apikey|api_key|private_key|token)["']?\s*[:=]\s*["'])([^"'\s]{6,})(["'])/gi, replacement: '$1[REDACTED]$3' },
];

export function scrubText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let scrubbed = text;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }
  return scrubbed;
}

/**
 * Escapes characters that could be used in indirect prompt injection attacks,
 * neutralizing closing delimiter tags and instruction spoofing.
 */
export function sanitizeReframingText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<\/?[a-zA-Z0-9_-]+>/g, '') // Strip XML/HTML-like tags
    .replace(/<agent_clinic_reframing>/gi, '')
    .replace(/<\/agent_clinic_reframing>/gi, '')
    .replace(/\[SYSTEM_MESSAGE\]/gi, '[SAFE_LOG]')
    .replace(/\[INST\]/gi, '[SAFE_INST]')
    .replace(/\[\/INST\]/gi, '[/SAFE_INST]')
    .trim();
}
