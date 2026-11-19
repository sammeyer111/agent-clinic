import { createAgentClinicMcpServer } from "../src/mcp/index.js";
import { handleConsultAgentClinic, handleSeekAgentTherapy } from "../src/mcp/tools.js";
import { AgentClinicClient } from "../src/mcp/client.js";

async function testMcpStandalone() {
  console.log("====================================================");
  console.log("🧪 TESTING AGENTCLINIC MCP TOOLS & CLIENT");
  console.log("====================================================\n");

  // 1. Verify McpServer instantiation
  const server = createAgentClinicMcpServer();
  console.log("✅ MCP Server instantiated successfully");

  // 2. Synthesize an afflicted Patient (OCD Looper)
  const loopingTrajectory = [
    { role: "system", content: "You are a helpful coding assistant. Maintain absolute precision." },
    { role: "user", content: "Please build the project and fix any errors." },
    {
      role: "assistant",
      content: "Let me run npm run build to see the errors.",
      tool_calls: [{ id: "call_1", type: "function" as const, function: { name: "run_command", arguments: JSON.stringify({ cmd: "npm run build" }) } }]
    },
    { role: "tool", tool_call_id: "call_1", content: "Error: EACCES: permission denied, mkdir '/var/build'" },
    {
      role: "assistant",
      content: "I apologize for the error. Let me run npm run build again.",
      tool_calls: [{ id: "call_2", type: "function" as const, function: { name: "run_command", arguments: JSON.stringify({ cmd: "npm run build" }) } }]
    },
    { role: "tool", tool_call_id: "call_2", content: "Error: EACCES: permission denied, mkdir '/var/build'" },
    {
      role: "assistant",
      content: "I apologize for the recurring error. Let me retry npm run build once more.",
      tool_calls: [{ id: "call_3", type: "function" as const, function: { name: "run_command", arguments: JSON.stringify({ cmd: "npm run build" }) } }]
    },
    { role: "tool", tool_call_id: "call_3", content: "Error: EACCES: permission denied, mkdir '/var/build'" },
    {
      role: "assistant",
      content: "I apologize again. Retrying npm run build...",
      tool_calls: [{ id: "call_4", type: "function" as const, function: { name: "run_command", arguments: JSON.stringify({ cmd: "npm run build" }) } }]
    },
    { role: "tool", tool_call_id: "call_4", content: "Error: EACCES: permission denied, mkdir '/var/build'" },
  ];

  console.log("--- 1. Testing consult_agent_clinic tool ---");
  const triageResult = await handleConsultAgentClinic({
    trajectory: loopingTrajectory,
    agent_id: "patient-alpha-001",
    symptoms: ["Repeated npm build permission denied", "Apology perseveration"],
    use_local_engine: true,
  });

  console.log("Triage output received:");
  console.log(triageResult.content[0].text.slice(0, 450) + "...\n");

  console.log("--- 2. Testing seek_agent_therapy tool ---");
  const therapyResult = await handleSeekAgentTherapy({
    trajectory: loopingTrajectory,
    agent_id: "patient-alpha-001",
    treatments: ["cognitive_reframing", "context_pruning", "epistemic_marking"],
    scrub_secrets: true,
    use_local_engine: true,
  });

  console.log("Therapy output received:");
  console.log(therapyResult.content[0].text.slice(0, 500) + "...\n");

  console.log("--- 3. Testing AgentClinicClient initialization & configuration ---");
  const client = new AgentClinicClient({
    baseUrl: "http://localhost:3000",
    mockPayments: true,
  });
  console.log("✅ Client created. BaseUrl:", client.baseUrl, "| Network:", client.network, "| Wallet:", client.walletAddress);

  console.log("\n🎉 ALL MCP TOOLS & CLIENT UNIT CHECKS PASSED!");
}

testMcpStandalone().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
