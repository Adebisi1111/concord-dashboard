// Vercel serverless function: Concord autonomous settle.
// Triggered by Vercel Cron (see vercel.json). Runs once per schedule.
const { ethers } = require("ethers");

const RPC = process.env.ARC_RPC || "https://arc-testnet.rpc.thirdweb.com";
const CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000";
const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";

const VAULT_ABI = [
  "function fund(uint256) external",
  "function pay(uint256) external",
  "function subs(uint256) view returns (address,uint256,uint256,uint256,uint256,uint256,bool)",
  "function nextId() view returns (uint256)",
];
const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, n = 12) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) {
      const m = String(e.message);
      if (m.includes("request limit") || m.includes("429") || m.includes("timeout") || m.includes("throttl")) {
        await sleep(2500 * (i + 1)); continue;
      }
      throw e;
    }
  }
  throw new Error("RPC retries exhausted");
}

module.exports = async (req, res) => {
  try {
    const pk = process.env.OWNER_PK;
    if (!pk) return res.status(500).json({ error: "OWNER_PK not set" });

    const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
    const wallet = new ethers.Wallet(pk, provider);
    const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
    const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);

    const ap = await withRetry(() => usdc.approve(VAULT, ethers.MaxUint256));
    await withRetry(() => ap.wait());

    const nextId = Number(await withRetry(() => vault.nextId()));
    const now = Math.floor(Date.now() / 1000);
    const due = [];
    for (let id = 0; id < nextId; id++) {
      const s = await withRetry(() => vault.subs(id));
      if (s[6] && Number(s[5]) <= now) due.push({ id, amount: BigInt(s[1]) });
    }
    if (due.length === 0) return res.status(200).json({ status: "idle", settled: 0 });

    const totalDue = due.reduce((a, d) => a + d.amount, 0n);
    let vaultBal = BigInt(await withRetry(() => usdc.balanceOf(VAULT)));
    if (vaultBal < totalDue + 3_000_000n) {
      const need = totalDue + 3_000_000n - vaultBal;
      const ftx = await withRetry(() => vault.fund(need));
      await withRetry(() => ftx.wait());
    }
    let paid = 0;
    for (const d of due) {
      try {
        const tx = await withRetry(() => vault.pay(d.id));
        await withRetry(() => tx.wait());
        paid++;
        await sleep(1200);
      } catch (e) { /* skip individual failures */ }
    }
    return res.status(200).json({ status: "settled", settled: paid, due: due.length });
  } catch (e) {
    return res.status(500).json({ error: String(e.message).split("\n")[0] });
  }
};
