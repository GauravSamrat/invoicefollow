// ============================================
// InvoiceFollow — Main Script with Paywall
// Free users: 3 generations. Then paywall.
// ============================================

// ---------- Constants ----------
const FREE_LIMIT = 3;
const STORAGE_KEY = "invoicefollow_usage";
const PRO_KEY = "invoicefollow_pro";

// ⚠️ YAHAN APNA LEMON SQUEEZY PAYMENT LINK DAALO (Step 5 mein)
const PAYMENT_LINK = "https://YOUR-STORE.lemonsqueezy.com/checkout/buy/YOUR-PRODUCT-ID";

// ---------- DOM ----------
const generateBtn = document.getElementById("generateBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const formSection = document.getElementById("form-section");
const outputSection = document.getElementById("output-section");
const paywall = document.getElementById("paywall");
const usageCounter = document.getElementById("usageCounter");

// ---------- Usage tracking ----------
function getUsage() {
  return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
}

function setUsage(n) {
  localStorage.setItem(STORAGE_KEY, n.toString());
  updateUsageDisplay();
}

function isPro() {
  return localStorage.getItem(PRO_KEY) === "true";
}

function updateUsageDisplay() {
  if (isPro()) {
    usageCounter.textContent = "✨ Pro user — unlimited reminders";
    return;
  }
  const used = getUsage();
  const left = FREE_LIMIT - used;
  if (left > 0) {
    usageCounter.textContent = `${left} free reminder${left === 1 ? "" : "s"} left`;
  } else {
    usageCounter.textContent = "Free limit reached";
  }
}

// ---------- Event Listeners ----------
generateBtn.addEventListener("click", generateEmails);

resetBtn.addEventListener("click", () => {
  outputSection.classList.add("hidden");
  formSection.classList.remove("hidden");
  statusEl.textContent = "";
  checkPaywall();
});

document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    navigator.clipboard.writeText(target.value);
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
});

// Upgrade buttons
document.querySelectorAll("#upgradeBtn, #paywallUpgradeBtn, #pricingUpgradeBtn, #lifetimeBtn").forEach((btn) => {
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(PAYMENT_LINK, "_blank");
    });
  }
});

// ---------- Main function ----------
async function generateEmails() {
  // Check paywall
  if (!isPro() && getUsage() >= FREE_LIMIT) {
    showPaywall();
    return;
  }

  const clientName = document.getElementById("clientName").value.trim();
  const yourName = document.getElementById("yourName").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const dueDate = document.getElementById("dueDate").value;
  const workDesc = document.getElementById("workDesc").value.trim();

  if (!clientName || !yourName || !amount || !dueDate || !workDesc) {
    statusEl.textContent = "⚠️ Please fill in all fields";
    return;
  }

  generateBtn.disabled = true;
  statusEl.textContent = "⏳ AI is writing your emails...";

  const prompt = `You are an expert at writing polite but effective payment reminder emails for freelancers.

Write 3 escalating payment reminder emails for this situation:
- Freelancer name: ${yourName}
- Client name: ${clientName}
- Amount owed: ${amount}
- Due date: ${dueDate}
- Work done: ${workDesc}

Email 1 (Day 3 overdue): Gentle, friendly nudge. Assume it's an oversight.
Email 2 (Day 7 overdue): Firmer, direct. Mention the specific amount and date.
Email 3 (Day 14 overdue): Final notice. Professional but clear about next steps (pausing work, late fee, etc.).

Rules:
- Keep each email under 120 words
- Include a subject line for each
- Use a warm but professional tone
- No emojis
- Format exactly like this:

=== EMAIL 1 ===
Subject: ...

[body]

=== EMAIL 2 ===
Subject: ...

[body]

=== EMAIL 3 ===
Subject: ...

[body]`;

  try {
    const text = await callGenerateAPI(prompt);
    const emails = parseEmails(text);

    document.getElementById("email1").value = emails[0] || "Could not generate email 1.";
    document.getElementById("email2").value = emails[1] || "Could not generate email 2.";
    document.getElementById("email3").value = emails[2] || "Could not generate email 3.";

    // Increment usage (if not Pro)
    if (!isPro()) {
      setUsage(getUsage() + 1);
    }

    formSection.classList.add("hidden");
    outputSection.classList.remove("hidden");
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "❌ Error: " + err.message;
  } finally {
    generateBtn.disabled = false;
  }
}

// ---------- API call with retry ----------
async function callGenerateAPI(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (response.status === 429) {
      const waitSec = 5 * (attempt + 1);
      statusEl.textContent = `⏳ Rate limit. Waiting ${waitSec}s...`;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error ${response.status}`);
    }

    const data = await response.json();
    if (!data.text) throw new Error("AI returned empty response");
    return data.text;
  }
  throw new Error("Rate limit exceeded. Try again in a minute.");
}

// ---------- Parse 3 emails ----------
function parseEmails(text) {
  const parts = text.split(/===\s*EMAIL\s*\d\s*===/i);
  return parts.slice(1).map((p) => p.trim());
}

// ---------- Paywall ----------
function checkPaywall() {
  if (!isPro() && getUsage() >= FREE_LIMIT) {
    showPaywall();
  }
}

function showPaywall() {
  formSection.classList.add("hidden");
  outputSection.classList.add("hidden");
  paywall.classList.remove("hidden");
}

// ---------- Init ----------
updateUsageDisplay();
checkPaywall();