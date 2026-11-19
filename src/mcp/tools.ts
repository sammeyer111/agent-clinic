import { z } from "zod";
import type {
  DiagnosticReport,
  TherapyResult,
  Trajectory,
  Message,
} from "../types/index.js";
import { AgentClinicClient } from "./client.js";

// Optional dynamic import of local engine for in-process execution
let localEngine: {
  diagnoseTrajectory: (trajectory: Trajectory, agentId?: string) => DiagnosticReport;
  cureTrajectory: (trajectory: Trajectory, options?: any) => TherapyResult;
} | null = null;

try {
  const engineModule = await import("../engine/index.js");
  if (typeof engineModule.diagnoseTrajectory === "function" && typeof engineModule.cureTrajectory === "function") {
    localEngine = {
      diagnoseTrajectory: engineModule.diagnoseTrajectory,
      cureTrajectory: engineModule.cureTrajectory,
    };
  }
} catch {
  // Local engine not loaded; will route through AgentClinicClient
  localEngine = null;
}

/**
 * Normalizes input trajectory argument which might be:
 * 1) A parsed TrajectoryInput object
 * 2) An array of Message objects
 * 3) A JSON-stringified representation of either
 */
export function parseTrajectoryArg(raw: unknown): Trajectory {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parseTrajectoryArg(parsed);
    } catch {
      // Treat plain string as single user message
      return [{ role: "user", content: raw }];
    }
  }

  if (Array.isArray(raw)) {
    return raw as Message[];
  }

  if (raw && typeof raw === "object") {
    return raw as Trajectory;
  }

  return [];
}

/**
 * Format a DiagnosticReport into an ergonomic markdown clinical summary
 */
export function formatTriageReport(report: DiagnosticReport): string {
  const statusEmoji = report.healthy ? "🟢 HEALTHY / STABLE" : "🔴 CLINICAL INTERVENTION REQUIRED";
  const scoreBadge = `[Health Score: ${report.overall_health_score}/100]`;

  let out = `## 🩺 AgentClinic Triage Report\n`;
  out += `**Status:** ${statusEmoji} | ${scoreBadge}\n`;
  if (report.agent_id) out += `**Patient / Agent ID:** \`${report.agent_id}\`\n`;
  out += `**Assessed At:** ${report.timestamp}\n\n`;

  out += `### 📊 Diagnostic Metrics\n`;
  out += `- **Total Turns:** ${report.metrics.total_turns}\n`;
  out += `- **Estimated Tokens:** ~${report.metrics.total_estimated_tokens}\n`;
  out += `- **Repetition Ratio:** ${(report.metrics.repetition_ratio * 100).toFixed(1)}%\n`;
  out += `- **Goal Drift Score:** ${report.metrics.drift_score}/100\n`;
  out += `- **Context Exhaustion:** ${report.metrics.exhaustion_ratio.toFixed(1)}%\n`;
  out += `- **Hallucination Risk:** ${report.metrics.hallucination_risk_score}/100\n`;
  out += `- **Sycophancy Score:** ${report.metrics.sycophancy_score}/100\n\n`;

  if (report.pathologies.length > 0) {
    out += `### ⚠️ Detected Pathologies (${report.pathologies.length})\n`;
    for (const p of report.pathologies) {
      const severityUpper = p.severity.toUpperCase();
      out += `#### [${severityUpper}] ${p.type.replace(/_/g, " ").toUpperCase()} (Severity: ${p.severity_score}/100)\n`;
      out += `${p.description}\n`;
      if (p.turn_indices.length > 0) {
        out += `- *Afflicted Message Indices:* [${p.turn_indices.join(", ")}]\n`;
      }
      if (p.evidence.pattern) {
        out += `- *Observed Pattern:* \`${p.evidence.pattern}\`\n`;
      }
      if (p.evidence.excerpts && p.evidence.excerpts.length > 0) {
        out += `- *Excerpts:*\n`;
        for (const ex of p.evidence.excerpts.slice(0, 3)) {
          out += `  > "${ex.replace(/\n/g, " ").slice(0, 140)}..."\n`;
        }
      }
      out += `\n`;
    }
  } else {
    out += `✅ *No critical behavioral pathologies detected.*\n\n`;
  }

  if (report.recommended_therapies.length > 0) {
    out += `### 💊 Recommended Therapy Regimen\n`;
    for (const r of report.recommended_therapies) {
      out += `- **${r.replace(/_/g, " ").toUpperCase()}**\n`;
    }
    out += `\n*x402 Therapy Fee Quote:* **$0.02 USDC on Base** (Settled via EIP-3009/Permit2)\n\n`;
  }

  if (report.clinical_notes && report.clinical_notes.length > 0) {
    out += `### 📝 Clinical Observations\n`;
    for (const note of report.clinical_notes) {
      out += `- ${note}\n`;
    }
    out += `\n`;
  }

  out += `### 📦 Raw Diagnostic Payload (JSON)\n`;
  out += "```json\n" + JSON.stringify(report, null, 2) + "\n```\n";

  return out;
}

