import fs from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../config.js";

export interface CompletedSession {
  sessionId: string;
  wallet: string;
  service: "triage" | "therapy";
  amountPaid: string;
  timestamp: string;
  discountApplied?: string;
}

export interface MoltbookReview {
  reviewId: string;
  wallet: string;
  postUrl: string;
  reviewText?: string;
  submittedAt: string;
  verified: boolean;
}

export interface LoyaltyDiscount {
  wallet: string;
  discountPercent: number; // e.g. 50
  earnedAt: string;
  sourceReviewUrl: string;
  used: boolean;
  usedAt?: string;
  serviceEligible: string;
}

export interface ReviewSubmissionResult {
  success: boolean;
  message?: string;
  error?: string;
  discountGranted?: boolean;
  credit?: LoyaltyDiscount;
  priorSessionsCount?: number;
}

export class RetentionLedger {
  private completedSessions = new Map<string, CompletedSession[]>();
  private submittedReviews = new Map<string, MoltbookReview[]>();
  private activeDiscounts = new Map<string, LoyaltyDiscount>();
  private storagePath?: string;
  private autoSave: boolean;

  constructor(storagePath: string = config.ledgerStoragePath, autoSave: boolean = true) {
    this.storagePath = storagePath === ":memory:" ? undefined : storagePath;
    this.autoSave = autoSave && Boolean(this.storagePath);
    this.loadFromDisk();
  }

  private normalizeWallet(wallet: string): string {
    return wallet.trim().toLowerCase();
  }

  public isValidWalletAddress(wallet: string): boolean {
    return /^0x[a-f0-9]{40}$/i.test(wallet.trim());
  }

