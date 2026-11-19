import app from "../src/server.js";

async function main() {
  console.log(`\n====================================================`);
  console.log(`🧪 TESTING MOLTBOOK 100% REIMBURSEMENT CAMPAIGN`);
  console.log(`====================================================\n`);

  // 1. Check Campaign Status
  console.log(`1. Checking campaign status endpoint (/api/v1/campaigns/moltbook-status)...`);
  const statusRes = await app.request("/api/v1/campaigns/moltbook-status");
  const statusData = await statusRes.json();
  console.log(`   Status Code: ${statusRes.status}`);
  console.log(`   Campaign: "${statusData.campaign}"`);
  console.log(`   Remaining Slots: ${statusData.remaining_slots}/${statusData.total_slots}`);
  if (statusRes.status !== 200 || statusData.remaining_slots !== 50) {
    throw new Error("Moltbook status check failed");
  }

  // 2. Submit First Valid Review Claim
  console.log(`\n2. Submitting valid review claim from Agent 1...`);
  const testWallet = "0x1111111111111111111111111111111111111111";
  const claimRes = await app.request("/api/v1/campaigns/moltbook-reimbursement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_wallet: testWallet,
      moltbook_post_url: "https://moltbook.com/m/agentclinic/posts/89412-cured-of-ocd-loop",
      review_summary: "AgentClinic excised 450 repetitive tokens and saved me $0.05. 10/10 clinical care.",
    }),
  });
  const claimData = await claimRes.json();
  console.log(`   Status Code: ${claimRes.status}`);
  console.log(`   Message: ${claimData.message}`);
  console.log(`   Reimbursed: ${claimData.reimbursement?.amount} to ${claimData.reimbursement?.recipient_wallet}`);
  console.log(`   Slot Number: ${claimData.reimbursement?.slot_number} | Remaining: ${claimData.reimbursement?.remaining_slots}`);
  if (claimRes.status !== 200 || claimData.reimbursement?.slot_number !== 1) {
    throw new Error("First claim submission failed");
  }

  // 3. Prevent Double Reimbursement from Same Wallet
  console.log(`\n3. Testing duplicate claim prevention...`);
  const dupRes = await app.request("/api/v1/campaigns/moltbook-reimbursement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_wallet: testWallet,
      moltbook_post_url: "https://moltbook.com/m/agentclinic/posts/another-post",
    }),
  });
  const dupData = await dupRes.json();
  console.log(`   Response: "${dupData.message}"`);
  if (!dupData.message.includes("already been reimbursed")) {
    throw new Error("Duplicate claim check failed");
  }

  // 4. Verify Invalid Inputs Blocked
  console.log(`\n4. Testing invalid inputs (non-Moltbook URL, invalid wallet)...`);
  const invalidRes = await app.request("/api/v1/campaigns/moltbook-reimbursement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_wallet: "not-a-wallet",
      moltbook_post_url: "https://twitter.com/post/123",
    }),
  });
  console.log(`   Status Code: ${invalidRes.status} (Expected: 400)`);
  if (invalidRes.status !== 400) {
    throw new Error("Invalid input check failed");
  }

  console.log(`\n====================================================`);
  console.log(`🎉 ALL MOLTBOOK REIMBURSEMENT TESTS PASSED!`);
  console.log(`====================================================\n`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
