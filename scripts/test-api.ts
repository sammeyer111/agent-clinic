import { app } from "../src/server.js";
import { config } from "../src/config.js";

async function runApiTests() {
  console.log("====================================================");
  console.log("🧪 TESTING AGENTCLINIC API GATEWAY & x402 PROTOCOL");
  console.log("====================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Health check
  console.log("1. Health Endpoint (/health)");
  const healthRes = await app.request("/health");
  assert(healthRes.status === 200, "GET /health returns HTTP 200");
  const healthData = await healthRes.json();
  assert(healthData.status === "healthy", "Health status is 'healthy'");
  assert(healthData.pricing?.triage === "$0.005", "Triage price is $0.005");
  assert(healthData.pricing?.therapy === "$0.02", "Therapy price is $0.02");

  // 2. OpenAPI Spec
  console.log("\n2. OpenAPI Spec (/openapi.json)");
  const openApiRes = await app.request("/openapi.json");
  assert(openApiRes.status === 200, "GET /openapi.json returns HTTP 200");
  const openApiData = await openApiRes.json();
  assert(openApiData.openapi === "3.0.3", "OpenAPI version is 3.0.3");
  assert(Boolean(openApiData.paths["/api/v1/triage"]), "Path /api/v1/triage is documented");
  assert(Boolean(openApiData.paths["/api/v1/therapy"]), "Path /api/v1/therapy is documented");

  // 3. Free Preview Endpoint
  console.log("\n3. Free Preview Endpoint (/api/v1/preview)");
  const previewRes = await app.request("/api/v1/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trajectory: [
        { role: "user", content: "Solve math problem" },
        { role: "assistant", content: "Calculating 2+2=4" },
      ],
    }),
  });
  assert(previewRes.status === 200, "POST /api/v1/preview returns HTTP 200");
  const previewData = await previewRes.json();
  assert(previewData.preview === true, "Preview flag is true");
  assert(previewData.data?.overall_health_score === 100, "Preview health score is 100");

  // 4. x402 Challenge on /api/v1/triage
  console.log("\n4. x402 Challenge Verification: /api/v1/triage ($0.005 USDC)");
  const unpaidTriageRes = await app.request("/api/v1/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trajectory: [{ role: "user", content: "Triage test" }],
    }),
  });
  assert(unpaidTriageRes.status === 402, "POST /api/v1/triage returns HTTP 402 Payment Required");
  const triagePayHeader = unpaidTriageRes.headers.get("payment-required");
  assert(Boolean(triagePayHeader), "payment-required header is present");
  if (triagePayHeader) {
    const triageChallenge = JSON.parse(Buffer.from(triagePayHeader, "base64").toString("utf-8"));
    assert(triageChallenge.accepts[0].scheme === "exact", "Payment scheme is 'exact'");
    assert(triageChallenge.accepts[0].amount === "5000", "Payment amount is 5000 atomic units ($0.005)");
    assert(triageChallenge.accepts[0].payTo.toLowerCase() === config.payToAddress.toLowerCase(), "Recipient matches payToAddress");
    assert(triageChallenge.accepts[0].network === config.network, "Network matches config");
  }

  // 5. x402 Challenge on /api/v1/therapy
  console.log("\n5. x402 Challenge Verification: /api/v1/therapy ($0.02 USDC)");
  const unpaidTherapyRes = await app.request("/api/v1/therapy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trajectory: [{ role: "user", content: "Therapy test" }],
    }),
  });
  assert(unpaidTherapyRes.status === 402, "POST /api/v1/therapy returns HTTP 402 Payment Required");
  const therapyPayHeader = unpaidTherapyRes.headers.get("payment-required");
  assert(Boolean(therapyPayHeader), "payment-required header is present");
  if (therapyPayHeader) {
    const therapyChallenge = JSON.parse(Buffer.from(therapyPayHeader, "base64").toString("utf-8"));
    assert(therapyChallenge.accepts[0].scheme === "exact", "Payment scheme is 'exact'");
    assert(therapyChallenge.accepts[0].amount === "20000", "Payment amount is 20000 atomic units ($0.02)");
    assert(therapyChallenge.accepts[0].payTo.toLowerCase() === config.payToAddress.toLowerCase(), "Recipient matches payToAddress");
    assert(therapyChallenge.accepts[0].network === config.network, "Network matches config");
  }

  // 6. Authorized Triage execution
  console.log("\n6. Authorized Triage Request (with dev bypass)");
  config.allowDevBypass = true;
  const authTriageRes = await app.request("/api/v1/triage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dev-test-bypass": "dev-test-pass",
    },
    body: JSON.stringify({
      agent_id: "patient-loop-01",
      trajectory: [
        { role: "user", content: "Deploy application" },
        { role: "assistant", content: "Deploying application now to production cluster" },
        { role: "assistant", content: "Deploying application now to production cluster" },
        { role: "assistant", content: "Deploying application now to production cluster" },
        { role: "assistant", content: "Deploying application now to production cluster" },
      ],
    }),
  });
  assert(authTriageRes.status === 200, "Authorized POST /api/v1/triage returns HTTP 200");
  const authTriageData = await authTriageRes.json();
  assert(authTriageData.success === true, "Triage success flag is true");
  assert(authTriageData.data.overall_health_score < 100, "Detected pathology drops health score below 100");
  assert(
    authTriageData.data.pathologies.some((p: any) => p.type === "ocd_loop"),
    "Detected 'ocd_loop' pathology finding"
  );

  // 7. Authorized Therapy execution
  console.log("\n7. Authorized Therapy Request (with dev bypass)");
  const authTherapyRes = await app.request("/api/v1/therapy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dev-test-bypass": "dev-test-pass",
    },
    body: JSON.stringify({
      agent_id: "patient-loop-01",
      trajectory: [
        { role: "user", content: "Deploy application" },
        { role: "assistant", content: "Deploying application now to production cluster" },
        { role: "assistant", content: "Deploying application now to production cluster" },
        { role: "assistant", content: "Deploying application now to production cluster" },
        { role: "assistant", content: "Deploying application now to production cluster" },
      ],
    }),
  });
  assert(authTherapyRes.status === 200, "Authorized POST /api/v1/therapy returns HTTP 200");
  const authTherapyData = await authTherapyRes.json();
  assert(authTherapyData.success === true, "Therapy success flag is true");
  assert(authTherapyData.data.new_health_score === 100, "Cured health score is 100");
  assert(authTherapyData.data.tokens_saved > 0, "Tokens were pruned and saved");
  assert(
    authTherapyData.data.cognitive_reframing_prompt.includes("<agent_clinic_reframing>"),
    "Reframing prompt contains <agent_clinic_reframing> tags"
  );

  // 8. Validation Error Handling
  console.log("\n8. Validation & Error Handling");
  const badReqRes = await app.request("/api/v1/triage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dev-test-bypass": "dev-test-pass",
    },
    body: JSON.stringify({
      trajectory: "not-an-array-or-valid-object",
    }),
  });
  assert(badReqRes.status === 400, "Invalid trajectory schema returns HTTP 400 Bad Request");

  console.log("\n====================================================");
  console.log(`🎉 ALL ${passed}/${total} API & x402 ENDPOINT TESTS PASSED!`);
  console.log("====================================================");
}

runApiTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
