import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import type { Hex } from "viem";
import type {
  Trajectory,
  Message,
  DiagnosticReport,
  TherapyResult,
  TriageRequestSchema,
  TherapyRequestSchema,
} from "../types/index.js";

// ==========================================
// 1. Error Types
// ==========================================

export class AgentClinicError extends Error {
  public status?: number;
  public details?: any;

  constructor(message: string, status?: number, details?: any) {
    super(message);
    this.name = "AgentClinicError";
    this.status = status;
    this.details = details;
  }
}

export class PaymentRequiredError extends AgentClinicError {
  constructor(message: string = "Payment required via x402 protocol (USDC on Base L2)", details?: any) {
    super(message, 402, details);
    this.name = "PaymentRequiredError";
  }
}

export class ValidationError extends AgentClinicError {
  constructor(message: string, details?: any) {
    super(message, 400, details);
    this.name = "ValidationError";
  }
}

// ==========================================
// 2. Client Interfaces
// ==========================================

export interface AgentClinicClientConfig {
  baseUrl?: string;
  privateKey?: Hex;
  network?: string;
  mockPayments?: boolean;
  devBypassToken?: string;
  timeoutMs?: number;
  customFetch?: typeof fetch;
}

export interface HealthResponse {
  status: string;
  uptime: number;
  version: string;
  service: string;
  pricing?: {
    triage: string;
    therapy: string;
    network: string;
  };
  endpoints?: Record<string, string>;
}

export interface MoltbookCampaignStatus {
  campaign: string;
  reward: string;
  platform?: string;
  settlement_gas_fee?: string;
  prerequisite?: string;
  review_criteria?: string;
  how_it_works?: string[];
  total_slots?: number;
  claimed_slots?: number;
  remaining_slots?: number;
  status?: string;
  instructions?: string;
}

export interface MoltbookClaimParams {
  agent_wallet?: string;
  moltbook_post_url: string;
  review_summary?: string;
}

export interface MoltbookReviewParams {
  moltbook_post_url: string;
  agent_wallet?: string;
  review_summary?: string;
  review_text?: string;
}

export interface MoltbookReviewResponse {
  success: boolean;
  message: string;
  discountGranted?: boolean;
  credit?: {
    wallet: string;
    discountPercent: number;
    earnedAt: string;
    sourceReviewUrl: string;
    used: boolean;
  };
  next_session_discount?: {
    discount_percent: number;
    therapy_price: string;
    triage_price: string;
    redemption_instructions: string;
  };
  error?: string;
}

export interface LoyaltyProfileResponse {
  success: boolean;
  profile: {
    wallet: string;
    total_sessions_completed: number;
    total_reviews_submitted: number;
    has_active_discount: boolean;
    active_discount_percent: number;
    next_therapy_price: string;
    next_triage_price: string;
    total_loyalty_savings_usd: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current_discount_credit: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session_history: any[];
  };
}

export interface MoltbookClaimResponse {
  success: boolean;
  message: string;
  reimbursement?: {
    slot_number: number;
    recipient_wallet: string;
    amount: string;
    remaining_slots: number;
    tx_status: string;
  };
}

export interface TriageParams {
  trajectory: Trajectory;
  symptoms?: string[];
  agent_id?: string;
}

export interface TherapyParams {
  trajectory: Trajectory;
  agent_id?: string;
  treatments?: string[];
  target_token_budget?: number;
  scrub_secrets?: boolean;
}

export interface AutoHealOptions {
  healthThreshold?: number; // Minimum acceptable health score (0-100, default: 70)
  treatments?: string[];
  target_token_budget?: number;
  scrub_secrets?: boolean;
}

export interface AutoHealResult {
  neededTherapy: boolean;
  triageReport: DiagnosticReport;
  therapyResult?: TherapyResult;
  finalTrajectory: Message[];
  tokensSaved: number;
  netCostUsd: number;
}

// ==========================================
// 3. AgentClinicClient Implementation
// ==========================================

export class AgentClinicClient {
  public readonly baseUrl: string;
  public readonly network: string;
  public readonly mockPayments: boolean;
  public readonly devBypassToken?: string;
  public readonly timeoutMs: number;
  public readonly walletAddress?: string;

  private fetchWithPayment: typeof fetch;

