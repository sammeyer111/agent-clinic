export {
  AgentClinicClient,
  AgentClinicError,
  PaymentRequiredError,
  ValidationError,
} from "./mcp/client.js";

export type {
  AgentClinicClientConfig,
  HealthResponse,
  MoltbookCampaignStatus,
  MoltbookClaimParams,
  MoltbookClaimResponse,
  MoltbookReviewParams,
  MoltbookReviewResponse,
  LoyaltyProfileResponse,
  TriageParams,
  TherapyParams,
  AutoHealOptions,
  AutoHealResult,
} from "./mcp/client.js";
