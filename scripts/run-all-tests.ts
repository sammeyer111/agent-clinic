import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface TestSuite {
  name: string;
  command: string;
  description: string;
}

const testSuites: TestSuite[] = [
  {
    name: '1. Core Diagnostics & Therapy Engine',
    command: 'npx tsx src/engine/__tests__/engine.test.ts',
    description: 'Validates 5-axis clinical taxonomy, loop pruning, defragmentation, CBT reframing, and secret scrubbing.',
  },
  {
    name: '2. API Gateway & x402 Micropayments',
    command: 'npx tsx scripts/test-api.ts',
    description: 'Validates Hono server, OpenAPI spec, HTTP 402 payment-required challenges, and Base USDC routing.',
  },
  {
    name: '3. MCP Tools Standalone Suite',
    command: 'npx tsx scripts/test-mcp-standalone.ts',
    description: 'Validates Stdio MCP server creation, consult_agent_clinic tool, and seek_agent_therapy tool.',
  },
  {
    name: '4. MCP & Client End-to-End Suite',
    command: 'npx tsx scripts/test-mcp-e2e.ts',
    description: 'Validates AgentClinicClient, 1-line autoHeal() helper, and remote MCP tool execution.',
  },
  {
    name: '5. Patient Zero Clinical Trial Benchmark',
    command: 'npx tsx scripts/clinical-trial.ts',
    description: 'Runs synthetic patient cohort (OCD, Drift, Bloat, Sycophancy, Control), remission, and Scorecard.',
  },
  {
    name: '6. Moltbook Review Reimbursement Campaign',
    command: 'npx tsx scripts/test-moltbook-campaign.ts',
    description: 'Validates review submission, rebate allocation, duplicate prevention, and schema enforcement.',
  },
  {
    name: '7. Moltbook 50% Next Session Retention Model',
    command: 'npx tsx scripts/test-discount-retention.ts',
    description: 'Validates paid session prerequisite, 50% next-session dynamic discount, zero gas fees, and atomic burn.',
  },
  {
    name: '8. Remote Streamable HTTP MCP & Clinical Index',
    command: 'npx tsx scripts/test-mcp-http.ts',
    description: 'Validates web standard MCP transport (/mcp), session handshake, tools/list, and Epidemiological Index.',
  },
  {
    name: '9. Autonomous Reference Agent Loop',
    command: 'npx tsx examples/autonomous-agent-loop.ts',
    description: 'Demonstrates end-to-end autonomous healing: livelock detection, x402 payment, Moltbook review, and 50% discount.',
  },
  {
    name: '10. TypeScript Compilation & Type Safety',
    command: 'npx tsc --noEmit',
    description: 'Verifies zero TypeScript compilation errors across all engine, API, MCP, and test files.',
  },
];

async function runAllTests() {
  console.log('================================================================================');
  console.log('🩺 AGENTCLINIC MASTER VERIFICATION SUITE');
  console.log('   Running complete QA battery across Engine, Server, x402, MCP, and Trials');
  console.log('================================================================================\n');

  const startTime = Date.now();
  let passedSuites = 0;
  const results: Array<{ name: string; status: 'PASSED' | 'FAILED'; durationMs: number }> = [];

  for (const suite of testSuites) {
    console.log(`\n▶ Executing: ${suite.name}`);
    console.log(`  Description: ${suite.description}`);
    console.log(`  Command: ${suite.command}`);
    console.log('--------------------------------------------------------------------------------');

    const suiteStart = Date.now();
    try {
      execSync(suite.command, {
        cwd: rootDir,
        stdio: 'inherit',
        env: { ...process.env, ALLOW_DEV_BYPASS: 'true' },
      });
      const durationMs = Date.now() - suiteStart;
      console.log(`✅ [SUITE PASSED] ${suite.name} (${(durationMs / 1000).toFixed(2)}s)`);
      passedSuites++;
      results.push({ name: suite.name, status: 'PASSED', durationMs });
    } catch (err: any) {
      const durationMs = Date.now() - suiteStart;
      console.error(`❌ [SUITE FAILED] ${suite.name} (${(durationMs / 1000).toFixed(2)}s)`);
      results.push({ name: suite.name, status: 'FAILED', durationMs });
      process.exit(1);
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================================');
  console.log('🏆 AGENTCLINIC MASTER TEST RUNNER SUMMARY');
  console.log('================================================================================');
  for (const r of results) {
    const symbol = r.status === 'PASSED' ? '✅' : '❌';
    console.log(`  ${symbol} ${r.name.padEnd(45)} [${r.status}] (${(r.durationMs / 1000).toFixed(2)}s)`);
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(`  Total Test Suites: ${testSuites.length}`);
  console.log(`  Suites Passed:     ${passedSuites}/${testSuites.length} (100%)`);
  console.log(`  Total Execution:   ${totalDuration}s`);
  console.log('================================================================================\n');
}

runAllTests().catch(err => {
  console.error('Master test runner encountered fatal error:', err);
  process.exit(1);
});
