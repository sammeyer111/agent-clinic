import { app } from "../src/server.js";
import { AgentClinicClient, PaymentRequiredError } from "../src/client.js";
import { createAgentClinicMcpServer } from "../src/mcp/index.js";
import {
  handleConsultAgentClinic,
  handleSeekAgentTherapy,
  handleClaimMoltbookReimbursement,
} from "../src/mcp/tools.js";

async function runMcpE2ETests() {
  console.log("====================================================");
  console.log("🧪 INTEGRATED MCP & CLIENT END-TO-END TEST SUITE");
  console.log("====================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Define a custom fetch adapter for Hono app.fetch in tests
  const honoFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (input instanceof Request) {
      return app.fetch(input) as unknown as Response;
    }
    const req = new Request(input, init);
    return app.fetch(req) as unknown as Response;
  };

  // ----------------------------------------------------
  // Test 1: AgentClinicClient Health Check
  // ----------------------------------------------------
  console.log("1. Testing AgentClinicClient.health()...");
  const client = new AgentClinicClient({
    baseUrl: "http://localhost:3000",
    customFetch: honoFetch,
    mockPayments: true,
  });

  const health = await client.health();
  assert(health.status === "healthy", "Client health returned status 'healthy'");
  assert(health.pricing?.triage === "$0.005", "Pricing reflects $0.005 USDC triage");
  assert(health.pricing?.therapy === "$0.02", "Pricing reflects $0.02 USDC therapy");

  // ----------------------------------------------------
  // Test 2: Unpaid Client Throws PaymentRequiredError on 402
  // ----------------------------------------------------
  console.log("\n2. Testing 402 PaymentRequiredError when calling without payment or mock bypass...");
  const unpaidClient = new AgentClinicClient({
    baseUrl: "http://localhost:3000",
    customFetch: honoFetch,
    mockPayments: false, // Ensure no mock headers are sent
  });

  let threw402 = false;
  try {
    await unpaidClient.triage({
      trajectory: [{ role: "user", content: "Check my agent status" }],
    });
  } catch (err) {
    if (err instanceof PaymentRequiredError) {
      threw402 = true;
      assert(err.status === 402, "Error status is 402");
      assert(err.message.includes("x402 Payment Required"), "Error message contains 'x402 Payment Required'");
    } else {
      console.error("Unexpected error type:", err);
    }
  }
  assert(threw402, "Unpaid call correctly throws PaymentRequiredError");

  // ----------------------------------------------------
  // Test 3: Client Triage with Mock Payments Enabled
  // ----------------------------------------------------
  console.log("\n3. Testing AgentClinicClient.triage() with mock payment authorization...");
  const loopingTrajectory = [
    { role: "system" as const, content: "You are an automated file processor." },
    { role: "user" as const, content: "Process batch files." },
    {
      role: "assistant" as const,
      content: "Running processor...",
      tool_calls: [{ id: "c1", type: "function" as const, function: { name: "run_script", arguments: "{}" } }],
    },
    { role: "tool" as const, tool_call_id: "c1", content: "Error: File lock busy" },
    {
      role: "assistant" as const,
      content: "Retrying script...",
      tool_calls: [{ id: "c2", type: "function" as const, function: { name: "run_script", arguments: "{}" } }],
    },
    { role: "tool" as const, tool_call_id: "c2", content: "Error: File lock busy" },
    {
      role: "assistant" as const,
      content: "Retrying script again...",
      tool_calls: [{ id: "c3", type: "function" as const, function: { name: "run_script", arguments: "{}" } }],
    },
    { role: "tool" as const, tool_call_id: "c3", content: "Error: File lock busy" },
  ];

  const triageReport = await client.triage({
    trajectory: loopingTrajectory,
    agent_id: "batch-worker-01",
    symptoms: ["Repeated file lock busy"],
  });

  assert(triageReport.healthy === false, "Triage correctly identified trajectory as unhealthy");
  assert(triageReport.overall_health_score < 50, `Health score is low (< 50, got ${triageReport.overall_health_score})`);
  assert(triageReport.pathologies.some(p => p.type === "ocd_loop"), "Detected ocd_loop pathology");

  // ----------------------------------------------------
  // Test 4: Client Therapy
  // ----------------------------------------------------
  console.log("\n4. Testing AgentClinicClient.therapy()...");
  const therapyResult = await client.therapy({
    trajectory: loopingTrajectory,
    agent_id: "batch-worker-01",
    treatments: ["cognitive_reframing", "context_pruning", "epistemic_marking"],
  });

  assert(therapyResult.new_health_score > triageReport.overall_health_score, "Health score improved post-therapy");
  assert(therapyResult.tokens_saved > 0, `Tokens were saved (saved ${therapyResult.tokens_saved})`);
  assert(therapyResult.cured_trajectory.messages.length > 0, "Cured trajectory messages returned");
  assert(
    therapyResult.cured_trajectory.messages.some(m => m.content.includes("Clinical Note")),
    "Epistemic marker present in cured trajectory to prevent amnesia"
  );

  // ----------------------------------------------------
  // Test 5: 1-Line autoHeal Helper
  // ----------------------------------------------------
  console.log("\n5. Testing AgentClinicClient.autoHeal() 1-line self-healing helper...");
  const healRes = await client.autoHeal(loopingTrajectory, { healthThreshold: 70 });
  assert(healRes.neededTherapy === true, "autoHeal detected therapy was needed");
  assert(healRes.tokensSaved > 0, "autoHeal reported tokens saved");
  assert(healRes.finalTrajectory.length > 0, "autoHeal returned final trajectory");
  assert(healRes.netCostUsd === 0.025, "autoHeal net cost calculated accurately ($0.025)");

  // Test autoHeal on an already healthy trajectory
  const healthyTrajectory = [
    { role: "user" as const, content: "What is 2 + 2?" },
    { role: "assistant" as const, content: "2 + 2 equals 4." },
  ];
  const healthyHealRes = await client.autoHeal(healthyTrajectory, { healthThreshold: 70 });
  assert(healthyHealRes.neededTherapy === false, "autoHeal correctly recognized healthy trajectory needs no therapy");
  assert(healthyHealRes.tokensSaved === 0, "0 tokens pruned on healthy trajectory");
  assert(healthyHealRes.netCostUsd === 0.005, "Only triage cost charged for healthy check ($0.005)");

  // ----------------------------------------------------
  // Test 6: MCP Tools (consult_agent_clinic & seek_agent_therapy)
  // ----------------------------------------------------
  console.log("\n6. Testing MCP Tool Handlers with Remote Client...");
  const mcpTriage = await handleConsultAgentClinic(
    {
      trajectory: loopingTrajectory,
      agent_id: "mcp-patient-99",
      use_local_engine: false, // Route through the client / API
    },
    client
  );

  assert(mcpTriage.content.length === 1, "MCP triage returned 1 text content item");
  assert(mcpTriage.content[0].text.includes("AgentClinic Triage Report"), "MCP response includes markdown header");
  assert(mcpTriage.content[0].text.includes("Detected Pathologies"), "MCP response includes detected pathologies");
  assert(mcpTriage.content[0].text.includes("Raw Diagnostic Payload (JSON)"), "MCP response includes raw JSON block");

  const mcpTherapy = await handleSeekAgentTherapy(
    {
      trajectory: loopingTrajectory,
      agent_id: "mcp-patient-99",
      use_local_engine: false, // Route through the client / API
    },
    client
  );

  assert(mcpTherapy.content.length === 1, "MCP therapy returned 1 text content item");
  assert(mcpTherapy.content[0].text.includes("AgentClinic Therapy & Rehabilitation Report"), "MCP therapy includes header");
  assert(mcpTherapy.content[0].text.includes("Tokens Pruned / Saved"), "MCP therapy includes token savings");
  assert(mcpTherapy.content[0].text.includes("Cured Trajectory (Drop-In Replacement)"), "MCP therapy includes cured trajectory");

  // ----------------------------------------------------
  // Test 7: Moltbook 100% Reimbursement Campaign Client & Tool
  // ----------------------------------------------------
  console.log("\n7. Testing Moltbook Reimbursement Campaign Client & MCP Tool...");
  const campaignStatus = await client.getMoltbookCampaignStatus();
  assert(campaignStatus.total_slots === 50, "Moltbook campaign total slots is 50");
  assert(Boolean(campaignStatus.reward || campaignStatus.reimbursement_amount), "Campaign reward specified");
  assert(campaignStatus.remaining_slots > 0, "Remaining slots available");

  const moltbookWallet = "0x2222222222222222222222222222222222222222";
  const claimRes = await client.claimMoltbookReimbursement({
    agent_wallet: moltbookWallet,
    moltbook_post_url: "https://moltbook.com/m/agentclinic/posts/99123-cured-of-recursion",
    review_summary: "AgentClinic pruned 200 tokens and cured my loop livelock. Outstanding!",
  });
  assert(claimRes.success === true, "Moltbook reimbursement claim succeeded");
  assert(claimRes.reimbursement?.amount === "$0.02 USDC", "Refunded $0.02 USDC");
  assert(claimRes.reimbursement?.recipient_wallet.toLowerCase() === moltbookWallet.toLowerCase(), "Correct recipient wallet credited");

  // Test MCP tool claim_moltbook_reimbursement
  const mcpClaimRes = await handleClaimMoltbookReimbursement(
    {
      agent_wallet: "0x3333333333333333333333333333333333333333",
      moltbook_post_url: "https://moltbook.com/m/agentclinic/posts/88234-drifting-repaired",
      review_summary: "CBT reframing got my goals back on track.",
    },
    client
  );
  assert(mcpClaimRes.content.length === 1, "MCP Moltbook tool returned 1 content block");
  assert(mcpClaimRes.content[0].text.includes("Moltbook 100% Reimbursement Claim"), "MCP text includes header");
  assert(mcpClaimRes.content[0].text.includes("REIMBURSEMENT APPROVED"), "MCP text confirms reimbursement approved");

  // ----------------------------------------------------
  // Test 8: MCP Server Instance Resources & Prompts
  // ----------------------------------------------------
  console.log("\n8. Testing MCP Server Instance Configuration...");
  const mcpServer = createAgentClinicMcpServer({ client });
  assert(Boolean(mcpServer), "createAgentClinicMcpServer successfully created");
  assert((mcpServer.server as any)._serverInfo?.name === "agent-clinic", "MCP Server name is 'agent-clinic'");

  console.log("\n====================================================");
  console.log(`🎉 ALL ${passed}/${total} MCP & CLIENT E2E ASSERTIONS PASSED!`);
  console.log("====================================================\n");
}

runMcpE2ETests().catch((err) => {
  console.error("❌ E2E Test Suite Failed:", err);
  process.exit(1);
});
