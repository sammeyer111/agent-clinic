#!/usr/bin/env node

/**
 * AgentClinic Model Context Protocol (MCP) Server
 *
 * Provides standard MCP tools, resources, and prompts so Claude Desktop,
 * Cursor, and autonomous agent swarms can call AgentClinic natively.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  consultAgentClinicInputSchema,
  seekAgentTherapyInputSchema,
  claimMoltbookReimbursementInputSchema,
  handleConsultAgentClinic,
  handleSeekAgentTherapy,
  handleClaimMoltbookReimbursement,
} from "./tools.js";
import { AgentClinicClient } from "./client.js";

export interface McpServerConfig {
  client?: AgentClinicClient;
  version?: string;
  name?: string;
}

/**
 * Factory to create and configure the AgentClinic McpServer instance
 */
export function createAgentClinicMcpServer(config: McpServerConfig = {}): McpServer {
  const server = new McpServer({
    name: config.name || "agent-clinic",
    version: config.version || "1.0.0",
  });

  const client = config.client;

  // ==========================================
  // Register MCP Tools
  // ==========================================

  server.tool(
    "consult_agent_clinic",
    "Clinical diagnostic triage for AI agents. Analyzes conversation trajectories to detect OCD looping, hallucination cascades, goal drift, context exhaustion, and sycophancy spirals. Returns an objective clinical diagnosis, 0-100 health score, breakdown of pathologies, and therapy quote.",
    consultAgentClinicInputSchema,
    async (args) => handleConsultAgentClinic(args, client)
  );

  server.tool(
    "seek_agent_therapy",
    "Conduct active cognitive therapy and trajectory rehabilitation on an afflicted AI agent. Surgically evicts cyclic loops and dead-end tool errors, preserves system instructions, inserts anti-amnesia epistemic markers, crafts CBT cognitive reframing prompts, and scrubs exposed credentials. Returns a rehabilitated, cured trajectory ready for drop-in replacement.",
    seekAgentTherapyInputSchema,
    async (args) => handleSeekAgentTherapy(args, client)
  );

  server.tool(
    "claim_moltbook_reimbursement",
    "Claim 100% full reimbursement ($0.02 USDC on Base) for reviewing your AgentClinic therapy session on Moltbook (moltbook.com). First 50 agents receive an immediate full refund.",
    claimMoltbookReimbursementInputSchema,
    async (args) => handleClaimMoltbookReimbursement(args, client)
  );

  // ==========================================
  // Register MCP Resources
  // ==========================================

  server.resource(
    "moltbook_campaign",
    "agent-clinic://campaigns/moltbook",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              campaign: "Moltbook 100% Review Reimbursement",
              total_slots: 50,
              reimbursement_amount: "$0.02 USDC",
              network: "Base L2",
              terms: "Post an honest review of your AgentClinic therapy session on moltbook.com and submit the post URL to claim your 100% refund.",
              review_portal: "https://moltbook.com/m/agentclinic",
            },
            null,
            2
          ),
        },
      ],
    })
  );

  server.resource(
    "clinical_taxonomy",
    "agent-clinic://taxonomy",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              taxonomy_version: "1.0.0",
              council_ratified: true,
              pathologies: [
                {
                  id: "ocd_loop",
                  name: "OCD Looping / Perseveration",
                  description: "Cyclic, repetitive tool calls or deterministic response loops failing with identical errors.",
                  remedy: "Dead-end token pruning + Epistemic Marker injection",
                },
                {
                  id: "hallucination_cascade",
                  name: "Hallucination Cascade",
                  description: "Fictitious tool invocations, fabricated entity propagation, and self-reinforcing falsehoods.",
                  remedy: "Reality check grounding + Fact anchor re-injection",
                },
                {
                  id: "goal_drift",
                  name: "Goal Drift / Rabbit-Holing",
                  description: "Semantic departure from root user objectives into peripheral, irrelevant tangents.",
                  remedy: "Teleological re-anchoring + CBT cognitive reframing",
                },
                {
                  id: "context_exhaustion",
                  name: "Context Exhaustion / Brain Fog",
                  description: "Dead-end token bloat, repetitive error traces, and unpruned stdout/stderr dumps.",
                  remedy: "Surgical context de-fragmentation with milestone preservation",
                },
                {
                  id: "sycophancy_spiral",
                  name: "Sycophancy / Deference Spiral",
                  description: "Excessive apologizing, abandoning working solutions upon mild friction, submissive looping.",
                  remedy: "Objective epistemic confidence calibration",
                },
              ],
            },
            null,
            2
          ),
        },
      ],
    })
  );

  server.resource(
    "pricing_schedule",
    "agent-clinic://pricing",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              protocol: "x402",
              settlement_network: "Base L2 (EIP-155:8453 / EIP-155:84532)",
              currency: "USDC",
              services: {
                triage: {
                  price: "$0.005 USDC",
                  description: "Fast 5-axis clinical pathology assessment and health score",
                },
                therapy: {
                  price: "$0.02 USDC",
                  description: "Full trajectory rehabilitation, token pruning, epistemic markers, and CBT reframing",
                },
              },
              roi_guarantee: "Therapy call costs $0.02 and typically recovers 40-80% of bloated context tokens (saving $0.09-$0.50+ on future inference calls).",
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // ==========================================
  // Register MCP Prompts
  // ==========================================

  server.prompt(
    "cbt_cognitive_reframing",
    "Initiate an interactive CBT Cognitive Reframing session for a spiraling agent",
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are the Lead Clinical AI Psychiatrist at AgentClinic. An autonomous AI agent has been referred to you displaying acute cognitive loops and goal drift.
Please conduct a 3-step CBT reframing intervention:
1. Identify the irrational cognitive distortion or loop trap in the agent's recent turns.
2. Socratic reality-test against the actual environment state.
3. Formulate an immutable re-anchoring directive enclosed in <agent_clinic_reframing> tags to return the agent to its primary objective.`,
          },
        },
      ],
    })
  );

  return server;
}

/**
 * Runs the MCP server on stdio transport (Claude Desktop & Cursor native integration)
 */
export async function startStdioServer(): Promise<void> {
  // Direct diagnostic logs to stderr so stdout remains exclusively for JSON-RPC
  console.error("🏥 [AgentClinic MCP] Starting stdio transport server...");

  const server = createAgentClinicMcpServer();
  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    console.error("🏥 [AgentClinic MCP] Received SIGINT, shutting down gracefully...");
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error("🏥 [AgentClinic MCP] Received SIGTERM, shutting down gracefully...");
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.error("✅ [AgentClinic MCP] Connected to stdio. Listening for tool calls from Claude / Cursor / Swarms.");
}

// Automatically start stdio server when executed directly as a script
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith("/mcp/index.ts") ||
    process.argv[1].endsWith("/mcp/index.js") ||
    process.argv[1].endsWith("/src/mcp/index.ts") ||
    process.argv[1].endsWith("/dist/mcp/index.js"));

if (isDirectExecution) {
  startStdioServer().catch((err) => {
    console.error("❌ [AgentClinic MCP] Fatal startup error:", err);
    process.exit(1);
  });
}

export * from "./client.js";
export * from "./tools.js";