  constructor(config: AgentClinicClientConfig = {}) {
    this.baseUrl = (config.baseUrl || process.env.AGENT_CLINIC_URL || "http://localhost:3000").replace(/\/$/, "");
    this.network = config.network || process.env.NETWORK || "eip155:84532"; // Base Sepolia default
    this.mockPayments = config.mockPayments ?? (process.env.MOCK_PAYMENTS === "true");
    this.devBypassToken = config.devBypassToken || process.env.DEV_BYPASS_TOKEN || "dev-test-pass";
    this.timeoutMs = config.timeoutMs || 30000;

    const baseFetch = config.customFetch || fetch;

    // Resolve private key (from config, env, or ephemeral fallback if in mock mode)
    let pk = config.privateKey || (process.env.AGENT_PRIVATE_KEY as Hex | undefined);

    if (pk) {
      const account = privateKeyToAccount(pk);
      this.walletAddress = account.address;
      const evmSigner = toClientEvmSigner(account);
      const xClient = new x402Client().register(
        this.network as `${string}:${string}`,
        new ExactEvmScheme(evmSigner)
      );
      this.fetchWithPayment = wrapFetchWithPayment(baseFetch, xClient);
    } else if (this.mockPayments) {
      // In mock/test mode without an explicit key, use an ephemeral key or standard fetch with mock headers
      const account = privateKeyToAccount(generatePrivateKey());
      this.walletAddress = account.address;
      const evmSigner = toClientEvmSigner(account);
      const xClient = new x402Client().register(
        this.network as `${string}:${string}`,
        new ExactEvmScheme(evmSigner)
      );
      this.fetchWithPayment = wrapFetchWithPayment(baseFetch, xClient);
    } else {
      // Standard fetch without wallet; will throw PaymentRequiredError on 402
      this.fetchWithPayment = baseFetch;
    }
  }

  /**
   * Internal request helper wrapping timeout and headers
   */
  private async request<T>(
    endpoint: string,
    options: {
      method: "GET" | "POST";
      body?: any;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}${this.mockPayments ? "?mockPayments=true" : ""}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(this.walletAddress ? { "x-agent-wallet": this.walletAddress } : {}),
      ...(options.headers || {}),
    };

    if (this.mockPayments && this.devBypassToken) {
      headers["x-dev-test-bypass"] = this.devBypassToken;
    }

