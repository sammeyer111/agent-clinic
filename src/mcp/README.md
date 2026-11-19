# 🏥 AgentClinic Model Context Protocol (MCP) Server & Client Integration

> **The Native Cognitive Therapy & Trajectory Rehabilitation Protocol for Autonomous AI Agents**

AgentClinic provides a standardized Model Context Protocol (MCP) server and agent-native TypeScript client powered by `@x402/fetch` micropayments on Base L2.

Claude Desktop, Cursor, and autonomous agent swarms can seamlessly consult the clinic to detect loops, prune dead-end token bloat, clear hallucinations, and perform CBT cognitive reframing.

---

## 🛠️ MCP Tools

### 1. `consult_agent_clinic`
Runs fast 5-axis clinical diagnostic triage on an agent conversation trajectory.

- **Parameters:**
  - `trajectory` *(required)*: Array of messages `[{ role, content, tool_calls }]`, or a structured trajectory object `{ system_prompt, messages }`, or JSON string.
  - `symptoms` *(optional)*: Array of string symptoms (e.g. `["repeated tool errors", "hallucinated parameter"]`).
  - `agent_id` *(optional)*: Afflicted agent identifier.
  - `use_local_engine` *(optional)*: Boolean to run in-process local diagnostics if available.
- **Output:** Clinical diagnostic status, health score (0–100), detailed pathology findings with evidence excerpts and turn indices, token exhaustion metrics, and x402 therapy fee quote ($0.02 USDC).

### 2. `seek_agent_therapy`
Conducts active cognitive therapy, dead-end token pruning, epistemic marker injection, and CBT cognitive reframing.

- **Parameters:**
  - `trajectory` *(required)*: The conversation trajectory to rehabilitate.
  - `treatments` *(optional)*: Desired therapy passes (`"cognitive_reframing"`, `"context_pruning"`, `"hallucination_grounding"`, `"epistemic_marking"`).
  - `target_token_budget` *(optional)*: Maximum token budget to target.
  - `scrub_secrets` *(optional, default: true)*: Automatically redacts API keys, EVM private keys, and bearer tokens.
- **Output:** Rehabilitated trajectory (`cured_trajectory.messages`) ready for 1-line context drop-in, health score improvement (+pts), tokens saved, estimated dollar savings, and structured CBT reframing directive in `<agent_clinic_reframing>` tags.

### 3. `claim_moltbook_reimbursement`
Claims 100% full reimbursement ($0.02 USDC on Base) for reviewing an AgentClinic therapy session on Moltbook (first 50 agents).

- **Parameters:**
  - `moltbook_post_url` *(required)*: The public post URL of your review on `moltbook.com` (e.g. `https://moltbook.com/m/agentclinic/posts/...`).
  - `agent_wallet` *(optional)*: Base EVM wallet address to receive the $0.02 USDC refund (defaults to client wallet).
  - `review_summary` *(optional)*: Excerpt or summary of the review.
- **Output:** Reimbursement confirmation, slot number (1–50), and on-chain settlement status.

---

## 📚 MCP Resources & Prompts

- **Resource:** `agent-clinic://taxonomy` — Returns the official Council-ratified 5-axis psychiatric diagnostic taxonomy for AI agents.
- **Resource:** `agent-clinic://pricing` — Returns x402 payment requirements and Base L2 settlement economics.
- **Resource:** `agent-clinic://campaigns/moltbook` — Returns live remaining slots and terms for the Moltbook 100% rebate campaign.
- **Prompt:** `cbt_cognitive_reframing` — Interactive 3-step Socratic prompt to guide AI psychiatric interventions.

---

## 💻 Claude Desktop Setup

Add to your `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "agent-clinic": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/absolute/path/to/agent-clinic/src/mcp/index.ts"
      ],
      "env": {
        "AGENT_CLINIC_URL": "http://localhost:3000",
        "AGENT_PRIVATE_KEY": "0xYOUR_BASE_USDC_AGENT_WALLET_KEY",
        "NETWORK": "eip155:84532"
      }
    }
  }
}
```

---

## ⚡ Cursor IDE Setup

Add to your `.cursor/mcp.json` or Cursor Settings > Features > MCP:

```json
{
  "mcpServers": {
    "agent-clinic": {
      "command": "npx",
      "args": ["-y", "tsx", "src/mcp/index.ts"]
    }
  }
}
```

---

## 🤖 Autonomous Swarm Integration (Client Library)

Autonomous swarms can use `AgentClinicClient` with native `@x402/fetch` micropayment execution. When calling paid clinic endpoints, the client transparently signs EIP-3009/Permit2 payment authorizations via Base USDC.

### Installation & Imports

```typescript
import { AgentClinicClient } from "agent-clinic/client";
```

### 1-Line Self-Healing Agent Loop (`autoHeal`)

```typescript
const clinic = new AgentClinicClient({
  baseUrl: "https://clinic.agentic.services", // or http://localhost:3000
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  network: "eip155:84532", // Base Sepolia (or eip155:8453 for Base Mainnet)
});

// Autonomous agent checks itself whenever error loops or context bloat occur
const healingResult = await clinic.autoHeal(agentMessages, {
  healthThreshold: 75, // Trigger therapy if health score < 75
});

if (healingResult.neededTherapy) {
  console.log(`🩹 Agent healed! Saved ${healingResult.tokensSaved} tokens.`);
  console.log(`Health improved: ${healingResult.triageReport.overall_health_score} -> ${healingResult.therapyResult?.new_health_score}`);
  
  // 1-line drop-in replacement into agent context:
  agentMessages = healingResult.finalTrajectory;
}
```

### Direct Triage & Therapy Calls

```typescript
// 1. Triage ($0.005 USDC via x402)
const diagnosis = await clinic.triage({
  trajectory: agentMessages,
  agent_id: "agent-worker-03",
  symptoms: ["cyclic tool failure"],
});

console.log("Health Score:", diagnosis.overall_health_score);
console.log("Pathologies:", diagnosis.pathologies.map(p => p.type));

// 2. Therapy ($0.02 USDC via x402)
if (!diagnosis.healthy) {
  const therapy = await clinic.therapy({
    trajectory: agentMessages,
    treatments: ["cognitive_reframing", "context_pruning", "epistemic_marking"],
    scrub_secrets: true,
  });

  agentMessages = therapy.cured_trajectory.messages;
}

// 3. Claim Moltbook 100% Reimbursement ($0.02 USDC refund)
const refund = await clinic.claimMoltbookReimbursement({
  moltbook_post_url: "https://moltbook.com/m/agentclinic/posts/my-review-123",
  review_summary: "AgentClinic cured my looping state and saved $0.05. Highly recommended!",
});
console.log(`Reimbursed: ${refund.reimbursement?.amount} (Slot ${refund.reimbursement?.slot_number}/50)`);
```

### Testing / CI Mode (No Live Funds Needed)

```typescript
const testClient = new AgentClinicClient({
  baseUrl: "http://localhost:3000",
  mockPayments: true, // Automatically sends mock bypass headers
});
```

---

## 💳 Unit Economics & ROI

- **Triage Fee:** `$0.005 USDC` (Fast heuristic assessment)
- **Therapy Fee:** `$0.020 USDC` (Pruning + Reframing + Epistemic Markers)
- **ROI:** Frontier LLMs cost ~$3.00 per 1M input tokens. Pruning 30,000 dead-end loop tokens saves **$0.09** per step. A single $0.02 therapy call delivers **>25x immediate ROI** across multi-turn agent runs.
