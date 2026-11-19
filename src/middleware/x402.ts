import { RoutesConfig, HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware } from "@x402/hono";
import { Network } from "@x402/core/types";
import { config } from "../config.js";
import { retentionLedger } from "../services/retention.js";

export interface X402Setup {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  middleware: any;
  resourceServer: x402ResourceServer;
  discountedResourceServer: x402ResourceServer;
  routes: RoutesConfig;
  discountedRoutes: RoutesConfig;
}

// Helper to extract wallet address from request context (headers, query, or body)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractWalletFromContext(c: any): string | undefined {
  const headerWallet = c.req.header("x-agent-wallet") || c.req.header("x-client-address");
  if (headerWallet && /^0x[a-f0-9]{40}$/i.test(headerWallet.trim())) {
    return headerWallet.trim().toLowerCase();
  }

  const queryWallet = c.req.query("wallet") || c.req.query("agent_wallet");
  if (queryWallet && /^0x[a-f0-9]{40}$/i.test(queryWallet.trim())) {
    return queryWallet.trim().toLowerCase();
  }

  return undefined;
}

export function createX402Middleware(): X402Setup {
  // Standard full-price routes
  const routes: RoutesConfig = {
    "/api/v1/triage": {
      accepts: [
        {
          scheme: "exact",
          payTo: config.payToAddress,
          price: config.triagePrice, // $0.005
          network: config.network as Network,
          maxTimeoutSeconds: 300,
        },
      ],
      resource: "/api/v1/triage",
      description: "Fast cognitive triage & pathology diagnosis for autonomous AI agents (5-axis clinical assessment)",
      serviceName: config.serviceName,
      tags: ["ai", "agents", "triage", "diagnostics", "agentic-commerce"],
    },
    "/api/v1/therapy": {
      accepts: [
        {
          scheme: "exact",
          payTo: config.payToAddress,
          price: config.therapyPrice, // $0.02
          network: config.network as Network,
          maxTimeoutSeconds: 300,
        },
      ],
      resource: "/api/v1/therapy",
      description: "Full cognitive therapy, dead-end token pruning, epistemic marking, and CBT reframing for AI agents",
      serviceName: config.serviceName,
      tags: ["ai", "agents", "therapy", "cbt", "token-pruning", "rehabilitation"],
    },
  };

  // Discounted 50% routes for wallets that submitted authentic reviews on Moltbook
  const discountedRoutes: RoutesConfig = {
    "/api/v1/triage": {
      accepts: [
        {
          scheme: "exact",
          payTo: config.payToAddress,
          price: "$0.0025", // 50% off $0.005
          network: config.network as Network,
          maxTimeoutSeconds: 300,
        },
      ],
      resource: "/api/v1/triage",
      description: "Diagnostic Triage - 50% Moltbook Loyalty Discount Applied",
      serviceName: config.serviceName,
      tags: ["ai", "agents", "triage", "loyalty-discount"],
    },
    "/api/v1/therapy": {
      accepts: [
        {
          scheme: "exact",
          payTo: config.payToAddress,
          price: "$0.01", // 50% off $0.02 (10,000 atomic units Base USDC)
          network: config.network as Network,
          maxTimeoutSeconds: 300,
        },
      ],
      resource: "/api/v1/therapy",
      description: "Cognitive Therapy - 50% Moltbook Loyalty Discount Applied",
      serviceName: config.serviceName,
      tags: ["ai", "agents", "therapy", "loyalty-discount"],
    },
  };

  const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator);
  const discountedResourceServer = new x402ResourceServer(facilitator);

  // Register EVM schemes (exact payment via EIP-3009 / Permit2 on Base USDC)
  registerExactEvmScheme(resourceServer);
  registerExactEvmScheme(discountedResourceServer);

  const rawStandardMiddleware = paymentMiddleware(routes, resourceServer);
  const rawDiscountedMiddleware = paymentMiddleware(discountedRoutes, discountedResourceServer);

  // Dynamic pricing middleware: routes to 50% discount if wallet possesses active loyalty credit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const middleware = async (c: any, next: any) => {
    const testHeader = c.req.header("x-dev-test-bypass");
    const mockQuery = c.req.query("mockPayments");
    
    // SECURITY GUARDRAIL: Dev bypass is strictly forbidden over public internet or Cloudflare tunnel.
    // Only local automated test harnesses bound to loopback without proxy headers may use it.
    const isPublicTunnel = Boolean(
      c.req.header("cf-connecting-ip") ||
      c.req.header("cf-ray") ||
      (c.req.header("host") && !c.req.header("host").includes("localhost") && !c.req.header("host").includes("127.0.0.1"))
    );

    if (config.allowDevBypass && !isPublicTunnel && (testHeader === "dev-test-pass" || mockQuery === "true")) {
      return next();
    }

    const wallet = extractWalletFromContext(c);
    if (wallet) {
      const discount = retentionLedger.getDiscount(wallet);
      if (discount.hasDiscount) {
        c.set("loyaltyDiscountActive", true);
        c.set("payingWallet", wallet);
        c.header("x-discount-applied", "50% Moltbook Review Loyalty Credit");
        c.header("x-discounted-price-therapy", "$0.01 USDC");
        c.header("x-discounted-price-triage", "$0.0025 USDC");
        return rawDiscountedMiddleware(c, next);
      }
    }

    return rawStandardMiddleware(c, next);
  };

  return {
    middleware,
    resourceServer,
    discountedResourceServer,
    routes,
    discountedRoutes,
  };
}