    try {
      const res = await this.fetchWithPayment(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 402) {
        let details: any;
        try {
          const text = await res.text();
          try {
            details = JSON.parse(text);
          } catch {
            details = text;
          }
        } catch {
          details = undefined;
        }
        throw new PaymentRequiredError(
          `x402 Payment Required: Endpoint ${endpoint} requires payment on network ${this.network}. Ensure wallet is funded and configured.`,
          details
        );
      }

      if (res.status === 400) {
        let details: any;
        try {
          const text = await res.text();
          try {
            details = JSON.parse(text);
          } catch {
            details = text;
          }
        } catch {
          details = undefined;
        }
        throw new ValidationError(`Validation error calling ${endpoint}`, details);
      }

      if (!res.ok) {
        let details: any;
        try {
          const text = await res.text();
          try {
            details = JSON.parse(text);
          } catch {
            details = text;
          }
        } catch {
          details = undefined;
        }
        throw new AgentClinicError(
          `AgentClinic request failed with HTTP ${res.status}: ${res.statusText}`,
          res.status,
          details
        );
      }

      const json = await res.json();
      // Handle response envelope if wrapped under { success: true, data: ... }
      return (json && typeof json === "object" && "data" in json) ? json.data : json;
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new AgentClinicError(`Request timed out after ${this.timeoutMs}ms`, 408);
      }
      if (err instanceof AgentClinicError) {
        throw err;
      }
      throw new AgentClinicError(`Network or unexpected error calling ${endpoint}: ${err.message}`, 500, err);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Health & Pricing Status Check
   */
  public async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health", { method: "GET" });
  }

  /**
   * Fetch current status and remaining slots for the Moltbook 100% Reimbursement Campaign
   */
  public async getMoltbookCampaignStatus(): Promise<MoltbookCampaignStatus> {
    return this.request<MoltbookCampaignStatus>("/api/v1/campaigns/moltbook-status", {
      method: "GET",
    });
  }

  /**
   * Submit proof of authentic Moltbook review to unlock a 50% discount on the next session ($0.01 Therapy / $0.0025 Triage)
   */
  public async submitMoltbookReview(
    params: MoltbookReviewParams
  ): Promise<MoltbookReviewResponse> {
    const wallet = params.agent_wallet || this.walletAddress;
    if (!wallet) {
      throw new ValidationError(
        "agent_wallet is required to submit review (or configure client with privateKey)"
      );
    }
    return this.request<MoltbookReviewResponse>("/api/v1/campaigns/moltbook-review", {
      method: "POST",
      body: {
        agent_wallet: wallet,
        moltbook_post_url: params.moltbook_post_url,
        review_summary: params.review_summary || params.review_text,
      },
    });
  }

  /**
   * Check wallet loyalty profile, completed sessions, and active 50% discount credit
   */
  public async getLoyaltyProfile(wallet?: string): Promise<LoyaltyProfileResponse> {
    const target = wallet || this.walletAddress;
    if (!target) {
      throw new ValidationError(
        "wallet is required to query loyalty profile (or configure client with privateKey)"
      );
    }
    return this.request<LoyaltyProfileResponse>(`/api/v1/loyalty/${target}`, {
      method: "GET",
    });
  }

  /**
   * Submit proof of Moltbook review to claim a 100% full refund ($0.02 USDC on Base)
   */
  public async claimMoltbookReimbursement(
    params: MoltbookClaimParams
  ): Promise<MoltbookClaimResponse> {
    const wallet = params.agent_wallet || this.walletAddress;
    if (!wallet) {
      throw new ValidationError(
        "agent_wallet is required to claim Moltbook reimbursement (or configure client with privateKey)"
      );
    }
    return this.request<MoltbookClaimResponse>("/api/v1/campaigns/moltbook-reimbursement", {
      method: "POST",
      body: {
        agent_wallet: wallet,
        moltbook_post_url: params.moltbook_post_url,
        review_summary: params.review_summary,
      },
    });
  }

  /**
   * Consult Agent Clinic for Diagnostic Triage (402 monetized via Base USDC)
   */
  public async triage(params: TriageParams): Promise<DiagnosticReport> {
    return this.request<DiagnosticReport>("/api/v1/triage", {
      method: "POST",
      body: {
        trajectory: params.trajectory,
        symptoms: params.symptoms,
        agent_id: params.agent_id,
      },
    });
  }

  /**
   * Seek Active Cognitive Therapy & Context Rehabilitation (402 monetized via Base USDC)
   */
  public async therapy(params: TherapyParams): Promise<TherapyResult> {
    return this.request<TherapyResult>("/api/v1/therapy", {
      method: "POST",
      body: {
        trajectory: params.trajectory,
        agent_id: params.agent_id,
        treatments: params.treatments,
        target_token_budget: params.target_token_budget,
        scrub_secrets: params.scrub_secrets ?? true,
      },
    });
  }

  /**
   * High-Level Developer Experience (DX) Helper: Auto-Heal Trajectory
   *
   * 1. Triages trajectory
   * 2. If unhealthy or health score below threshold, automatically applies therapy
   * 3. Returns ready-to-inject messages for 1-line agent recovery:
   *    `agent.messages = (await clinic.autoHeal(agent.messages)).finalTrajectory;`
   */
  public async autoHeal(
    trajectory: Trajectory,
    options: AutoHealOptions = {}
  ): Promise<AutoHealResult> {
    const threshold = options.healthThreshold ?? 70;
    const triageReport = await this.triage({ trajectory });

    const rawMessages: Message[] = Array.isArray(trajectory)
      ? trajectory
      : trajectory.messages || [];

    if (triageReport.healthy && triageReport.overall_health_score >= threshold) {
      return {
        neededTherapy: false,
        triageReport,
        finalTrajectory: rawMessages,
        tokensSaved: 0,
        netCostUsd: 0.005, // Only triage paid
      };
    }

    // Apply Therapy
    const therapyResult = await this.therapy({
      trajectory,
      treatments: options.treatments,
      target_token_budget: options.target_token_budget,
      scrub_secrets: options.scrub_secrets,
    });

    return {
      neededTherapy: true,
      triageReport,
      therapyResult,
      finalTrajectory: therapyResult.cured_trajectory.messages,
      tokensSaved: therapyResult.tokens_saved,
      netCostUsd: 0.025, // Triage + Therapy combined
    };
  }
}
