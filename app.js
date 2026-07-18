// Concord dashboard — reads REAL on-chain activity from SubscriptionVault on Arc testnet.
// No backend: calls ArcScan's indexer API directly (CORS enabled).

const VAULT = "0xd25A1979a5bDa25c3ABd8b661957C2AaC9515a0F";
const ARCSCAN = "https://testnet.arcscan.app/api";
const TOPIC_PAID = "0x59e5c638e8e7ab669e805847b18203cf00e4ab4d0688c3da8e486aba4cc4fed2";
const TOPIC_SUB = "0xd630a461004dfb97afd406eebe1b88d0d60252fa4b3a8402de46377085f1ba73";
const USDC = "0x3600000000000000000000000000000000000000";

const fmtUSDC = (hex) => {
  // 6 decimals
  const wei = BigInt(hex || "0x0");
  const whole = wei / 1000000n;
  const frac = (wei % 1000000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole}.${frac}`;
};
const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtTime = (ts) => {
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

async function getLogs(topic) {
  const url = `${ARCSCAN}?module=logs&action=getLogs&address=${VAULT}&topic0=${topic}&fromBlock=0&toBlock=latest`;
  const r = await fetch(url);
  const j = await r.json();
  return j.status === "1" && Array.isArray(j.result) ? j.result : [];
}

async function getVaultBalance() {
  // ERC-20 balanceOf via ArcScan proxy-style action
  const url = `${ARCSCAN}?module=account&action=tokenbalance&contractaddress=${USDC}&address=${VAULT}&tag=latest`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j.status === "1" && j.result) return fmtUSDC(j.result);
  } catch (e) {}
  return "—";
}

function renderFeed(paidLogs) {
  const list = document.getElementById("feedList");
  if (!paidLogs.length) {
    list.innerHTML = `<li class="muted">No payments yet. Concord settles on schedule — check back at the next cycle.</li>`;
    return;
  }
  const items = paidLogs
    .map((log) => {
      // ABI (with 0x prefix): id=2..66, payee=66..130, amount=130..194, cycle=194..
      const data = log.data;
      const payee = "0x" + data.slice(66, 130);
      const amount = fmtUSDC("0x" + data.slice(130, 194));
      return `<li>
        <span><span class="who">${shortAddr(payee)}</span> paid</span>
        <span class="amt">+${amount} USDC</span>
        <span class="when">${fmtTime(log.timeStamp)}</span>
      </li>`;
    })
    .join("");
  list.innerHTML = items;
}

async function load() {
  try {
    const [paidLogs, subLogs] = await Promise.all([getLogs(TOPIC_PAID), getLogs(TOPIC_SUB)]);

    // total paid
    let total = 0n;
    paidLogs.forEach((log) => {
      const amt = BigInt("0x" + log.data.slice(130, 194));
      total += amt;
    });
    const totalUSDC = total / 1000000n;
    const frac = (total % 1000000n).toString().padStart(6, "0").slice(0, 2);
    document.getElementById("totalPaid").textContent = `${totalUSDC}.${frac} USDC`;
    document.getElementById("payCount").textContent = paidLogs.length;
    document.getElementById("subCount").textContent = subLogs.length;

    const bal = await getVaultBalance();
    document.getElementById("vaultBal").textContent = `${bal} USDC`;

    renderFeed(paidLogs);

    document.getElementById("statusText").textContent = "live · Arc testnet";
    document.getElementById("pulse").classList.add("live");
    document.getElementById("lastUpdate").textContent = `updated ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    document.getElementById("statusText").textContent = "error reading chain";
    console.error(e);
  }
}

document.getElementById("vaultLink").textContent = "0xd25A…5a0F";
document.getElementById("vaultLink").href = `https://testnet.arcscan.app/address/${VAULT}`;

load();
setInterval(load, 30000);
