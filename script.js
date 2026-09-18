// ============================================
// InvoiceFollow — Main Script
// Free users: 3 generations. Then paywall.
// ============================================




// ============================================
// Pro Status Display
// ============================================

function getProExpiry() {
  const expiry = localStorage.getItem("invoicefollow_pro_expiry");
  if (!expiry) return null;
  return new Date(expiry);
}

function getDaysLeft() {
  const expiry = getProExpiry();
  if (!expiry) return 0;
  const now = new Date();
  const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function getPaymentId() {
  return localStorage.getItem("invoicefollow_payment_id") || "—";
}

function updateProUI() {
  const proBadge = document.getElementById("proBadge");
  const userMenu = document.getElementById("userMenu");
  const proStatusCard = document.getElementById("proStatusCard");
  const navCta = document.getElementById("navCta");

  if (isPro()) {
    // Navbar: Pro badge show karo, CTA hide karo
    if (proBadge) proBadge.classList.remove("hidden");
    if (userMenu) userMenu.classList.remove("hidden");
    if (navCta) navCta.classList.add("hidden");

    // Tool section: Pro status card show karo
    if (proStatusCard) {
      proStatusCard.classList.remove("hidden");
      const days = getDaysLeft();
      document.getElementById("proStatusDays").textContent = days;
      document.getElementById("proStatusSub").textContent =
        `${days} days of unlimited reminders remaining`;

      // Dropdown values
      const expiryDate = getProExpiry();
      if (expiryDate) {
        document.getElementById("dropdownExpiry").textContent =
          expiryDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
      }
      document.getElementById("dropdownPaymentId").textContent = getPaymentId();
    }
  } else {
    // Pro nahi hai
    if (proBadge) proBadge.classList.add("hidden");
    if (userMenu) userMenu.classList.add("hidden");
    if (navCta) navCta.classList.remove("hidden");
    if (proStatusCard) proStatusCard.classList.add("hidden");
  }
}

// User menu dropdown toggle
const userMenuBtn = document.getElementById("userMenuBtn");
const userDropdown = document.getElementById("userDropdown");

if (userMenuBtn && userDropdown) {
  userMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
      userDropdown.classList.add("hidden");
    }
  });
}

// Logout button
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to sign out? You will lose Pro access on this device.")) {
      localStorage.removeItem("invoicefollow_pro");
      localStorage.removeItem("invoicefollow_pro_expiry");
      localStorage.removeItem("invoicefollow_payment_id");
      localStorage.removeItem("invoicefollow_usage");
      window.location.reload();
    }
  });
}

const FREE_LIMIT = 3;
const STORAGE_KEY = "invoicefollow_usage";
const PRO_KEY = "invoicefollow_pro";



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
  const pro = localStorage.getItem("invoicefollow_pro") === "true";
  if (!pro) return false;

  const expiry = localStorage.getItem("invoicefollow_pro_expiry");
  if (!expiry) return false;

  // Expiry check karo
  if (new Date(expiry) < new Date()) {
    localStorage.removeItem("invoicefollow_pro");
    localStorage.removeItem("invoicefollow_pro_expiry");
    return false;
  }

  return true;
}

function updateUsageDisplay() {
  if (isPro()) {
    usageCounter.textContent = "Pro account — unlimited reminders";
    return;
  }
  const used = getUsage();
  const left = FREE_LIMIT - used;
  if (left > 0) {
    usageCounter.textContent = `${left} free reminder${left === 1 ? "" : "s"} remaining`;
  } else {
    usageCounter.textContent = "Free limit reached";
  }
}

// ---------- Event listeners ----------
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
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
});

// Upgrade buttons


// ---------- Main function ----------
async function generateEmails() {
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
    statusEl.textContent = "Please fill in all fields to continue.";
    return;
  }

  generateBtn.disabled = true;
  statusEl.textContent = "Writing your emails...";

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

    if (!isPro()) {
      setUsage(getUsage() + 1);
    }

    formSection.classList.add("hidden");
    outputSection.classList.remove("hidden");
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error: " + err.message;
  } finally {
    generateBtn.disabled = false;
  }
}

// ---------- API with retry ----------
async function callGenerateAPI(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (response.status === 429) {
      const waitSec = 5 * (attempt + 1);
      statusEl.textContent = `Service is busy. Retrying in ${waitSec} seconds...`;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error ${response.status}`);
    }

    const data = await response.json();
    if (!data.text) throw new Error("AI returned an empty response.");
    return data.text;
  }
  throw new Error("Service is busy. Please try again in a minute.");
}

// ---------- Parse ----------
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

// ============================================
// Razorpay Checkout — Payment Flow
// ============================================

async function openRazorpayCheckout(amount = 9) {
  try {
    statusEl.textContent = "Opening payment...";

    // Step 1: Backend se order create karo
    const response = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amount, currency: "USD" }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Payment setup failed");
    }

    // Step 2: Razorpay Checkout options
    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: "InvoiceFollow",
      description: "Pro Plan — Unlimited Reminders",
      order_id: data.orderId,
      handler: function (response) {
  // Pro access ke saath expiry date bhi save karo
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30); // 30 din baad expire

  localStorage.setItem("invoicefollow_pro", "true");
  localStorage.setItem("invoicefollow_pro_expiry", expiryDate.toISOString());
  localStorage.setItem("invoicefollow_payment_id", response.razorpay_payment_id);

  alert("Payment successful! Pro access enabled for 30 days.");
  window.location.reload();
      },
      prefill: {
        name: "",
        email: "",
      },
      theme: {
        color: "#4f46e5",
      },
      modal: {
        ondismiss: function () {
          statusEl.textContent = "";
        },
      },
    };

    // Step 3: Checkout open karo
    const rzp = new window.Razorpay(options);
    rzp.open();
    statusEl.textContent = "";
  } catch (err) {
    console.error("Payment error:", err);
    statusEl.textContent = "Payment error: " + err.message;
  }
}

// Upgrade buttons ko Razorpay se link karo
["upgradeBtn", "paywallUpgradeBtn", "pricingUpgradeBtn"].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openRazorpayCheckout(9); // $9/month
    });
  }
});

// Lifetime button ke liye (agar chahiye)
const lifetimeBtnEl = document.getElementById("lifetimeBtn");
if (lifetimeBtnEl) {
  lifetimeBtnEl.addEventListener("click", (e) => {
    e.preventDefault();
    openRazorpayCheckout(49); // $49 lifetime
  });
}

function showPaywall() {
  formSection.classList.add("hidden");
  outputSection.classList.add("hidden");
  paywall.classList.remove("hidden");
}

// ---------- Init ----------
updateUsageDisplay();
checkPaywall();
// Init Pro UI on page load
updateProUI();