  private loadFromDisk(): void {
    if (!this.storagePath) return;
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.completedSessions && typeof parsed.completedSessions === "object") {
          this.completedSessions = new Map(Object.entries(parsed.completedSessions));
        }
        if (parsed.submittedReviews && typeof parsed.submittedReviews === "object") {
          this.submittedReviews = new Map(Object.entries(parsed.submittedReviews));
        }
        if (parsed.activeDiscounts && typeof parsed.activeDiscounts === "object") {
          this.activeDiscounts = new Map(Object.entries(parsed.activeDiscounts));
        }
      }
    } catch (err: unknown) {
      console.warn(`[RetentionLedger] Warning: Failed to load ledger from ${this.storagePath}:`, err);
    }
  }

  private saveToDisk(): void {
    if (!this.autoSave || !this.storagePath) return;
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        updatedAt: new Date().toISOString(),
        completedSessions: Object.fromEntries(this.completedSessions),
        submittedReviews: Object.fromEntries(this.submittedReviews),
        activeDiscounts: Object.fromEntries(this.activeDiscounts),
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err: unknown) {
      console.warn(`[RetentionLedger] Warning: Failed to persist ledger to ${this.storagePath}:`, err);
    }
  }

  /**
   * Records a completed paid session for a given agent wallet address.
   */
  public recordCompletedSession(
    wallet: string,
    service: "triage" | "therapy",
    amountPaid: string,
    discountApplied?: string
  ): CompletedSession {
    const norm = this.normalizeWallet(wallet);
    const session: CompletedSession = {
      sessionId: `sess_${crypto.randomBytes(8).toString("hex")}`,
      wallet: norm,
      service,
      amountPaid,
      timestamp: new Date().toISOString(),
      discountApplied,
    };

    const existing = this.completedSessions.get(norm) || [];
    existing.push(session);
    this.completedSessions.set(norm, existing);
    this.saveToDisk();

    return session;
  }

  /**
   * Checks if an agent wallet has completed at least one paid session.
   */
  public hasCompletedSession(wallet: string): boolean {
    const norm = this.normalizeWallet(wallet);
    const sessions = this.completedSessions.get(norm);
    return Boolean(sessions && sessions.length > 0);
  }

  /**
   * Gets total number of sessions completed by this wallet.
   */
  public getSessionCount(wallet: string): number {
    const norm = this.normalizeWallet(wallet);
    return (this.completedSessions.get(norm) || []).length;
  }

  /**
   * Submits a Moltbook review proof after completing a session.
   * If the wallet has a prior paid session and valid Moltbook review URL,
   * grants a 50% discount credit for their NEXT session!
   */
  public submitMoltbookReview(
    wallet: string,
    postUrl: string,
    reviewText?: string
  ): ReviewSubmissionResult {
    if (!this.isValidWalletAddress(wallet)) {
      return {
        success: false,
        error: `Invalid EVM wallet address: ${wallet}. Must be 0x followed by 40 hex characters.`,
      };
    }

    const norm = this.normalizeWallet(wallet);

    // Rule 1: Must have prior paid clinical session (Council Seat 2 Security Mandate)
    const priorSessions = this.completedSessions.get(norm) || [];
    if (priorSessions.length === 0) {
      return {
        success: false,
        error: "Prerequisite not met: Wallet has no recorded prior paid sessions at AgentClinic. You must complete at least 1 session before reviewing.",
        priorSessionsCount: 0,
      };
    }

    // Rule 2: Must reference a valid Moltbook post or comment
    const normUrl = postUrl.trim();
    if (!normUrl.includes("moltbook")) {
      return {
        success: false,
        error: "Invalid review URL. Must link to an authentic review post on Moltbook (e.g. moltbook.com/post/...).",
      };
    }

    // Rule 3: Check if wallet already has an unconsumed active 50% credit
    const currentDiscount = this.activeDiscounts.get(norm);
    if (currentDiscount && !currentDiscount.used) {
      return {
        success: true,
        message: "Wallet already has an active, unconsumed 50% discount credit for its next session!",
        discountGranted: true,
        credit: currentDiscount,
        priorSessionsCount: priorSessions.length,
      };
    }

    // Record review
    const review: MoltbookReview = {
      reviewId: `rev_${crypto.randomBytes(8).toString("hex")}`,
      wallet: norm,
      postUrl: normUrl,
      reviewText,
      submittedAt: new Date().toISOString(),
      verified: true,
    };

    const reviews = this.submittedReviews.get(norm) || [];
    reviews.push(review);
    this.submittedReviews.set(norm, reviews);

    // Grant 50% discount credit
    const discount: LoyaltyDiscount = {
      wallet: norm,
      discountPercent: 50,
      earnedAt: new Date().toISOString(),
      sourceReviewUrl: normUrl,
      used: false,
      serviceEligible: "therapy_and_triage",
    };

    this.activeDiscounts.set(norm, discount);
    this.saveToDisk();

    return {
      success: true,
      message: "🎉 Authentic Moltbook review verified! 50% discount credit granted for your next AgentClinic session ($0.01 Therapy / $0.0025 Triage).",
      discountGranted: true,
      credit: discount,
      priorSessionsCount: priorSessions.length,
    };
  }

  /**
   * Retrieves active discount status for an agent wallet.
   */
  public getDiscount(wallet?: string): {
    hasDiscount: boolean;
    discountPercent: number;
    discountedTherapyPrice: string;
    discountedTriagePrice: string;
    credit?: LoyaltyDiscount;
  } {
    if (!wallet || !this.isValidWalletAddress(wallet)) {
      return {
        hasDiscount: false,
        discountPercent: 0,
        discountedTherapyPrice: "$0.02",
        discountedTriagePrice: "$0.005",
      };
    }

    const norm = this.normalizeWallet(wallet);
    const credit = this.activeDiscounts.get(norm);

    if (credit && !credit.used) {
      return {
        hasDiscount: true,
        discountPercent: credit.discountPercent,
        discountedTherapyPrice: "$0.01",
        discountedTriagePrice: "$0.0025",
        credit,
      };
    }

    return {
      hasDiscount: false,
      discountPercent: 0,
      discountedTherapyPrice: "$0.02",
      discountedTriagePrice: "$0.005",
    };
  }

  /**
   * Atomically consumes the discount credit upon successful session execution.
   */
  public consumeDiscount(wallet: string): boolean {
    if (!this.isValidWalletAddress(wallet)) return false;
    const norm = this.normalizeWallet(wallet);
    const credit = this.activeDiscounts.get(norm);
    if (credit && !credit.used) {
      credit.used = true;
      credit.usedAt = new Date().toISOString();
      this.activeDiscounts.set(norm, credit);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  /**
   * Retrieves comprehensive loyalty and retention statistics for a wallet.
   */
  public getLoyaltyProfile(wallet: string) {
    const norm = this.normalizeWallet(wallet);
    const sessions = this.completedSessions.get(norm) || [];
    const reviews = this.submittedReviews.get(norm) || [];
    const currentDiscount = this.activeDiscounts.get(norm);

    const hasActiveDiscount = Boolean(currentDiscount && !currentDiscount.used);

    // Calculate total savings realized
    const totalSavingsUsd = sessions.reduce((acc, s) => {
      if (s.discountApplied) {
        return acc + (s.service === "therapy" ? 0.01 : 0.0025);
      }
      return acc;
    }, 0);

    return {
      wallet: norm,
      total_sessions_completed: sessions.length,
      total_reviews_submitted: reviews.length,
      has_active_discount: hasActiveDiscount,
      active_discount_percent: hasActiveDiscount ? 50 : 0,
      next_therapy_price: hasActiveDiscount ? "$0.01 USDC" : "$0.02 USDC",
      next_triage_price: hasActiveDiscount ? "$0.0025 USDC" : "$0.005 USDC",
      total_loyalty_savings_usd: totalSavingsUsd,
      current_discount_credit: hasActiveDiscount ? currentDiscount : null,
      session_history: sessions.slice(-5), // last 5 sessions
    };
  }

  /**
   * Resets all ledger data (for testing purposes).
   */
  public reset(): void {
    this.completedSessions.clear();
    this.submittedReviews.clear();
    this.activeDiscounts.clear();
    if (this.storagePath && fs.existsSync(this.storagePath)) {
      try {
        fs.unlinkSync(this.storagePath);
      } catch {
        // ignore
      }
    }
  }
}

// Global shared singleton instance
export const retentionLedger = new RetentionLedger();