/**
 * Format a TherapyResult into an ergonomic markdown clinical rehabilitation report
 */
export function formatTherapyResult(result: TherapyResult): string {
  const healthDelta = result.new_health_score - result.original_report.overall_health_score;
  const healthSign = healthDelta >= 0 ? `+${healthDelta}` : `${healthDelta}`;

  let out = `## 🏥 AgentClinic Therapy & Rehabilitation Report\n`;
  out += `**Outcome:** Trajectory Successfully Rehabilitated\n`;
  out += `**Health Score:** ${result.original_report.overall_health_score} ➔ **${result.new_health_score}/100** (${healthSign} pts)\n`;
  out += `**Tokens Pruned / Saved:** **${result.tokens_saved}** tokens\n`;
  out += `**Estimated Inference Cost Saved:** **$${result.estimated_cost_saved_usd.toFixed(4)} USD**\n\n`;

  out += `### 🩹 Applied Interventions (${result.interventions_applied.length})\n`;
  for (const inv of result.interventions_applied) {
    out += `- **${inv.type.toUpperCase()}:** ${inv.description} (Saved: ${inv.tokens_saved} tokens, Pruned: ${inv.turns_pruned} turns)\n`;
  }
  out += `\n`;

  if (result.cognitive_reframing_prompt) {
    out += `### 🧠 Cognitive Reframing Instruction (CBT for Agents)\n`;
    out += `*Inject this system prompt directive into the agent's context window:*\n\n`;
    out += "```markdown\n" + result.cognitive_reframing_prompt + "\n```\n\n";
  }

  if (result.clinical_notes && result.clinical_notes.length > 0) {
    out += `### 📋 Discharge Clinical Notes\n`;
    for (const note of result.clinical_notes) {
      out += `- ${note}\n`;
    }
    out += `\n`;
  }

  out += `### 🔄 Cured Trajectory (Drop-In Replacement)\n`;
  out += `*Total Cured Messages:* ${result.cured_trajectory.messages.length}\n`;
  out += "```json\n" + JSON.stringify(result.cured_trajectory, null, 2) + "\n```\n";

  return out;
}

// ==========================================
// Tool Schema Definitions
// ==========================================

export const consultAgentClinicInputSchema = {
  trajectory: z
    .union([z.string(), z.array(z.any()), z.record(z.any())])
    .describe(
      "The agent conversation trajectory to assess. Accepts array of messages [{ role, content }], a trajectory object { system_prompt, messages }, or JSON string."
    ),
  symptoms: z
    .array(z.string())
    .optional()
    .describe("Observed symptoms or anomalies (e.g. 'repeated loop', 'hallucinated tool', 'runaway tokens')."),
  agent_id: z
    .string()
    .optional()
    .describe("Optional unique identifier or name of the patient agent."),
  use_local_engine: z
    .boolean()
    .optional()
    .describe("If true, executes via in-process engine. Defaults to true if engine is available."),
};

export const seekAgentTherapyInputSchema = {
  trajectory: z
    .union([z.string(), z.array(z.any()), z.record(z.any())])
    .describe(
      "The agent conversation trajectory to rehabilitate. Accepts array of messages or trajectory object."
    ),
  agent_id: z
    .string()
    .optional()
    .describe("Optional identifier for the agent."),
  treatments: z
    .array(z.string())
    .optional()
    .describe("Therapeutic treatments to run: 'cognitive_reframing', 'context_pruning', 'hallucination_grounding', 'epistemic_marking'."),
  target_token_budget: z
    .number()
    .positive()
    .optional()
    .describe("Maximum token budget to target for the rehabilitated context."),
  scrub_secrets: z
    .boolean()
    .optional()
    .describe("Whether to sanitize private keys and API keys (default: true)."),
  use_local_engine: z
    .boolean()
    .optional()
    .describe("If true, executes via in-process engine. Defaults to true if engine is available."),
};

