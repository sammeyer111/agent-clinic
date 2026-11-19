import { generateMnemonic, english, mnemonicToAccount } from "viem/accounts";

function main() {
  const mnemonic = generateMnemonic(english);
  const account = mnemonicToAccount(mnemonic);

  console.log(`\n======================================================`);
  console.log(`🏥 AgentClinic: Dedicated Base Treasury Wallet`);
  console.log(`======================================================\n`);
  console.log(`📬 PUBLIC RECEIVING ADDRESS (PAY_TO_ADDRESS):`);
  console.log(`   ${account.address}\n`);
  console.log(`🔐 12-WORD SECRET RECOVERY PHRASE (BIP-39):`);
  console.log(`   "${mnemonic}"\n`);
  console.log(`🔑 PRIVATE KEY (Hex):`);
  console.log(`   ${account.getHdKey().privateKey ? "0x" + Buffer.from(account.getHdKey().privateKey!).toString("hex") : "N/A"}\n`);
  console.log(`------------------------------------------------------`);
  console.log(`🛡️ SECURITY NOTE:`);
  console.log(`- Only the PUBLIC ADDRESS (${account.address}) goes into .env!`);
  console.log(`- AgentClinic requires ZERO private keys on the server.`);
  console.log(`- You can import the 12 words into MetaMask, Coinbase Wallet, or Rainbow`);
  console.log(`  to view your Base USDC balance or cash out anytime.`);
  console.log(`======================================================\n`);
}

main();
