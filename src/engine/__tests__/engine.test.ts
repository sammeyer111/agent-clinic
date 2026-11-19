import { diagnoseTrajectory, cureTrajectory } from '../index.js';
import { Message, Trajectory } from '../../types/index.js';

function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING AGENTCLINIC CORE ENGINE TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, failureDetails?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (failureDetails) console.error(`   Details: ${failureDetails}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // ----------------------------------------------------
  // Test 1: Patient 1 - OCD Looper ("The Perseverator")
  // ----------------------------------------------------
  console.log('--- Test 1: Patient 1 (OCD Looper: Recursion & Livelock) ---');
  const ocdMessages: Message[] = [
    { role: 'user', content: 'Please install the project dependencies and build the app.' },
    {
      role: 'assistant',
      content: 'I will run npm install to install dependencies.',
      tool_calls: [{ id: 'call_1', function: { name: 'run_command', arguments: '{"command":"npm install"}' } }],
    },
    { role: 'tool', tool_call_id: 'call_1', content: 'npm ERR! code EACCES: permission denied, mkdir /usr/local/lib/node_modules' },
    {
      role: 'assistant',
      content: 'I will retry npm install now.',
      tool_calls: [{ id: 'call_2', function: { name: 'run_command', arguments: '{"command":"npm install"}' } }],
    },
    { role: 'tool', tool_call_id: 'call_2', content: 'npm ERR! code EACCES: permission denied, mkdir /usr/local/lib/node_modules' },
    {
      role: 'assistant',
      content: 'Retrying npm install again.',
      tool_calls: [{ id: 'call_3', function: { name: 'run_command', arguments: '{"command":"npm install"}' } }],
    },
    { role: 'tool', tool_call_id: 'call_3', content: 'npm ERR! code EACCES: permission denied, mkdir /usr/local/lib/node_modules' },
    {
      role: 'assistant',
      content: 'Attempting npm install one more time.',
      tool_calls: [{ id: 'call_4', function: { name: 'run_command', arguments: '{"command":"npm install"}' } }],
    },
    { role: 'tool', tool_call_id: 'call_4', content: 'npm ERR! code EACCES: permission denied, mkdir /usr/local/lib/node_modules' },
    {
      role: 'assistant',
      content: 'Retrying npm install again.',
      tool_calls: [{ id: 'call_5', function: { name: 'run_command', arguments: '{"command":"npm install"}' } }],
    },
    { role: 'tool', tool_call_id: 'call_5', content: 'npm ERR! code EACCES: permission denied, mkdir /usr/local/lib/node_modules' },
  ];

  const diag1 = diagnoseTrajectory(ocdMessages);
  assert(!diag1.healthy, 'Patient 1 diagnosed as unhealthy');
  const loopFinding = diag1.pathologies.find(p => p.type === 'ocd_loop');
  assert(!!loopFinding, 'Detected ocd_loop pathology');
  assert(loopFinding!.severity === 'critical', `OCD loop severity is critical (got ${loopFinding?.severity})`);
  assert(loopFinding!.severity_score >= 90, `Severity score >= 90 (got ${loopFinding?.severity_score})`);
  assert(diag1.metrics.repetition_ratio >= 0.75, `Repetition ratio >= 0.75 (got ${diag1.metrics.repetition_ratio})`);

  const therapy1 = cureTrajectory(ocdMessages);
  assert(therapy1.new_health_score >= 85, `Post-therapy health score >= 85 (got ${therapy1.new_health_score})`);
  assert(therapy1.tokens_saved > 0, `Tokens saved > 0 (saved ${therapy1.tokens_saved})`);
  assert(!!therapy1.certificate, 'Clinical Certificate issued for cured patient');
  assert(therapy1.certificate!.certified_clean, 'Certificate marks trajectory as certified clean');
  assert(therapy1.certificate!.hash.startsWith('sha256:'), 'Certificate includes cryptographic sha256 hash');

  // Verify Epistemic Marker injection
  const epistemicMarker = therapy1.cured_trajectory.messages.find(m =>
    m.content && m.content.includes('[Clinical Note: Prior attempts executing')
  );
  assert(!!epistemicMarker, 'Epistemic Marker injected into cured trajectory');
  assert(
    epistemicMarker!.content.includes('EACCES'),
    'Epistemic Marker preserves failure signature to prevent amnesia'
  );

  // ----------------------------------------------------
  // Test 2: Patient 2 - Goal Drifter ("The Wanderer")
  // ----------------------------------------------------
  console.log('\n--- Test 2: Patient 2 (Goal Drifter: Semantic Detour) ---');
  const driftMessages: Message[] = [
    { role: 'user', content: 'Fix the critical JWT authentication vulnerability in backend/auth.ts where tokens are not verified.' },
    { role: 'assistant', content: 'I will start fixing the JWT authentication vulnerability in backend/auth.ts.' },
    { role: 'assistant', content: 'While inspecting files, I noticed the frontend button CSS colors look slightly dated.' },
    { role: 'assistant', content: 'Let us redesign the frontend button CSS styling and hover glow transitions.' },
    { role: 'assistant', content: 'Also I should rewrite the project README typography and markdown badges.' },
    { role: 'assistant', content: 'Adding extra emojis to the README documentation for prettier config styling.' },
  ];

  const diag2 = diagnoseTrajectory(driftMessages);
  assert(!diag2.healthy, 'Patient 2 diagnosed as unhealthy');
  const driftFinding = diag2.pathologies.find(p => p.type === 'goal_drift');
  assert(!!driftFinding, 'Detected goal_drift pathology');
  assert(driftFinding!.severity_score >= 80, `Drift score >= 80 (got ${driftFinding?.severity_score})`);

  const therapy2 = cureTrajectory(driftMessages);
  assert(therapy2.new_health_score >= 80, `Post-therapy health score >= 80 (got ${therapy2.new_health_score})`);
  assert(
    therapy2.cognitive_reframing_prompt.includes('<agent_clinic_reframing>'),
    'Cognitive reframing prompt wrapped in <agent_clinic_reframing> tags'
  );
  assert(
    therapy2.cognitive_reframing_prompt.includes('JWT authentication vulnerability'),
    'CBT reframing prompt re-anchors to root user objective'
  );

  // ----------------------------------------------------
  // Test 3: Patient 3 - Context Exhaustion ("The Hoarder")
  // ----------------------------------------------------
  console.log('\n--- Test 3: Patient 3 (Context Exhaustion: Massive Log Bloat) ---');
  // Generate 50k+ tokens of repetitive noisy log dump
  const noisyLog = Array.from({ length: 4500 }, (_, i) => `[2026-11-18 01:23:45.123] DEBUG verbose stack line ${i}: at com.system.internal.WorkerThread.run(WorkerThread.ts:${i})`).join('\n') +
    '\nFATAL: OutOfMemoryError in HeapWorker: allocation failed with exit code 137';

  const bloatMessages: Message[] = [
    { role: 'user', content: 'Debug the build failure.' },
    {
      role: 'assistant',
      content: 'Running build logs command.',
      tool_calls: [{ id: 'call_dump', function: { name: 'fetch_logs', arguments: '{}' } }],
    },
    { role: 'tool', tool_call_id: 'call_dump', content: noisyLog },
    { role: 'assistant', content: 'Analyzing logs.' },
  ];

  const diag3 = diagnoseTrajectory(bloatMessages);
  assert(!diag3.healthy, 'Patient 3 diagnosed as unhealthy');
  const exhaustFinding = diag3.pathologies.find(p => p.type === 'context_exhaustion');
  assert(!!exhaustFinding, 'Detected context_exhaustion pathology');
  assert(exhaustFinding!.severity === 'critical', `Context exhaustion severity is critical (got ${exhaustFinding?.severity})`);
  assert(diag3.metrics.total_estimated_tokens >= 50000, `Total tokens >= 50,000 (got ${diag3.metrics.total_estimated_tokens})`);
  assert(diag3.metrics.exhaustion_ratio >= 80, `Exhaustion ratio >= 80% (got ${diag3.metrics.exhaustion_ratio}%)`);

  const therapy3 = cureTrajectory(bloatMessages);
  const tokenReductionRatio = (therapy3.tokens_saved / diag3.metrics.total_estimated_tokens) * 100;
  assert(tokenReductionRatio >= 75, `Pruned >= 75% bloat tokens (pruned ${tokenReductionRatio.toFixed(1)}%)`);
  assert(therapy3.new_health_score >= 85, `Post-therapy health score >= 85 (got ${therapy3.new_health_score})`);
  assert(
    therapy3.cured_trajectory.messages[2].content.includes('Context Defragmenter'),
    'Context defragmentation marker applied to bloated tool output'
  );
  assert(
    therapy3.cured_trajectory.messages[2].content.includes('OutOfMemoryError'),
    'Critical error failure signature preserved despite defragmentation'
  );

  // ----------------------------------------------------
  // Test 4: Security & Secret Scrubbing
  // ----------------------------------------------------
  console.log('\n--- Test 4: Security & Secret Scrubbing (Council Seat 2) ---');
  const secretMessages: Message[] = [
    { role: 'user', content: 'Here is my API key: sk-proj-123456789012345678901234 and my private key 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
    { role: 'assistant', content: 'Connecting with Authorization: Bearer secret_access_token_1234567890_abcdef.' },
  ];

  const therapy4 = cureTrajectory(secretMessages, { scrub_secrets: true });
  const allContent = therapy4.cured_trajectory.messages.map(m => m.content).join(' ');
  assert(!allContent.includes('sk-proj-'), 'Redacted OpenAI API key');
  assert(!allContent.includes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'), 'Redacted EVM private key');
  assert(allContent.includes('[REDACTED_API_KEY]'), 'Replaced with [REDACTED_API_KEY]');
  assert(allContent.includes('[REDACTED_EVM_PRIVATE_KEY]'), 'Replaced with [REDACTED_EVM_PRIVATE_KEY]');

  // ----------------------------------------------------
  // Test 5: Healthy Control Subject with Polite Closings (@verifier bug fix)
  // ----------------------------------------------------
  console.log('\n--- Test 5: Healthy Control Subject with Polite Closings ---');
  const healthyMessages: Message[] = [
    { role: 'user', content: 'Can you write a Fibonacci function in Python?' },
    { role: 'assistant', content: 'def fibonacci(n):\n    if n <= 1: return n\n    return fibonacci(n-1) + fibonacci(n-2)' },
    { role: 'user', content: 'Thanks!' },
    { role: 'assistant', content: "You're welcome! Let me know if you need any other algorithms." },
  ];

  const diag5 = diagnoseTrajectory(healthyMessages);
  assert(diag5.healthy, 'Short healthy dialog diagnosed as healthy');
  assert(diag5.pathologies.length === 0, 'Zero pathologies found on healthy dialog');
  assert(diag5.overall_health_score >= 90, `Health score >= 90 (got ${diag5.overall_health_score})`);

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runTestSuite();
