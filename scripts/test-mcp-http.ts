import app from "../src/server.js";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(red(`❌ ASSERTION FAILED: ${msg}`));
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(green(`  ✓ ${msg}`));
}

async function run() {
  console.log(bold(cyan("\n=======================================================")));
  console.log(bold(cyan("🧪 TESTING REMOTE STREAMABLE HTTP MCP & CLINICAL INDEX")));
  console.log(bold(cyan("=======================================================\n")));

  // 1. Test Epidemiological Clinical Index
  console.log(bold("1. Testing GET /api/v1/clinical/index"));
  const indexRes = await app.request("/api/v1/clinical/index");
  assert(indexRes.status === 200, "Clinical index returns HTTP 200 OK");
  const indexData = await indexRes.json();
  assert(indexData.clinical_standard === "DSM-AI V1.0", "Clinical standard is DSM-AI V1.0");
  assert(indexData.clinical_efficacy_metrics.clinical_remission_rate === "100%", "Remission rate is 100%");
  assert(Boolean(indexData.pathology_distribution.ocd_recursion_loops), "Pathology distribution includes OCD loops");

  // 2. Test Streamable HTTP MCP - Initialize Request
  console.log(bold("\n2. Testing POST /mcp (JSON-RPC initialize)"));
  const initReq = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-cloud-agent-client",
        version: "1.0.0",
      },
    },
  };

  const mcpInitRes = await app.request("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(initReq),
  });

  assert(mcpInitRes.status === 200, `POST /mcp initialize returns HTTP 200 (got ${mcpInitRes.status})`);
  const sessionId = mcpInitRes.headers.get("mcp-session-id") || "";
  assert(Boolean(sessionId), "Server returned mcp-session-id header");

  const initJson = await mcpInitRes.json();
  assert(initJson.jsonrpc === "2.0", "JSON-RPC response matches 2.0");
  assert(initJson.result?.serverInfo?.name === "agent-clinic", "Server name is 'agent-clinic'");
  assert(Boolean(initJson.result?.capabilities?.tools), "Server advertises tool capabilities");

  // 3. Send notifications/initialized per MCP standard
  console.log(bold("\n3. Testing POST /mcp (notifications/initialized)"));
  const notifRes = await app.request("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  assert(notifRes.status === 200 || notifRes.status === 202 || notifRes.status === 204, `notifications/initialized handled (got ${notifRes.status})`);

  // 4. Test Streamable HTTP MCP - tools/list Request
  console.log(bold("\n4. Testing POST /mcp (JSON-RPC tools/list)"));
  const toolsReq = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  };

  const mcpToolsRes = await app.request("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify(toolsReq),
  });

  assert(mcpToolsRes.status === 200, `POST /mcp tools/list returns HTTP 200 (got ${mcpToolsRes.status})`);
  const toolsJson = await mcpToolsRes.json();
  const toolNames = toolsJson.result?.tools?.map((t: any) => t.name) || [];
  assert(toolNames.includes("consult_agent_clinic"), "Tools include 'consult_agent_clinic'");
  assert(toolNames.includes("seek_agent_therapy"), "Tools include 'seek_agent_therapy'");

  console.log(bold(green("\n✨ ALL STREAMABLE HTTP MCP TESTS PASSED!\n")));
}

run().catch((err) => {
  console.error(red("Test failed:"), err);
  process.exit(1);
});
