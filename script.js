// ============================================
// InvoiceFollow — Main Script
// Yeh file UI handle karti hai + backend API call karti hai
// API key ab yahan NAHI hai — woh Vercel pe safe hai
// ============================================

// ---------- DOM Elements pakdo ----------
const generateBtn = document.getElementById("generateBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const formSection = document.getElementById("form-section");
const outputSection = document.getElementById("output-section");

// ---------- Event Listeners lagao ----------

// Generate button dabane pe emails banao
generateBtn.addEventListener("click", generateEmails);

// Reset button dabane pe form wapas dikhao
resetBtn.addEventListener("click", () => {
  outputSection.classList.add("hidden");
  formSection.classList.remove("hidden");
  statusEl.textContent = "";
});

// Har "Copy" button pe clipboard mein copy karo
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    navigator.clipboard.writeText(target.value);

    // 1.5 second ke liye "Copied!" dikhao
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
});

// ============================================
// MAIN FUNCTION: Emails Generate Karo
// ============================================
async function generateEmails() {
  // ---------- Form se values uthao ----------
  const clientName = document.getElementById("clientName").value.trim();
  const yourName = document.getElementById("yourName").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const dueDate = document.getElementById("dueDate").value;
  const workDesc = document.getElementById("workDesc").value.trim();

  // ---------- Validation: saari fields bhari honi chahiye ----------
  if (!clientName || !yourName || !amount || !dueDate || !workDesc) {
    statusEl.textContent = "⚠️ Bhai, saari fields bharo pehle!";
    return;
  }

  // ---------- Button disable karo (double click rokne ke liye) ----------
  generateBtn.disabled = true;
  statusEl.textContent = "⏳ AI emails likh raha hai... 10-15 second lagenge";

  // ---------- AI ke liye prompt banao ----------
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

  // ---------- Backend API call karo (Vercel serverless function) ----------
  // Yahan API key NAHI hai — woh /api/generate ke andar safe hai
  try {
    const text = await callGenerateAPI(prompt);

    // ---------- AI ke response ko 3 emails mein todo ----------
    const emails = parseEmails(text);

    // ---------- Har email ko apne textarea mein daalo ----------
    document.getElementById("email1").value = emails[0] || "Email 1 generate nahi hua. Dobara try karo.";
    document.getElementById("email2").value = emails[1] || "Email 2 generate nahi hua. Dobara try karo.";
    document.getElementById("email3").value = emails[2] || "Email 3 generate nahi hua. Dobara try karo.";

    // ---------- Form hide karo, output dikhao ----------
    formSection.classList.add("hidden");
    outputSection.classList.remove("hidden");
    statusEl.textContent = "";
  } catch (err) {
    // ---------- Error aaye toh user ko batao ----------
    console.error("Error:", err);
    statusEl.textContent = "❌ Error: " + err.message + " — thodi der baad try karo";
  } finally {
    // ---------- Button wapas enable karo ----------
    generateBtn.disabled = false;
  }
}

// ============================================
// HELPER: Backend API call with retry logic
// Agar 429 (rate limit) aaye toh 3 baar try karega
// ============================================
async function callGenerateAPI(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    // ---------- Agar rate limit (429) hai toh wait karo ----------
    if (response.status === 429) {
      const waitSec = 5 * (attempt + 1); // 5s, 10s, 15s
      statusEl.textContent = `⏳ Rate limit lagi. ${waitSec} second wait kar raha hoon...`;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue; // dobara try karo
    }

    // ---------- Koi aur error? Toh throw karo ----------
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error ${response.status}`);
    }

    // ---------- Success! Text nikaalo ----------
    const data = await response.json();
    if (!data.text) {
      throw new Error("AI ne khaali response diya");
    }
    return data.text;
  }

  // ---------- 3 retries ke baad bhi fail ----------
  throw new Error("Rate limit khatam nahi hui. 1 minute baad try karo.");
}

// ============================================
// HELPER: AI response ko 3 emails mein todo
// Format: "=== EMAIL 1 ===\n...\n=== EMAIL 2 ===\n...\n=== EMAIL 3 ===\n..."
// ============================================
function parseEmails(text) {
  // "=== EMAIL 1 ===" jaise markers pe split karo
  const parts = text.split(/===\s*EMAIL\s*\d\s*===/i);

  // parts[0] khaali/preamble hota hai — usse skip karo
  // parts[1], parts[2], parts[3] = 3 emails
  return parts.slice(1).map((p) => p.trim());
}