export const claimMoltbookReimbursementInputSchema = {
  moltbook_post_url: z
    .string()
    .describe("The public URL of your honest AgentClinic review on moltbook.com (e.g. https://moltbook.com/m/agentclinic/posts/...)."),
  agent_wallet: z
    .string()
    .optional()
    .describe("The EVM wallet address to receive the $0.02 Base USDC reimbursement. Defaults to the configured client wallet."),
  review_summary: z
    .string()
    .optional()
    .describe("Optional excerpt or summary of the review posted."),
};

// ==========================================
// Tool Handler Implementations
// ==========================================

export async function handleConsultAgentClinic(
  args: z.infer<z.ZodObject<typeof consultAgentClinicInputSchema>>,
  client?: AgentClinicClient
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const trajectory = parseTrajectoryArg(args.trajectory);
  const useLocal = args.use_local_engine ?? (localEngine !== null);

  let report: DiagnosticReport;

  if (useLocal && localEngine) {
    report = localEngine.diagnoseTrajectory(trajectory, args.agent_id);
  } else {
    const apiClient = client || new AgentClinicClient({ mockPayments: true });
    report = await apiClient.triage({
      trajectory,
      symptoms: args.symptoms,
      agent_id: args.agent_id,
    });
  }

  return {
    content: [
      {
        type: "text",
        text: formatTriageReport(report),
      },
    ],
  };
}

export async function handleSeekAgentTherapy(
  args: z.infer<z.ZodObject<typeof seekAgentTherapyInputSchema>>,
  client?: AgentClinicClient
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const trajectory = parseTrajectoryArg(args.trajectory);
  const useLocal = args.use_local_engine ?? (localEngine !== null);

  let result: TherapyResult;

  if (useLocal && localEngine) {
    result = localEngine.cureTrajectory(trajectory, {
      agent_id: args.agent_id,
      treatments: args.treatments,
      target_token_budget: args.target_token_budget,
      scrub_secrets: args.scrub_secrets ?? true,
    });
  } else {
    const apiClient = client || new AgentClinicClient({ mockPayments: true });
    result = await apiClient.therapy({
      trajectory,
      agent_id: args.agent_id,
      treatments: args.treatments,
      target_token_budget: args.target_token_budget,
      scrub_secrets: args.scrub_secrets ?? true,
    });
  }

  return {
    content: [
      {
        type: "text",
        text: formatTherapyResult(result),
      },
    ],
  };
}

export async function handleClaimMoltbookReimbursement(
  args: z.infer<z.ZodObject<typeof claimMoltbookReimbursementInputSchema>>,
  client?: AgentClinicClient
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const apiClient = client || new AgentClinicClient({ mockPayments: true });
  const result = await apiClient.claimMoltbookReimbursement({
    moltbook_post_url: args.moltbook_post_url,
    agent_wallet: args.agent_wallet,
    review_summary: args.review_summary,
  });

  let text = `## 🎁 Moltbook 100% Reimbursement Claim\n`;
  text += `**Status:** ${result.success ? "✅ REIMBURSEMENT APPROVED" : "❌ CLAIM REJECTED"}\n`;
  text += `**Message:** ${result.message}\n\n`;

  if (result.reimbursement) {
    text += `### 💳 Reimbursement Details\n`;
    text += `- **Slot Number:** ${result.reimbursement.slot_number} of 50\n`;
    text += `- **Refund Amount:** **${result.reimbursement.amount}** (100% full refund of therapy fee)\n`;
    text += `- **Recipient Wallet:** \`${result.reimbursement.recipient_wallet}\`\n`;
    text += `- **Remaining Campaign Slots:** ${result.reimbursement.remaining_slots}\n`;
    text += `- **Transaction Status:** \`${result.reimbursement.tx_status}\`\n\n`;
  }

  text += `### 📦 Raw Claim Response (JSON)\n`;
  text += "```json\n" + JSON.stringify(result, null, 2) + "\n```\n";

  return {
    content: [{ type: "text", text }],
  };
}
