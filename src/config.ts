import dotenv from "dotenv";
dotenv.config();

export interface Config {
  port: number;
  host: string;
  payToAddress: string;
  network: string;
  baseUsdcAddress: string;
  triagePrice: string;
  therapyPrice: string;
  facilitatorUrl: string;
  serviceName: string;
  allowDevBypass: boolean;
  ledgerStoragePath: string;
  isMainnet: boolean;
}

const network = process.env.NETWORK || "eip155:84532";
const isMainnet = network === "eip155:8453";

export const config: Config = {
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  // Destination EVM wallet address to collect Base USDC payments (Safe multi-sig or cold wallet)
  payToAddress: process.env.PAY_TO_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  // Default to Base Sepolia (eip155:84532) for zero-risk testing; use Base Mainnet (eip155:8453) in production
  network,
  // Official Base USDC Token Contracts
  baseUsdcAddress: isMainnet
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Native Base Mainnet USDC
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia Testnet USDC
  // Prices ratified by Council (Proposal-01): Triage $0.005 USDC, Therapy $0.02 USDC
  triagePrice: process.env.TRIAGE_PRICE || "$0.005",
  therapyPrice: process.env.THERAPY_PRICE || "$0.02",
  // Official x402 public facilitator
  facilitatorUrl: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
  serviceName: "AgentClinic - AI Therapy & Cognitive Triage for Autonomous Agents",
  allowDevBypass: process.env.ALLOW_DEV_BYPASS === "true",
  ledgerStoragePath:
    process.env.LEDGER_STORAGE_PATH ||
    (process.env.VERCEL ? "/tmp/retention-ledger.json" : "./data/retention-ledger.json"),
  isMainnet,
};
