// ============================================
// InvoiceFollow Dashboard — Complete Logic
// Part 1 of 3: State, Auth, Credits, Helpers
// ============================================

// ============================================
// AUTH STATE
// ============================================
let currentUser = null;
let userProfile = null;
let isGuestMode = false;

// ============================================
// APP STATE
// ============================================
let invoices = [];
let settings = {};
let currentFilter = "all";
let searchQuery = "";
let activeInvoiceId = null;
let reminderMode = "whatsapp";
let currentTemplate = "gentle";

// Advanced feature state
let activeCallLogInvoiceId = null;
let activeDemandLetterInvoiceId = null;
let activePaymentConfirmInvoiceId = null;

// Buy credits state
let selectedCreditPack = null;

// CSV import state
let csvData = [];
let csvHeaders = [];
let columnMapping = {};
let importStep = 1;
let validInvoices = [];
let invalidRows = [];

// ---------- Constants ----------
const STORAGE_INVOICES = "invoicefollow_invoices";
const STORAGE_SETTINGS = "invoicefollow_settings";
const STORAGE_GUEST_CREDITS = "invoicefollow_guest_credits";
const STORAGE_API_KEYS = "invoicefollow_api_keys";
const STORAGE_MIGRATED = "invoicefollow_migrated_";

const GUEST_INITIAL_CREDITS = 10;
const SIGNUP_BONUS_CREDITS = 15;
const CREDITS_PER_TASK = 1;

// ============================================
// UI HELPERS — Toast notifications + custom confirm/alert
// Browser alerts ki jagah ye use karo
// ============================================

// Toast show karo — corner mein popup
function showToast(message, type = "info", title = null) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  const defaultTitles = {
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info",
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title || defaultTitles[type])}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Custom alert — replaces browser alert()
function showAlert(message, { title = "Notice", type = "info" } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const icon = document.getElementById("confirmIcon");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");
    const cancelBtn = document.getElementById("confirmCancelBtn");
    const okBtn = document.getElementById("confirmOkBtn");

    if (!modal) {
      alert(message);
      resolve(true);
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;

    icon.className = "confirm-icon";
    if (type === "error") icon.classList.add("confirm-icon-danger");
    else if (type === "success") icon.classList.add("confirm-icon-success");
    else if (type === "warning") icon.classList.add("confirm-icon-warning");

    cancelBtn.style.display = "none";
    okBtn.textContent = "OK";

    modal.classList.remove("hidden");

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      resolve(true);
    });
  });
}

// Custom confirm — replaces browser confirm()
function showConfirm(
  message,
  {
    title = "Confirm",
    type = "info",
    okText = "Confirm",
    cancelText = "Cancel",
  } = {},
) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const icon = document.getElementById("confirmIcon");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");
    const cancelBtn = document.getElementById("confirmCancelBtn");
    const okBtn = document.getElementById("confirmOkBtn");

    if (!modal) {
      resolve(confirm(message));
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;

    icon.className = "confirm-icon";
    if (type === "error") icon.classList.add("confirm-icon-danger");
    else if (type === "success") icon.classList.add("confirm-icon-success");
    else if (type === "warning") icon.classList.add("confirm-icon-warning");

    cancelBtn.style.display = "flex";
    cancelBtn.textContent = cancelText;
    okBtn.textContent = okText;

    modal.classList.remove("hidden");

    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      resolve(true);
    });

    newCancelBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      resolve(false);
    });

    modal.addEventListener(
      "click",
      (e) => {
        if (e.target === modal) {
          modal.classList.add("hidden");
          resolve(false);
        }
      },
      { once: true },
    );
  });
}

// ============================================
// API KEYS — User-provided, multi-provider
// ============================================
function getUserApiKeys() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_API_KEYS) || "{}");
  } catch {
    return {};
  }
}

function setUserApiKeys(keys) {
  localStorage.setItem(STORAGE_API_KEYS, JSON.stringify(keys));
}

function hasAnyApiKey() {
  const keys = getUserApiKeys();
  return !!(
    keys.groq ||
    keys.gemini ||
    keys.openai ||
    keys.grok ||
    keys.anthropic ||
    keys.openrouter
  );
}

// ============================================
// CREDITS — Guest aur Logged-in dono
// ============================================
function getGuestCredits() {
  const val = localStorage.getItem(STORAGE_GUEST_CREDITS);
  if (val === null) {
    localStorage.setItem(STORAGE_GUEST_CREDITS, GUEST_INITIAL_CREDITS);
    return GUEST_INITIAL_CREDITS;
  }
  return parseInt(val, 10) || 0;
}

function setGuestCredits(n) {
  localStorage.setItem(STORAGE_GUEST_CREDITS, n);
  if (userProfile) userProfile.credits = n;
}

function getCurrentCredits() {
  if (isGuestMode) return getGuestCredits();
  return userProfile?.credits || 0;
}

function isPro() {
  if (!userProfile) return false;
  return userProfile.subscription === "pro";
}

function hasEnoughCredits(cost = CREDITS_PER_TASK) {
  if (isPro()) return true;
  if (hasAnyApiKey()) return true;
  return getCurrentCredits() >= cost;
}

// Credits deduct karo
async function deductTaskCredits(taskType, description) {
  // Pro = unlimited
  if (isPro()) {
    return { success: true, source: "pro" };
  }

  // BYOK = unlimited
  if (hasAnyApiKey()) {
    return { success: true, source: "byok" };
  }

  // Credits check
  const currentCredits = getCurrentCredits();
  if (currentCredits < CREDITS_PER_TASK) {
    return { success: false, error: "Insufficient credits" };
  }

  const newBalance = currentCredits - CREDITS_PER_TASK;

  // Guest mode
  if (isGuestMode) {
    setGuestCredits(newBalance);
    await renderUserMenu();
    return { success: true, source: "credits", newBalance };
  }

  // Logged-in — Supabase
  try {
    const { error: updateError } = await window.supabaseClient
      .from("users")
      .update({ credits: newBalance })
      .eq("id", currentUser.id);

    if (updateError) {
      console.error("Credit deduction error:", updateError);
      return { success: false, error: updateError.message };
    }

    await window.supabaseClient.from("credits_transactions").insert({
      user_id: currentUser.id,
      amount: -CREDITS_PER_TASK,
      task_type: taskType,
      description: description,
    });

    userProfile.credits = newBalance;
    await renderUserMenu();
    return { success: true, source: "credits", newBalance };
  } catch (err) {
    console.error("Credit deduction failed:", err);
    return { success: false, error: err.message };
  }
}

// Insufficient credits message + signup prompt
async function showInsufficientCreditsMessage() {
  // Guest mode — signup prompt
  if (isGuestMode) {
    const signupNow = await showConfirm(
      "You've used all your 10 free credits.\n\nSign up free to get 25 more credits + multi-device sync.\n\nYour invoices will be carried over to your account.",
      {
        title: "Out of credits",
        type: "warning",
        okText: "Sign up",
        cancelText: "Not now",
      },
    );
    if (signupNow) {
      window.location.href = "signup.html";
    }
    return;
  }

  // Logged-in but out of credits
  const addKey = await showConfirm(
    `You've used all your credits (${getCurrentCredits()} left).\n\nOption 1: Add your own AI key (free forever)\nOption 2: Buy credits (₹50 = 50 credits)`,
    {
      title: "Out of credits",
      type: "warning",
      okText: "Add API key",
      cancelText: "Later",
    },
  );
  if (addKey) {
    openApiKeyModal();
  }
}

// ============================================
// AUTH — Check + Guest mode support
// ============================================
async function checkAuthAndLoad() {
  currentUser = await getCurrentUser();

  // Guest mode
  if (!currentUser) {
    isGuestMode = true;
    userProfile = {
      full_name: "Guest",
      email: "Not signed in",
      credits: getGuestCredits(),
      subscription: "guest",
    };
    return true;
  }

  // Logged-in
  isGuestMode = false;
  userProfile = await getUserProfile(currentUser.id);

  if (!userProfile) {
    console.error("User profile not found");
    return false;
  }

  await grantSignupBonusIfNeeded();
  return true;
}

// Signup bonus grant karo (ek baar)
async function grantSignupBonusIfNeeded() {
  if (!currentUser || isGuestMode) return;

  const bonusKey = "invoicefollow_bonus_granted_" + currentUser.id;
  if (localStorage.getItem(bonusKey)) return;

  try {
    const profile = await getUserProfile(currentUser.id);
    if (!profile) return;

    const migratedKey = STORAGE_MIGRATED + currentUser.id;
    if (!localStorage.getItem(migratedKey)) return;

    const newBalance = (profile.credits || 0) + SIGNUP_BONUS_CREDITS;
    await window.supabaseClient
      .from("users")
      .update({ credits: newBalance })
      .eq("id", currentUser.id);

    await window.supabaseClient.from("credits_transactions").insert({
      user_id: currentUser.id,
      amount: SIGNUP_BONUS_CREDITS,
      task_type: "signup_bonus",
      description: "Signup bonus credits",
    });

    userProfile.credits = newBalance;
    localStorage.setItem(bonusKey, "true");
  } catch (err) {
    console.error("Bonus grant error:", err);
  }
}

// ============================================
// MIGRATION — localStorage → Supabase
// ============================================
async function migrateLocalDataToSupabase() {
  if (isGuestMode || !currentUser) return;

  const MIGRATED_KEY = STORAGE_MIGRATED + currentUser.id;
  if (localStorage.getItem(MIGRATED_KEY)) return;

  const localInvoices = JSON.parse(
    localStorage.getItem(STORAGE_INVOICES) || "[]",
  );
  const localSettings = JSON.parse(
    localStorage.getItem(STORAGE_SETTINGS) || "{}",
  );

  // Settings sync
  if (Object.keys(localSettings).length > 0) {
    try {
      await window.supabaseClient.from("settings").upsert({
        user_id: currentUser.id,
        default_currency: localSettings.currency || "INR",
        reminder_days: [
          localSettings.days1 || 3,
          localSettings.days2 || 7,
          localSettings.days3 || 14,
        ],
        automation_mode: localSettings.automation || "guided",
      });
    } catch (err) {
      console.error("Settings migration error:", err);
    }
  }

  // Invoices migrate
  if (localInvoices.length === 0) {
    localStorage.setItem(MIGRATED_KEY, "true");
    return;
  }

  const shouldMigrate = await showConfirm(
    `We found ${localInvoices.length} invoice${localInvoices.length > 1 ? "s" : ""} in this browser. Import to your account?`,
    {
      title: "Import local data",
      type: "info",
      okText: "Import",
      cancelText: "Skip",
    },
  );

  if (!shouldMigrate) {
    localStorage.setItem(MIGRATED_KEY, "true");
    return;
  }

  try {
    const invoicesToInsert = localInvoices.map((inv) => ({
      user_id: currentUser.id,
      client_name: inv.clientName,
      client_phone: inv.clientPhone,
      client_email: inv.clientEmail || null,
      invoice_number: inv.invoiceNumber || null,
      amount: inv.amount,
      currency: inv.currency || "INR",
      due_date: inv.dueDate,
      promise_date: inv.promiseDate || null,
      work: inv.work || null,
      notes: inv.notes || null,
      status: inv.status || "pending",
      late_fee_type: inv.lateFeeType || null,
      late_fee_value: inv.lateFeeValue || 0,
      payment_structure: inv.paymentStructure || "full",
      deposit_amount: inv.depositAmount || 0,
      deposit_received: inv.depositReceived || false,
      reminders_sent: inv.remindersSent || 0,
      last_touchpoint: inv.lastTouchpoint || null,
      client_says_paid_at: inv.clientSaysPaidAt || null,
      demand_letter_sent_at: inv.demandLetterSentAt || null,
      paid_at: inv.paidAt || null,
    }));

    const { error } = await window.supabaseClient
      .from("invoices")
      .insert(invoicesToInsert);

    if (error) {
      console.error("Migration error:", error);
      showToast("Could not migrate some data: " + error.message, "error");
      return;
    }

    localStorage.setItem(MIGRATED_KEY, "true");
    showToast(
      `${invoicesToInsert.length} invoice${invoicesToInsert.length > 1 ? "s" : ""} imported to your account`,
      "success",
    );
  } catch (err) {
    console.error("Migration error:", err);
  }
}

// ============================================
// DATA — Load + Save
// ============================================
function loadData() {
  invoices = JSON.parse(localStorage.getItem(STORAGE_INVOICES) || "[]");
  settings = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || "{}");

  if (!settings.yourName) settings.yourName = "";
  if (!settings.yourEmail) settings.yourEmail = "";
  if (!settings.yourPhone) settings.yourPhone = "";
  if (!settings.currency) settings.currency = "INR";
  if (!settings.days1) settings.days1 = 3;
  if (!settings.days2) settings.days2 = 7;
  if (!settings.days3) settings.days3 = 14;
  if (!settings.automation) settings.automation = "guided";
}

function saveInvoices() {
  localStorage.setItem(STORAGE_INVOICES, JSON.stringify(invoices));
}

function saveSettings() {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
}

// ============================================
// HELPERS
// ============================================
function getCurrencySymbol(code) {
  return { INR: "₹", USD: "$", EUR: "€" }[code] || "₹";
}

function formatAmount(amount, currency) {
  const symbol = getCurrencySymbol(currency || settings.currency);
  return symbol + Number(amount || 0).toLocaleString("en-IN");
}

function formatDate(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysDiff(fromISO, toISO) {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================
// LATE FEE CALCULATOR
// ============================================
function calculateLateFee(inv) {
  if (!inv.lateFeeType || !inv.lateFeeValue || !inv.dueDate) return 0;
  if (inv.status === "paid") return 0;

  const today = todayISO();
  if (inv.dueDate >= today) return 0;

  const days = daysDiff(inv.dueDate, today);
  if (days <= 0) return 0;

  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  switch (inv.lateFeeType) {
    case "percent_month":
      return ((inv.amount * inv.lateFeeValue) / 100) * Math.max(1, months);
    case "percent_week":
      return ((inv.amount * inv.lateFeeValue) / 100) * Math.max(1, weeks);
    case "fixed_month":
      return inv.lateFeeValue * Math.max(1, months);
    case "fixed_week":
      return inv.lateFeeValue * Math.max(1, weeks);
    default:
      return 0;
  }
}

function getTotalWithLateFee(inv) {
  return Number(inv.amount || 0) + calculateLateFee(inv);
}

// ============================================
// STATUS CALCULATION
// ============================================
function computeStatus(inv) {
  if (inv.status === "paid") return "paid";
  if (inv.status === "client_says_paid") return "client_says_paid";

  if (
    (inv.paymentStructure === "deposit_50" ||
      inv.paymentStructure === "deposit_30" ||
      inv.paymentStructure === "custom") &&
    !inv.depositReceived
  ) {
    return "deposit_pending";
  }

  if (!inv.dueDate) return "pending";
  const today = todayISO();
  if (inv.dueDate < today) return "overdue";
  return "pending";
}

function computeNextFollowUp(inv) {
  if (!inv.dueDate || inv.status === "paid") return inv.dueDate || null;
  const days = [settings.days1, settings.days2, settings.days3];
  const sent = inv.remindersSent || 0;
  if (sent >= 3) return null;

  const nextDate = new Date(inv.dueDate);
  nextDate.setDate(nextDate.getDate() + days[sent]);
  return nextDate.toISOString().split("T")[0];
}

function isActionDueToday(inv) {
  if (inv.status === "paid") return false;
  const today = todayISO();
  if (inv.promiseDate === today) return true;
  if (inv.dueDate === today) return true;
  const nextFU = computeNextFollowUp(inv);
  if (nextFU && nextFU <= today) return true;
  return false;
}

// ============================================
// END OF PART 1
// Part 2 continues with: greeting, stats,
// today's actions, invoices list, user menu,
// event listeners
// ============================================
// ============================================
// InvoiceFollow Dashboard — Part 2 of 3
// Rendering, user menu, event listeners
// ============================================

// ============================================
// GREETING
// ============================================
function updateGreeting() {
  const hour = new Date().getHours();
  let greet = "Good morning";
  if (hour >= 12 && hour < 17) greet = "Good afternoon";
  if (hour >= 17) greet = "Good evening";

  const name = settings.yourName ? settings.yourName.split(" ")[0] : "";
  document.getElementById("greeting").textContent = name
    ? `${greet}, ${name}`
    : greet;

  const actions = invoices.filter(isActionDueToday);
  const summary = document.getElementById("actionSummary");
  if (actions.length === 0) {
    summary.textContent = "No follow-ups today. You're all caught up.";
  } else {
    summary.textContent = `${actions.length} client${actions.length > 1 ? "s" : ""} need follow-up today`;
  }
}

// ============================================
// STATS
// ============================================
function renderStats() {
  const total = invoices
    .filter((inv) => inv.status !== "paid")
    .reduce((sum, inv) => sum + getTotalWithLateFee(inv), 0);

  const overdue = invoices
    .filter((inv) => computeStatus(inv) === "overdue")
    .reduce((sum, inv) => sum + getTotalWithLateFee(inv), 0);

  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const paidThisMonth = invoices
    .filter(
      (inv) => inv.status === "paid" && inv.paidAt && inv.paidAt >= monthStart,
    )
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  const pendingCount = invoices.filter((inv) => inv.status !== "paid").length;
  const overdueCount = invoices.filter(
    (inv) => computeStatus(inv) === "overdue",
  ).length;
  const paidCount = invoices.filter(
    (inv) => inv.status === "paid" && inv.paidAt && inv.paidAt >= monthStart,
  ).length;

  document.getElementById("statTotal").textContent = formatAmount(total);
  document.getElementById("statTotalSub").textContent =
    `${pendingCount} invoice${pendingCount !== 1 ? "s" : ""}`;
  document.getElementById("statOverdue").textContent = formatAmount(overdue);
  document.getElementById("statOverdueSub").textContent =
    `${overdueCount} invoice${overdueCount !== 1 ? "s" : ""}`;
  document.getElementById("statPaid").textContent = formatAmount(paidThisMonth);
  document.getElementById("statPaidSub").textContent =
    `${paidCount} invoice${paidCount !== 1 ? "s" : ""}`;
}

// ============================================
// TODAY'S ACTIONS
// ============================================
function renderTodayActions() {
  const container = document.getElementById("todayActions");
  const allClear = document.getElementById("allClear");
  const actions = invoices.filter(isActionDueToday);

  container.innerHTML = "";

  // Client says paid → 3 din baad verify banner
  const toConfirm = invoices.filter((inv) => {
    if (inv.status !== "client_says_paid") return false;
    if (!inv.clientSaysPaidAt) return false;
    const daysSince = daysDiff(inv.clientSaysPaidAt, todayISO());
    return daysSince >= 3;
  });

  toConfirm.forEach((inv) => {
    const banner = document.createElement("div");
    banner.className = "confirm-banner";
    banner.innerHTML = `
      <div class="confirm-banner-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div class="confirm-banner-text">
        <strong>${escapeHtml(inv.clientName)}</strong> says they've paid ${formatAmount(getTotalWithLateFee(inv), inv.currency)}. Verify in your bank.
      </div>
      <button class="btn-primary btn-sm" data-action="confirm-payment" data-id="${inv.id}">Verify now</button>
    `;
    container.appendChild(banner);
  });

  if (actions.length === 0) {
    if (toConfirm.length === 0) {
      allClear.classList.remove("hidden");
    } else {
      allClear.classList.add("hidden");
    }
    return;
  }

  allClear.classList.add("hidden");

  actions.forEach((inv) => {
    const card = document.createElement("div");
    card.className = "action-card";

    const status = computeStatus(inv);
    let meta = "";
    if (inv.promiseDate === todayISO()) {
      meta = "Promise date: today";
    } else if (inv.dueDate === todayISO()) {
      meta = "Due today";
    } else if (status === "overdue") {
      const days = daysDiff(inv.dueDate, todayISO());
      meta = `${days} day${days > 1 ? "s" : ""} overdue`;
    } else {
      meta = `Due: ${formatDate(inv.dueDate)}`;
    }

    const lateFee = calculateLateFee(inv);
    const lateFeeNote =
      lateFee > 0
        ? `<span class="late-fee-badge">+${formatAmount(lateFee)} late fee</span>`
        : "";

    card.innerHTML = `
      <div class="action-info">
        <div class="action-client">${escapeHtml(inv.clientName)}${lateFeeNote}</div>
        <div class="action-meta">${meta}</div>
      </div>
      <div class="action-amount">${formatAmount(getTotalWithLateFee(inv), inv.currency)}</div>
      <div class="action-buttons">
        <button class="btn-whatsapp btn-sm" data-action="whatsapp" data-id="${inv.id}">WhatsApp</button>
        <button class="btn-primary btn-sm" data-action="email" data-id="${inv.id}">Email</button>
        <button class="btn-ghost btn-sm" data-action="mark-paid" data-id="${inv.id}">Mark Paid</button>
      </div>
    `;

    container.appendChild(card);
  });
}

// ============================================
// ALL INVOICES LIST
// ============================================
function renderInvoices() {
  const container = document.getElementById("invoiceList");
  const emptyState = document.getElementById("emptyState");

  let filtered = invoices;

  if (currentFilter !== "all") {
    filtered = filtered.filter((inv) => {
      if (currentFilter === "pending") return computeStatus(inv) === "pending";
      if (currentFilter === "overdue") return computeStatus(inv) === "overdue";
      if (currentFilter === "paid") return inv.status === "paid";
      return true;
    });
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (inv) =>
        (inv.clientName || "").toLowerCase().includes(q) ||
        (inv.invoiceNumber || "").toLowerCase().includes(q),
    );
  }

  filtered.sort((a, b) => {
    const sa = computeStatus(a);
    const sb = computeStatus(b);
    if (sa === "overdue" && sb !== "overdue") return -1;
    if (sa !== "overdue" && sb === "overdue") return 1;
    if (sa === "paid" && sb !== "paid") return 1;
    if (sa !== "paid" && sb === "paid") return -1;
    return (a.dueDate || "").localeCompare(b.dueDate || "");
  });

  container.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  filtered.forEach((inv) => {
    const status = computeStatus(inv);
    const row = document.createElement("div");
    row.className = "invoice-row";
    row.dataset.id = inv.id;

    const lateFee = calculateLateFee(inv);
    const lateFeeLine =
      lateFee > 0
        ? `<div class="late-fee-amount">+ ${formatAmount(lateFee, inv.currency)} late fee</div>`
        : "";

    let depositBadge = "";
    if (inv.depositAmount > 0) {
      depositBadge = `<span class="deposit-info ${inv.depositReceived ? "" : "deposit-pending"}">${inv.depositReceived ? "Deposit paid" : "Deposit pending"}</span>`;
    }

    row.innerHTML = `
      <div>
        <div class="inv-client">${escapeHtml(inv.clientName)} ${depositBadge}</div>
        <div class="inv-client-sub">${inv.invoiceNumber ? escapeHtml(inv.invoiceNumber) : ""}</div>
      </div>
      <div>
        <div class="inv-amount">${formatAmount(inv.amount, inv.currency)}</div>
        ${lateFeeLine}
      </div>
      <div class="inv-due">${formatDate(inv.dueDate)}</div>
      <div><span class="inv-status status-${status}">${status.replace(/_/g, " ")}</span></div>
      <div class="inv-actions">
        <button class="btn-ghost btn-sm" data-action="open" data-id="${inv.id}">Open</button>
      </div>
    `;

    container.appendChild(row);
  });
}

// ============================================
// USER MENU — Guest + Logged-in dono support
// ============================================
async function renderUserMenu() {
  const avatarEl = document.getElementById("userAvatar");
  const nameEl = document.getElementById("userName");
  const dropdownNameEl = document.getElementById("dropdownName");
  const dropdownEmailEl = document.getElementById("dropdownEmail");
  const dropdownPlanEl = document.getElementById("dropdownPlan");
  const dropdownUsageEl = document.getElementById("dropdownUsage");
  const signUpBtn = document.getElementById("signUpBtn");
  const signOutBtn = document.getElementById("signOutBtn");

  // Guest mode
  if (isGuestMode) {
    avatarEl.textContent = "GU";
    nameEl.textContent = "Guest";
    dropdownNameEl.textContent = "Guest User";
    dropdownEmailEl.textContent = "Not signed in";
    dropdownPlanEl.textContent = "Free";
    dropdownUsageEl.textContent = `${getGuestCredits()} credits`;
    dropdownUsageEl.classList.add("dropdown-usage");

    if (signUpBtn) signUpBtn.classList.remove("hidden");
    if (signOutBtn) signOutBtn.classList.add("hidden");
    return;
  }

  // Logged-in user
  const name = userProfile.full_name || "User";
  const email = userProfile.email || "—";
  const credits = userProfile.credits || 0;
  const subscription = userProfile.subscription || "free";

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  avatarEl.textContent = initials;
  nameEl.textContent = name.split(" ")[0] || "Account";
  dropdownNameEl.textContent = name;
  dropdownEmailEl.textContent = email;
  dropdownPlanEl.textContent = subscription === "pro" ? "Pro" : "Free";

  if (subscription === "pro") {
    dropdownUsageEl.textContent = "Unlimited";
  } else if (hasAnyApiKey()) {
    dropdownUsageEl.textContent = "Unlimited (BYOK)";
  } else {
    dropdownUsageEl.textContent = `${credits} credits`;
  }
  dropdownUsageEl.classList.add("dropdown-usage");

  if (signUpBtn) signUpBtn.classList.add("hidden");
  if (signOutBtn) signOutBtn.classList.remove("hidden");
}

// ============================================
// REFRESH ALL
// ============================================
async function refreshAll() {
  await renderUserMenu();
  updateGreeting();
  renderStats();
  renderTodayActions();
  renderInvoices();
}

// ============================================
// EVENT LISTENERS
// ============================================
function attachEventListeners() {
  // ---------- Add Invoice ----------
  document
    .getElementById("addInvoiceBtn")
    .addEventListener("click", openAddModal);
  document
    .getElementById("closeAddModal")
    .addEventListener("click", closeAddModal);
  document.getElementById("cancelAdd").addEventListener("click", closeAddModal);
  document
    .getElementById("saveInvoice")
    .addEventListener("click", saveNewInvoice);

  // ---------- Deposit fields conditional show ----------
  const fPaymentStructure = document.getElementById("fPaymentStructure");
  if (fPaymentStructure) {
    fPaymentStructure.addEventListener("change", (e) => {
      const depositFields = document.getElementById("depositFields");
      if (
        e.target.value === "deposit_50" ||
        e.target.value === "deposit_30" ||
        e.target.value === "custom"
      ) {
        depositFields.classList.remove("hidden");
      } else {
        depositFields.classList.add("hidden");
      }
    });
  }

  // ---------- Detail Modal ----------
  const closeDetailBtn = document.getElementById("closeDetailModal");
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", () => {
      document.getElementById("detailModal").classList.add("hidden");
    });
  }

  // ---------- Settings ----------
  document
    .getElementById("settingsBtn")
    .addEventListener("click", openSettingsModal);
  document
    .getElementById("closeSettingsModal")
    .addEventListener("click", closeSettingsModal);
  document
    .getElementById("cancelSettings")
    .addEventListener("click", closeSettingsModal);
  document
    .getElementById("saveSettings")
    .addEventListener("click", saveSettingsFromModal);
  document
    .getElementById("exportCsvBtn")
    .addEventListener("click", exportToCSV);

  // ---------- API Key Modal ----------
  const apiKeyBtn = document.getElementById("apiKeyBtn");
  if (apiKeyBtn) apiKeyBtn.addEventListener("click", openApiKeyModal);

  const closeApiKeyBtn = document.getElementById("closeApiKeyModal");
  if (closeApiKeyBtn)
    closeApiKeyBtn.addEventListener("click", closeApiKeyModal);

  const cancelApiKeyBtn = document.getElementById("cancelApiKey");
  if (cancelApiKeyBtn)
    cancelApiKeyBtn.addEventListener("click", closeApiKeyModal);

  const saveApiKeyBtn = document.getElementById("saveApiKey");
  if (saveApiKeyBtn)
    saveApiKeyBtn.addEventListener("click", saveApiKeysFromModal);

  // ---------- Buy Credits Modal ----------
  const closeBuyCreditsBtn = document.getElementById("closeBuyCreditsModal");
  if (closeBuyCreditsBtn) {
    closeBuyCreditsBtn.addEventListener("click", () => {
      document.getElementById("buyCreditsModal").classList.add("hidden");
    });
  }

  const openApiKeyFromBuyBtn = document.getElementById(
    "openApiKeyFromBuyModal",
  );
  if (openApiKeyFromBuyBtn) {
    openApiKeyFromBuyBtn.addEventListener("click", () => {
      document.getElementById("buyCreditsModal").classList.add("hidden");
      openApiKeyModal();
    });
  }

  const continueWithTemplatesBtn = document.getElementById(
    "continueWithTemplates",
  );
  if (continueWithTemplatesBtn) {
    continueWithTemplatesBtn.addEventListener("click", () => {
      document.getElementById("buyCreditsModal").classList.add("hidden");
    });
  }

  // ---------- Reminder Modal ----------
  document
    .getElementById("closeReminderModal")
    .addEventListener("click", () => {
      document.getElementById("reminderModal").classList.add("hidden");
    });
  document
    .getElementById("sendWhatsappBtn")
    .addEventListener("click", sendWhatsApp);
  document.getElementById("sendEmailBtn").addEventListener("click", sendEmail);
  document
    .getElementById("copyMessageBtn")
    .addEventListener("click", copyMessage);

  // ---------- Template pills ----------
  document.querySelectorAll(".template-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      currentTemplate = pill.dataset.template;
      updateTemplateUI();

      const inv = invoices.find((i) => i.id === activeInvoiceId);
      if (inv) loadTemplateMessage(inv);
    });
  });

  // ---------- Filter buttons ----------
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderInvoices();
    });
  });

  // ---------- Search ----------
  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderInvoices();
  });

  // ---------- User menu dropdown ----------
  document.getElementById("userMenuBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("userDropdown").classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    const dd = document.getElementById("userDropdown");
    const btn = document.getElementById("userMenuBtn");
    if (dd && btn && !dd.contains(e.target) && !btn.contains(e.target)) {
      dd.classList.add("hidden");
    }
  });

  // ---------- Guest: Sign up button ----------
  const signUpBtnEl = document.getElementById("signUpBtn");
  if (signUpBtnEl) {
    signUpBtnEl.addEventListener("click", async () => {
      const ok = await showConfirm(
        "Sign up to save your data and get 25 more credits?\n\nYour invoices will be carried over to your account.",
        { title: "Sign up", type: "info", okText: "Sign up" },
      );
      if (ok) {
        window.location.href = "signup.html";
      }
    });
  }

  // ---------- Logged-in: Sign out button ----------
  const signOutBtnEl = document.getElementById("signOutBtn");
  if (signOutBtnEl) {
    signOutBtnEl.addEventListener("click", async () => {
      const ok = await showConfirm(
        "Sign out? Your data will sync next time you log in.",
        { title: "Sign out", type: "warning", okText: "Sign out" },
      );
      if (ok) {
        await logout();
      }
    });
  }

  // ---------- CSV Import ----------
  document
    .getElementById("importCsvBtn")
    .addEventListener("click", openImportModal);
  document
    .getElementById("closeImportModal")
    .addEventListener("click", closeImportModal);
  document
    .getElementById("cancelImport")
    .addEventListener("click", closeImportModal);
  document
    .getElementById("importBackBtn")
    .addEventListener("click", importGoBack);
  document
    .getElementById("importNextBtn")
    .addEventListener("click", importGoNext);
  document
    .getElementById("importConfirmBtn")
    .addEventListener("click", confirmImport);
  document
    .getElementById("downloadSampleBtn")
    .addEventListener("click", downloadSampleCSV);

  // ---------- CSV drop zone ----------
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("csvFileInput");
  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () =>
      dropZone.classList.remove("dragover"),
    );
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) handleCSVFile(file);
    });
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleCSVFile(file);
    });
  }

  // ---------- Call Log Modal ----------
  document
    .getElementById("closeCallLogModal")
    .addEventListener("click", closeCallLogModal);
  document
    .getElementById("cancelCallLog")
    .addEventListener("click", closeCallLogModal);
  document.getElementById("saveCallLog").addEventListener("click", saveCallLog);

  // ---------- Demand Letter Modal ----------
  document
    .getElementById("closeDemandLetterModal")
    .addEventListener("click", closeDemandLetterModal);
  document
    .getElementById("copyDemandLetterBtn")
    .addEventListener("click", copyDemandLetter);
  document
    .getElementById("downloadDemandLetterBtn")
    .addEventListener("click", downloadDemandLetterPDF);
  document
    .getElementById("sendDemandEmailBtn")
    .addEventListener("click", sendDemandLetterEmail);

  // ---------- Payment Confirm Modal ----------
  document
    .getElementById("closePaymentConfirmModal")
    .addEventListener("click", closePaymentConfirmModal);
  document
    .getElementById("cancelPaymentConfirm")
    .addEventListener("click", closePaymentConfirmModal);
  document
    .getElementById("confirmPaymentBtn")
    .addEventListener("click", confirmPaymentReceived);

  // ---------- Google Sheets Import ----------
  document
    .getElementById("importSheetBtn")
    .addEventListener("click", openSheetModal);
  document
    .getElementById("closeSheetModal")
    .addEventListener("click", closeSheetModal);
  document
    .getElementById("cancelSheet")
    .addEventListener("click", closeSheetModal);
  document
    .getElementById("sheetFetchBtn")
    .addEventListener("click", fetchGoogleSheet);

  // ---------- Delegated events (invoice actions) ----------
  document.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;
    if (!action || !id) return;

    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;

    if (action === "open") openDetailModal(inv);
    if (action === "whatsapp") openReminderModal(inv, "whatsapp");
    if (action === "email") openReminderModal(inv, "email");
    if (action === "mark-paid") markAsPaid(inv);
    if (action === "call-log") openCallLogModal(inv);
    if (action === "client-paid") markClientSaysPaid(inv);
    if (action === "demand-letter") openDemandLetterModal(inv);
    if (action === "confirm-payment") openPaymentConfirmModal(inv);
  });
}

// ============================================
// END OF PART 2
// Part 3 continues with: modals (add, detail,
// reminder, call log, demand letter, settings),
// API key modal, AI calls, Razorpay, CSV, sheets,
// init
// ============================================
// ============================================
// InvoiceFollow Dashboard — Part 3 of 3
// Modals, AI calls, Razorpay, CSV, sheets, init
// ============================================

// ============================================
// ADD INVOICE MODAL
// ============================================
function openAddModal() {
  [
    "fClientName",
    "fClientPhone",
    "fClientEmail",
    "fInvoiceNumber",
    "fAmount",
    "fDueDate",
    "fPromiseDate",
    "fWork",
    "fNotes",
    "fLateFeeValue",
    "fDepositAmount",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("fCurrency").value = settings.currency || "INR";
  document.getElementById("fLateFeeType").value = "";
  document.getElementById("fPaymentStructure").value = "full";
  document.getElementById("fDepositReceived").value = "no";
  document.getElementById("depositFields").classList.add("hidden");

  document.getElementById("addModal").classList.remove("hidden");
}

function closeAddModal() {
  document.getElementById("addModal").classList.add("hidden");
}

function saveNewInvoice() {
  const clientName = document.getElementById("fClientName").value.trim();
  const clientPhone = document.getElementById("fClientPhone").value.trim();
  const clientEmail = document.getElementById("fClientEmail").value.trim();
  const invoiceNumber = document.getElementById("fInvoiceNumber").value.trim();
  const amount = document.getElementById("fAmount").value;
  const currency = document.getElementById("fCurrency").value;
  const dueDate = document.getElementById("fDueDate").value;
  const promiseDate = document.getElementById("fPromiseDate").value;
  const work = document.getElementById("fWork").value.trim();
  const notes = document.getElementById("fNotes").value.trim();

  const lateFeeType = document.getElementById("fLateFeeType").value;
  const lateFeeValue =
    parseFloat(document.getElementById("fLateFeeValue").value) || 0;
  const paymentStructure = document.getElementById("fPaymentStructure").value;
  const depositAmount =
    parseFloat(document.getElementById("fDepositAmount").value) || 0;
  const depositReceived =
    document.getElementById("fDepositReceived").value === "yes";

  if (!clientName || !clientPhone || !amount || !dueDate) {
    showToast(
      "Client name, phone, amount, and due date are required.",
      "warning",
    );
    return;
  }

  const newInvoice = {
    id: "inv_" + Date.now(),
    clientName,
    clientPhone,
    clientEmail,
    invoiceNumber,
    amount: Number(amount),
    currency,
    dueDate,
    promiseDate: promiseDate || null,
    work,
    notes,
    status: "pending",
    remindersSent: 0,
    lastTouchpoint: null,
    createdAt: todayISO(),
    paidAt: null,
    lateFeeType: lateFeeType || null,
    lateFeeValue: lateFeeValue || 0,
    paymentStructure: paymentStructure || "full",
    depositAmount: depositAmount || 0,
    depositReceived: depositReceived || false,
    callLogs: [],
    clientSaysPaidAt: null,
    demandLetterSentAt: null,
  };

  invoices.push(newInvoice);
  saveInvoices();
  closeAddModal();
  refreshAll();
  showToast(`${clientName} added to your invoices`, "success");
}

// ============================================
// DETAIL MODAL
// ============================================
function openDetailModal(inv) {
  activeInvoiceId = inv.id;
  const modal = document.getElementById("detailModal");
  const body = document.getElementById("detailBody");
  const status = computeStatus(inv);

  document.getElementById("detailTitle").textContent =
    `${inv.clientName} — ${formatAmount(inv.amount, inv.currency)}`;

  const timeline = [];
  timeline.push({ date: inv.createdAt, text: "Invoice created", type: "done" });

  if (inv.dueDate) {
    const isPast = inv.dueDate < todayISO();
    timeline.push({
      date: inv.dueDate,
      text: "Due date",
      type: isPast ? "done" : "",
    });
  }

  if (inv.promiseDate) {
    const isToday = inv.promiseDate === todayISO();
    timeline.push({
      date: inv.promiseDate,
      text: "Client promise date",
      type: isToday ? "today" : inv.promiseDate < todayISO() ? "done" : "",
    });
  }

  if (inv.lastTouchpoint) {
    timeline.push({
      date: inv.lastTouchpoint,
      text: "Last contact",
      type: "done",
    });
  }

  if (inv.callLogs && inv.callLogs.length > 0) {
    inv.callLogs.forEach((log) => {
      timeline.push({
        date: log.date,
        text: `Call — ${log.outcome.replace(/_/g, " ")}${log.duration ? ` (${log.duration} min)` : ""}`,
        type: "done",
      });
    });
  }

  if (inv.clientSaysPaidAt) {
    timeline.push({
      date: inv.clientSaysPaidAt,
      text: "Client says paid",
      type: "done",
    });
  }

  if (inv.demandLetterSentAt) {
    timeline.push({
      date: inv.demandLetterSentAt,
      text: "Demand letter sent",
      type: "done",
    });
  }

  if (inv.status === "paid" && inv.paidAt) {
    timeline.push({ date: inv.paidAt, text: "Payment received", type: "done" });
  } else {
    const nextFU = computeNextFollowUp(inv);
    if (nextFU)
      timeline.push({ date: nextFU, text: "Next follow-up", type: "" });
  }

  timeline.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const lateFee = calculateLateFee(inv);

  body.innerHTML = `
    <div class="detail-section">
      <h4>Details</h4>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="inv-status status-${status}">${status.replace(/_/g, " ")}</span></span></div>
      <div class="detail-row"><span class="detail-label">Client Phone</span><span class="detail-value">${escapeHtml(inv.clientPhone)}</span></div>
      ${inv.clientEmail ? `<div class="detail-row"><span class="detail-label">Client Email</span><span class="detail-value">${escapeHtml(inv.clientEmail)}</span></div>` : ""}
      ${inv.invoiceNumber ? `<div class="detail-row"><span class="detail-label">Invoice #</span><span class="detail-value">${escapeHtml(inv.invoiceNumber)}</span></div>` : ""}
      <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">${formatAmount(inv.amount, inv.currency)}</span></div>
      <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value">${formatDate(inv.dueDate)}</span></div>
      ${inv.promiseDate ? `<div class="detail-row"><span class="detail-label">Promise Date</span><span class="detail-value">${formatDate(inv.promiseDate)}</span></div>` : ""}
      ${inv.work ? `<div class="detail-row"><span class="detail-label">Work</span><span class="detail-value">${escapeHtml(inv.work)}</span></div>` : ""}
      ${inv.depositAmount > 0 ? `<div class="detail-row"><span class="detail-label">Deposit</span><span class="detail-value">${formatAmount(inv.depositAmount, inv.currency)} — ${inv.depositReceived ? "Received" : "Pending"}</span></div>` : ""}
      ${lateFee > 0 ? `<div class="detail-row"><span class="detail-label">Late Fee Accrued</span><span class="detail-value" style="color:var(--danger);">+ ${formatAmount(lateFee, inv.currency)}</span></div>` : ""}
      ${lateFee > 0 ? `<div class="detail-row"><span class="detail-label">Total Due</span><span class="detail-value" style="font-weight:700;">${formatAmount(getTotalWithLateFee(inv), inv.currency)}</span></div>` : ""}
      <div class="detail-row"><span class="detail-label">Reminders Sent</span><span class="detail-value">${inv.remindersSent || 0}</span></div>
    </div>

    <div class="detail-section">
      <h4>Timeline</h4>
      <div class="timeline">
        ${timeline
          .map(
            (t) => `
          <div class="timeline-item ${t.type}">
            <div class="timeline-date">${formatDate(t.date)}</div>
            <div class="timeline-text">${t.text}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>

    ${
      inv.notes
        ? `
      <div class="detail-section">
        <h4>Notes</h4>
        <div style="font-size:0.88rem; color:var(--text-muted);">${escapeHtml(inv.notes)}</div>
      </div>
    `
        : ""
    }

    <div class="detail-section">
      <h4>Actions</h4>
      <div class="reminder-actions">
        <button class="btn-whatsapp" data-action="whatsapp" data-id="${inv.id}">WhatsApp</button>
        <button class="btn-primary" data-action="email" data-id="${inv.id}">Email</button>
        ${inv.status !== "paid" ? `<button class="btn-ghost" data-action="call-log" data-id="${inv.id}">Log Call</button>` : ""}
        ${inv.status !== "paid" && inv.status !== "client_says_paid" ? `<button class="btn-ghost" data-action="client-paid" data-id="${inv.id}">Client Says Paid</button>` : ""}
        ${inv.status !== "paid" ? `<button class="btn-ghost" data-action="mark-paid" data-id="${inv.id}">Mark Paid</button>` : ""}
        ${inv.status !== "paid" && (inv.remindersSent || 0) >= 3 ? `<button class="btn-danger-soft" data-action="demand-letter" data-id="${inv.id}">Generate Demand Letter</button>` : ""}
        <button class="btn-ghost btn-danger" id="deleteInvoiceBtn" data-id="${inv.id}">Delete</button>
      </div>
    </div>
  `;

  document
    .getElementById("deleteInvoiceBtn")
    .addEventListener("click", async () => {
      const ok = await showConfirm(
        "Delete this invoice? This cannot be undone.",
        {
          title: "Delete invoice",
          type: "error",
          okText: "Delete",
          cancelText: "Cancel",
        },
      );
      if (!ok) return;

      invoices = invoices.filter((i) => i.id !== inv.id);
      saveInvoices();
      modal.classList.add("hidden");
      refreshAll();
      showToast("Invoice deleted", "success");
    });

  modal.classList.remove("hidden");
}

// ============================================
// REMINDER MODAL — Template default, AI optional
// ============================================
function openReminderModal(inv, mode) {
  activeInvoiceId = inv.id;
  reminderMode = mode;

  document.getElementById("reminderTitle").textContent =
    mode === "whatsapp"
      ? `WhatsApp Reminder — ${inv.clientName}`
      : `Email Reminder — ${inv.clientName}`;

  // Auto-select template based on overdue days
  const overdueDays = inv.dueDate ? daysDiff(inv.dueDate, todayISO()) : 0;
  if (overdueDays >= 14) currentTemplate = "final";
  else if (overdueDays >= 7) currentTemplate = "firm";
  else currentTemplate = "gentle";

  updateTemplateUI();
  updateAIText();
  loadTemplateMessage(inv);

  document.getElementById("reminderModal").classList.remove("hidden");
}

// AI button text update — credits/BYOK status
function updateAIText() {
  const aiTextEl = document.getElementById("aiButtonText");
  const aiBadgeEl = document.getElementById("aiCreditBadge");
  const aiNoteEl = document.getElementById("aiGenerateNote");

  if (!aiTextEl) return;

  if (hasAnyApiKey()) {
    aiTextEl.textContent = "Generate with AI";
    aiBadgeEl.textContent = "Unlimited";
    aiBadgeEl.style.background = "rgba(16, 185, 129, 0.3)";
    aiNoteEl.textContent =
      "You're using your own API key — unlimited AI generations";
    return;
  }

  if (isPro()) {
    aiTextEl.textContent = "Generate with AI";
    aiBadgeEl.textContent = "Pro";
    aiBadgeEl.style.background = "rgba(16, 185, 129, 0.3)";
    aiNoteEl.textContent = "Pro plan — unlimited AI generations";
    return;
  }

  const credits = getCurrentCredits();
  aiBadgeEl.style.background = "rgba(255, 255, 255, 0.2)";
  aiBadgeEl.textContent = "1 credit";

  if (credits < 1) {
    aiTextEl.textContent = "AI (Out of credits)";
    aiNoteEl.textContent = `You have 0 credits. Buy credits or add your own API key.`;
  } else {
    aiTextEl.textContent = "Generate with AI";
    aiNoteEl.textContent = `You have ${credits} credit${credits !== 1 ? "s" : ""} · Each AI generation costs 1 credit`;
  }
}

// Template UI update
function updateTemplateUI() {
  document.querySelectorAll(".template-pill").forEach((pill) => {
    if (pill.dataset.template === currentTemplate) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }
  });
}

// Load template message (instant)
function loadTemplateMessage(inv) {
  const message = buildTemplateMessage(inv, currentTemplate);
  document.getElementById("reminderMessage").value = message;
}

// Template messages — 4 variants
function buildTemplateMessage(inv, templateType) {
  const yourName = settings.yourName || "Your name";
  const amount = formatAmount(inv.amount, inv.currency);
  const invNum = inv.invoiceNumber ? ` #${inv.invoiceNumber}` : "";
  const overdueDays = inv.dueDate ? daysDiff(inv.dueDate, todayISO()) : 0;
  const lateFee = calculateLateFee(inv);
  const totalDue = getTotalWithLateFee(inv);

  const lateFeeLine =
    lateFee > 0
      ? `\n\nAs per our agreement, a late fee of ${formatAmount(lateFee, inv.currency)} has accrued. Total due: ${formatAmount(totalDue, inv.currency)}.`
      : "";

  switch (templateType) {
    case "gentle":
      return `Hi ${inv.clientName},

Just circling back on invoice${invNum} for ${amount} — it was due on ${formatDate(inv.dueDate)}.

I know things get busy, so flagging it in case it slipped through.${lateFeeLine}

Could you confirm a payment date? If there's an issue, let me know so we can sort it out.

Thanks,
${yourName}`;

    case "firm":
      return `Hi ${inv.clientName},

Following up again on invoice${invNum} for ${amount}, which was due on ${formatDate(inv.dueDate)}. It's now ${overdueDays} days past due.${lateFeeLine}

Could you confirm when payment will be processed? I'd appreciate a firm date.

Thanks,
${yourName}`;

    case "final":
      return `Hi ${inv.clientName},

Invoice${invNum} for ${amount} is now ${overdueDays} days overdue. I haven't heard back from my previous reminders.${lateFeeLine}

If I don't receive payment or a clear plan by this Friday, I'll need to pause future work. I'd rather avoid that — let me know how you'd like to proceed.

Thanks,
${yourName}`;

    case "short":
      return `Hi ${inv.clientName},

Quick reminder — invoice${invNum} for ${amount} is due.${lateFeeLine}

Could you process the payment this week?

Thanks,
${yourName}`;

    default:
      return buildTemplateMessage(inv, "gentle");
  }
}

// ============================================
// AI GENERATION — Optional
// ============================================
async function generateWithAI() {
  const inv = invoices.find((i) => i.id === activeInvoiceId);
  if (!inv) return;

  // Credits check
  if (!hasAnyApiKey() && !isPro() && getCurrentCredits() < CREDITS_PER_TASK) {
    showBuyCreditsModal();
    return;
  }

  const messageEl = document.getElementById("reminderMessage");
  const aiButton = document.getElementById("generateWithAIButton");
  const aiTextEl = document.getElementById("aiButtonText");

  aiButton.disabled = true;
  const originalText = aiTextEl.textContent;
  aiTextEl.textContent = "Generating...";
  messageEl.value =
    "AI is writing a personalized message...\n\nThis may take 5-10 seconds.";

  try {
    const message = await generateReminderMessageWithAI(inv);
    messageEl.value = message;
    updateAIText();
  } catch (err) {
    console.error("AI generation failed:", err);
    messageEl.value = buildTemplateMessage(inv, currentTemplate);
    showToast(
      "AI is temporarily unavailable. Using a template instead.",
      "warning",
      "AI generation failed",
    );
  } finally {
    aiButton.disabled = false;
    aiTextEl.textContent = originalText;
  }
}

// AI se reminder generate karo
async function generateReminderMessageWithAI(inv) {
  const overdueDays = inv.dueDate ? daysDiff(inv.dueDate, todayISO()) : 0;
  const lateFee = calculateLateFee(inv);
  const yourName = settings.yourName || "Your name";

  const prompt = `You are an expert at writing polite but effective payment reminder emails for freelancers.

Write ONE short email (under 120 words) to a client about an overdue invoice.

Situation:
- Freelancer name: ${yourName}
- Client name: ${inv.clientName}
- Amount owed: ${formatAmount(inv.amount, inv.currency)}
- Due date: ${formatDate(inv.dueDate)}
- Overdue days: ${overdueDays}
- Work done: ${inv.work || "services rendered"}
${lateFee > 0 ? `- Late fee accrued: ${formatAmount(lateFee, inv.currency)}` : ""}

Tone:
${overdueDays >= 14 ? "Firm, professional, mention consequences (pause work / late fee)" : overdueDays >= 7 ? "Firm but polite, ask for payment date" : "Friendly nudge, assume oversight"}

Rules:
- Start with "Hi {client name},"
- Include a subject line at the top
- Don't apologize for asking
- Give them an "out" if early stage
- Sign off with freelancer name
- No emojis
- Return ONLY the email text, no JSON, no explanation

Format:
Subject: [subject line]

[email body]`;

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      taskType: "reminder",
      userApiKeys: getUserApiKeys(),
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "AI generation failed");
  }

  // Credits deduct karo success ke baad
  const creditResult = await deductTaskCredits(
    "reminder",
    `AI reminder for ${inv.clientName}`,
  );
  if (creditResult.source === "credits") {
    console.log(`✓ 1 credit deducted. New balance: ${creditResult.newBalance}`);
  } else if (creditResult.source === "byok") {
    console.log("✓ BYOK user — no credits deducted");
  }

  return data.text;
}

// ============================================
// SEND WHATSAPP / EMAIL
// ============================================
async function sendWhatsApp() {
  const inv = invoices.find((i) => i.id === activeInvoiceId);
  if (!inv) return;

  const message = document.getElementById("reminderMessage").value;
  const phone = (inv.clientPhone || "").replace(/[^0-9]/g, "");
  if (!phone) {
    showToast(
      "Client phone number is missing. Please add it first.",
      "warning",
    );
    return;
  }

  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    "_blank",
  );

  inv.remindersSent = (inv.remindersSent || 0) + 1;
  inv.lastTouchpoint = todayISO();
  saveInvoices();
  document.getElementById("reminderModal").classList.add("hidden");
  refreshAll();
  showToast("WhatsApp opened — send the message to complete", "success");
}

async function sendEmail() {
  const inv = invoices.find((i) => i.id === activeInvoiceId);
  if (!inv) return;

  const message = document.getElementById("reminderMessage").value;
  const subject = inv.invoiceNumber
    ? `Invoice ${inv.invoiceNumber} — Follow-up`
    : `Invoice Follow-up`;

  try {
    await navigator.clipboard.writeText(message);
  } catch (e) {}

  if (inv.clientEmail) {
    const mailto = `mailto:${inv.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = mailto;
    showToast("Email client opened — message copied to clipboard", "success");
  } else {
    showToast("Client email missing. Message copied to clipboard.", "warning");
  }

  inv.remindersSent = (inv.remindersSent || 0) + 1;
  inv.lastTouchpoint = todayISO();
  saveInvoices();
  document.getElementById("reminderModal").classList.add("hidden");
  refreshAll();
}

function copyMessage() {
  const message = document.getElementById("reminderMessage").value;
  navigator.clipboard.writeText(message);
  const btn = document.getElementById("copyMessageBtn");
  const orig = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = orig), 1500);
}

// ============================================
// MARK AS PAID
// ============================================
async function markAsPaid(inv) {
  const ok = await showConfirm(
    `Mark payment received from ${inv.clientName}?\n\nAmount: ${formatAmount(getTotalWithLateFee(inv), inv.currency)}`,
    { title: "Confirm payment", type: "success", okText: "Mark as paid" },
  );
  if (!ok) return;

  inv.status = "paid";
  inv.paidAt = todayISO();
  saveInvoices();
  document.getElementById("detailModal")?.classList.add("hidden");
  refreshAll();
  showToast(`Payment marked for ${inv.clientName}`, "success");
}

// ============================================
// CALL LOG
// ============================================
function openCallLogModal(inv) {
  activeCallLogInvoiceId = inv.id;
  document.getElementById("callDate").value = todayISO();
  document.getElementById("callDuration").value = "";
  document.getElementById("callOutcome").value = "answered";
  document.getElementById("callNotes").value = "";
  document.getElementById("callLogModal").classList.remove("hidden");
}

function closeCallLogModal() {
  document.getElementById("callLogModal").classList.add("hidden");
  activeCallLogInvoiceId = null;
}

function saveCallLog() {
  const inv = invoices.find((i) => i.id === activeCallLogInvoiceId);
  if (!inv) return;

  const date = document.getElementById("callDate").value;
  const duration = parseInt(document.getElementById("callDuration").value) || 0;
  const outcome = document.getElementById("callOutcome").value;
  const notes = document.getElementById("callNotes").value.trim();

  if (!date) {
    showToast("Please enter the call date.", "warning");
    return;
  }

  if (!inv.callLogs) inv.callLogs = [];

  inv.callLogs.push({
    date,
    duration,
    outcome,
    notes,
    loggedAt: new Date().toISOString(),
  });
  inv.lastTouchpoint = date;
  saveInvoices();
  closeCallLogModal();
  refreshAll();
  showToast("Call logged", "success");
}

// ============================================
// CLIENT SAYS PAID
// ============================================
async function markClientSaysPaid(inv) {
  const ok = await showConfirm(
    `Mark "${inv.clientName}" as "Client says paid"?\n\nYou'll be reminded to verify in 3 days.`,
    { title: "Client says paid", type: "info", okText: "Confirm" },
  );
  if (!ok) return;

  inv.status = "client_says_paid";
  inv.clientSaysPaidAt = todayISO();
  inv.lastTouchpoint = todayISO();
  saveInvoices();
  document.getElementById("detailModal")?.classList.add("hidden");
  refreshAll();
  showToast(`${inv.clientName} marked as paid — verify in 3 days`, "info");
}

function openPaymentConfirmModal(inv) {
  activePaymentConfirmInvoiceId = inv.id;
  document.getElementById("confirmClientName").textContent = inv.clientName;
  document.getElementById("confirmAmount").textContent = formatAmount(
    getTotalWithLateFee(inv),
    inv.currency,
  );
  document.getElementById("confirmMarkedDate").textContent = formatDate(
    inv.clientSaysPaidAt,
  );
  document.getElementById("paymentConfirmModal").classList.remove("hidden");
}

function closePaymentConfirmModal() {
  document.getElementById("paymentConfirmModal").classList.add("hidden");
  activePaymentConfirmInvoiceId = null;
}

function confirmPaymentReceived() {
  const inv = invoices.find((i) => i.id === activePaymentConfirmInvoiceId);
  if (!inv) return;

  inv.status = "paid";
  inv.paidAt = todayISO();
  saveInvoices();
  closePaymentConfirmModal();
  refreshAll();
  showToast(`Payment confirmed for ${inv.clientName}`, "success");
}

// ============================================
// DEMAND LETTER — Template default, AI optional
// ============================================
async function openDemandLetterModal(inv) {
  activeDemandLetterInvoiceId = inv.id;
  document.getElementById("demandLetterContent").value =
    buildTemplateDemandLetter(inv);
  document.getElementById("demandLetterModal").classList.remove("hidden");
}

// Template-based demand letter
function buildTemplateDemandLetter(inv) {
  const yourName = settings.yourName || "[Your Name]";
  const totalDue = getTotalWithLateFee(inv);
  const today = new Date();
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);

  const deadlineStr = deadline.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayStr = today.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `FORMAL DEMAND FOR PAYMENT

Date: ${todayStr}

To:
${inv.clientName}
${inv.clientEmail || ""}
${inv.clientPhone || ""}

Subject: FINAL NOTICE — Overdue Invoice${inv.invoiceNumber ? " #" + inv.invoiceNumber : ""} for ${formatAmount(totalDue, inv.currency)}

Dear ${inv.clientName},

This is a formal demand for payment of an overdue invoice. Despite multiple reminders sent over the past three weeks, the payment has not been received.

Invoice Details:
- Invoice Number: ${inv.invoiceNumber || "N/A"}
- Original Amount: ${formatAmount(inv.amount, inv.currency)}
- Due Date: ${formatDate(inv.dueDate)}
${inv.work ? "- Work Performed: " + inv.work : ""}
- TOTAL AMOUNT NOW DUE: ${formatAmount(totalDue, inv.currency)}

We have made several attempts to resolve this matter amicably through reminders sent on multiple occasions. As the payment remains outstanding, we are now forced to issue this formal demand.

DEMAND: Full payment of ${formatAmount(totalDue, inv.currency)} is required on or before ${deadlineStr}.

If payment is not received by this date, we will be left with no option but to pursue legal remedies available to us, including:

1. Initiating formal recovery proceedings
2. Seeking additional interest and legal costs
3. Reporting the matter to relevant authorities

Please confirm the payment or provide a firm commitment date in writing.

Sincerely,

${yourName}
${settings.yourEmail || ""}
${settings.yourPhone || ""}`;
}

function closeDemandLetterModal() {
  document.getElementById("demandLetterModal").classList.add("hidden");
  activeDemandLetterInvoiceId = null;
}

function copyDemandLetter() {
  const content = document.getElementById("demandLetterContent").value;
  navigator.clipboard.writeText(content);
  const btn = document.getElementById("copyDemandLetterBtn");
  const orig = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = orig), 1500);
}

function downloadDemandLetterPDF() {
  const content = document.getElementById("demandLetterContent").value;
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Demand Letter</title>
      <style>
        body { font-family: Georgia, serif; line-height: 1.7; padding: 40px; max-width: 800px; margin: 0 auto; color: #000; }
        pre { white-space: pre-wrap; font-family: Georgia, serif; font-size: 13px; }
      </style>
    </head>
    <body>
      <pre>${content.replace(/</g, "&lt;")}</pre>
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

async function sendDemandLetterEmail() {
  const inv = invoices.find((i) => i.id === activeDemandLetterInvoiceId);
  if (!inv) return;

  const content = document.getElementById("demandLetterContent").value;
  const subject = `FINAL NOTICE: Overdue Invoice${inv.invoiceNumber ? " #" + inv.invoiceNumber : ""}`;

  if (!inv.clientEmail) {
    showToast(
      "Client email is missing. Letter copied to clipboard.",
      "warning",
    );
    navigator.clipboard.writeText(content);
    return;
  }

  inv.demandLetterSentAt = todayISO();
  inv.lastTouchpoint = todayISO();
  saveInvoices();

  const mailto = `mailto:${inv.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;
  window.location.href = mailto;

  closeDemandLetterModal();
  refreshAll();
  showToast("Demand letter opened in your email client", "success");
}

// ============================================
// SETTINGS MODAL
// ============================================
function openSettingsModal() {
  document.getElementById("sYourName").value = settings.yourName || "";
  document.getElementById("sYourEmail").value = settings.yourEmail || "";
  document.getElementById("sYourPhone").value = settings.yourPhone || "";
  document.getElementById("sCurrency").value = settings.currency || "INR";
  document.getElementById("sDay1").value = settings.days1 || 3;
  document.getElementById("sDay2").value = settings.days2 || 7;
  document.getElementById("sDay3").value = settings.days3 || 14;

  const autoRadio = document.querySelector(
    `input[name="automation"][value="${settings.automation || "guided"}"]`,
  );
  if (autoRadio) autoRadio.checked = true;

  document.getElementById("settingsModal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.add("hidden");
}

function saveSettingsFromModal() {
  settings.yourName = document.getElementById("sYourName").value.trim();
  settings.yourEmail = document.getElementById("sYourEmail").value.trim();
  settings.yourPhone = document.getElementById("sYourPhone").value.trim();
  settings.currency = document.getElementById("sCurrency").value;
  settings.days1 = Number(document.getElementById("sDay1").value) || 3;
  settings.days2 = Number(document.getElementById("sDay2").value) || 7;
  settings.days3 = Number(document.getElementById("sDay3").value) || 14;

  const autoRadio = document.querySelector('input[name="automation"]:checked');
  if (autoRadio) settings.automation = autoRadio.value;

  saveSettings();
  closeSettingsModal();
  refreshAll();
  showToast("Settings saved", "success");
}

function exportToCSV() {
  if (invoices.length === 0) {
    showToast("No invoices to export.", "warning");
    return;
  }

  const headers = [
    "Client",
    "Phone",
    "Email",
    "Invoice#",
    "Amount",
    "Currency",
    "Due Date",
    "Promise Date",
    "Status",
    "Late Fee",
    "Total Due",
    "Reminders Sent",
    "Created",
    "Paid At",
  ];
  const rows = invoices.map((inv) => [
    inv.clientName,
    inv.clientPhone,
    inv.clientEmail,
    inv.invoiceNumber,
    inv.amount,
    inv.currency,
    inv.dueDate,
    inv.promiseDate,
    computeStatus(inv),
    calculateLateFee(inv),
    getTotalWithLateFee(inv),
    inv.remindersSent || 0,
    inv.createdAt,
    inv.paidAt || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoicefollow-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV exported", "success");
}

// ============================================
// API KEY MODAL — Multi-provider
// ============================================
function openApiKeyModal() {
  const keys = getUserApiKeys();
  document.getElementById("groqKeyInput").value = keys.groq || "";
  document.getElementById("geminiKeyInput").value = keys.gemini || "";
  document.getElementById("openaiKeyInput").value = keys.openai || "";
  document.getElementById("apiKeyStatus").textContent = "";
  document.getElementById("apiKeyStatus").className = "import-hint";
  document.getElementById("apiKeyModal").classList.remove("hidden");
}

function closeApiKeyModal() {
  document.getElementById("apiKeyModal").classList.add("hidden");
}

function saveApiKeysFromModal() {
  const groq = document.getElementById("groqKeyInput").value.trim();
  const gemini = document.getElementById("geminiKeyInput").value.trim();
  const openai = document.getElementById("openaiKeyInput").value.trim();
  const statusEl = document.getElementById("apiKeyStatus");

  if (groq && !groq.startsWith("gsk_")) {
    statusEl.textContent = "Groq key should start with 'gsk_'.";
    statusEl.className = "import-hint";
    return;
  }
  if (gemini && !gemini.startsWith("AIza")) {
    statusEl.textContent = "Gemini key should start with 'AIza'.";
    statusEl.className = "import-hint";
    return;
  }
  if (openai && !openai.startsWith("sk-")) {
    statusEl.textContent = "OpenAI key should start with 'sk-'.";
    statusEl.className = "import-hint";
    return;
  }

  if (!groq && !gemini && !openai) {
    statusEl.textContent = "Please enter at least one API key.";
    statusEl.className = "import-hint";
    return;
  }

  const keys = {};
  if (groq) keys.groq = groq;
  if (gemini) keys.gemini = gemini;
  if (openai) keys.openai = openai;
  setUserApiKeys(keys);

  statusEl.textContent = "Saved! You now have unlimited free AI tasks.";
  statusEl.className = "import-hint success";

  setTimeout(async () => {
    closeApiKeyModal();
    await renderUserMenu();
    showToast("API key saved. AI generation is now unlimited.", "success");
  }, 1500);
}

// ============================================
// BUY CREDITS MODAL + Razorpay
// ============================================
function showBuyCreditsModal() {
  const modal = document.getElementById("buyCreditsModal");
  if (!modal) return;

  selectedCreditPack = null;
  const statusEl = document.getElementById("buyCreditsStatus");
  if (statusEl) statusEl.textContent = "";

  document
    .querySelectorAll(".credit-pack")
    .forEach((p) => p.classList.remove("selected"));

  const hintEl = document.getElementById("buyCreditsHint");
  if (hintEl && isGuestMode) {
    hintEl.innerHTML =
      "⚠️ <strong>Sign up first</strong> to buy credits. Guest accounts cannot purchase — only BYOK.";
  } else if (hintEl) {
    hintEl.textContent =
      "Pick a credit pack. Credits never expire — use them whenever you need AI.";
  }

  // Clone to remove old listeners
  document.querySelectorAll(".credit-pack").forEach((pack) => {
    const newPack = pack.cloneNode(true);
    pack.parentNode.replaceChild(newPack, pack);
  });

  // Fresh listeners
  document.querySelectorAll(".credit-pack").forEach((pack) => {
    pack.addEventListener("click", async () => {
      // Guest check — custom confirm
      if (isGuestMode) {
        const goSignup = await showConfirm(
          "Buying credits requires an account.\n\nSign up free — you'll also get 15 bonus credits (25 total).",
          {
            title: "Sign up required",
            type: "info",
            okText: "Sign up",
            cancelText: "Not now",
          },
        );
        if (goSignup) {
          window.location.href = "signup.html";
        }
        return;
      }

      document
        .querySelectorAll(".credit-pack")
        .forEach((p) => p.classList.remove("selected"));
      pack.classList.add("selected");

      selectedCreditPack = {
        credits: parseInt(pack.dataset.credits, 10),
        amount: parseInt(pack.dataset.amount, 10),
      };

      startRazorpayCheckout();
    });
  });

  modal.classList.remove("hidden");
}

async function startRazorpayCheckout() {
  if (!selectedCreditPack) return;

  const statusEl = document.getElementById("buyCreditsStatus");
  if (statusEl) statusEl.textContent = "Opening payment...";

  try {
    const orderResponse = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: selectedCreditPack.amount,
        currency: "INR",
        credits: selectedCreditPack.credits,
        userId: currentUser?.id || "guest",
      }),
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok || !orderData.success) {
      throw new Error(orderData.error || "Order creation failed");
    }

    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "InvoiceFollow",
      description: `${selectedCreditPack.credits} AI credits`,
      order_id: orderData.orderId,
      handler: function (response) {
        verifyPayment(
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature,
        );
      },
      prefill: {
        name: userProfile?.full_name || "",
        email: userProfile?.email || "",
      },
      theme: { color: "#4f46e5" },
      modal: {
        ondismiss: function () {
          if (statusEl) statusEl.textContent = "";
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
    if (statusEl) statusEl.textContent = "";
  } catch (err) {
    console.error("Checkout error:", err);
    if (statusEl) statusEl.textContent = "Error: " + err.message;
    showToast("Could not start payment: " + err.message, "error");
  }
}

async function verifyPayment(orderId, paymentId, signature) {
  const statusEl = document.getElementById("buyCreditsStatus");
  if (statusEl) statusEl.textContent = "Verifying payment...";

  try {
    const response = await fetch("/api/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        userId: currentUser?.id,
        credits: selectedCreditPack.credits,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Verification failed");
    }

    if (userProfile) userProfile.credits = data.newBalance;

    if (statusEl) {
      statusEl.textContent = `✓ ${data.creditsAdded} credits added! New balance: ${data.newBalance}`;
    }

    await renderUserMenu();
    showToast(`${data.creditsAdded} credits added to your account`, "success");

    setTimeout(() => {
      document.getElementById("buyCreditsModal").classList.add("hidden");
    }, 2000);
  } catch (err) {
    console.error("Verify error:", err);
    if (statusEl) statusEl.textContent = "Error: " + err.message;
    showToast(
      "Payment verification failed. Contact support with payment ID: " +
        paymentId,
      "error",
    );
  }
}

// ============================================
// CSV IMPORT
// ============================================
function openImportModal() {
  csvData = [];
  csvHeaders = [];
  columnMapping = {};
  importStep = 1;
  validInvoices = [];
  invalidRows = [];

  document.getElementById("csvFileInput").value = "";
  document.getElementById("importStep1").classList.remove("hidden");
  document.getElementById("importStep2").classList.add("hidden");
  document.getElementById("importStep3").classList.add("hidden");
  document.getElementById("importNextBtn").classList.add("hidden");
  document.getElementById("importConfirmBtn").classList.add("hidden");
  document.getElementById("importBackBtn").classList.add("hidden");

  document.getElementById("importModal").classList.remove("hidden");
}

function closeImportModal() {
  document.getElementById("importModal").classList.add("hidden");
}

function handleCSVFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showToast(
      "Only .csv files are supported. Please export your Excel file as CSV first.",
      "warning",
    );
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast("File is too large. Please upload a file under 5MB.", "warning");
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.data.length === 0) {
        showToast("The CSV file is empty.", "warning");
        return;
      }

      if (results.data.length > 500) {
        showToast("You can import up to 500 invoices at a time.", "warning");
        return;
      }

      csvData = results.data;
      csvHeaders = results.meta.fields || [];
      autoMapColumns();
      goToStep(2);
    },
    error: function (err) {
      showToast("Could not parse CSV: " + err.message, "error");
    },
  });
}

function autoMapColumns() {
  const headerLower = csvHeaders.map((h) => h.toLowerCase().trim());

  const fieldPatterns = {
    clientName: [
      "client name",
      "client",
      "name",
      "customer",
      "customer name",
      "party",
      "party name",
    ],
    clientPhone: [
      "phone",
      "mobile",
      "whatsapp",
      "contact",
      "phone number",
      "mobile number",
    ],
    clientEmail: ["email", "e-mail", "mail", "email id", "email address"],
    invoiceNumber: [
      "invoice",
      "invoice #",
      "invoice no",
      "invoice number",
      "inv",
      "inv no",
      "bill no",
    ],
    amount: ["amount", "total", "value", "invoice amount", "amt", "price"],
    currency: ["currency", "curr"],
    dueDate: ["due date", "due", "due on", "payment due", "duedate"],
    promiseDate: [
      "promise date",
      "promise",
      "promised date",
      "commitment date",
    ],
    work: ["work", "description", "service", "project", "notes", "details"],
    notes: ["notes", "remarks", "comment", "comments"],
  };

  Object.keys(fieldPatterns).forEach((field) => {
    const patterns = fieldPatterns[field];
    for (let i = 0; i < headerLower.length; i++) {
      if (patterns.includes(headerLower[i])) {
        columnMapping[field] = csvHeaders[i];
        return;
      }
    }
  });
}

function renderMappingUI() {
  const fields = [
    { key: "clientName", label: "Client Name", required: true },
    { key: "clientPhone", label: "Client Phone", required: true },
    { key: "clientEmail", label: "Client Email", required: false },
    { key: "invoiceNumber", label: "Invoice Number", required: false },
    { key: "amount", label: "Amount", required: true },
    { key: "currency", label: "Currency", required: false },
    { key: "dueDate", label: "Due Date", required: true },
    { key: "promiseDate", label: "Promise Date", required: false },
    { key: "work", label: "Work Description", required: false },
    { key: "notes", label: "Notes", required: false },
  ];

  const grid = document.getElementById("mappingGrid");
  grid.innerHTML = "";

  fields.forEach((field) => {
    const row = document.createElement("div");
    row.className = "mapping-row";

    const required = field.required
      ? '<span class="mapping-field-required">*</span>'
      : "";

    const options = ['<option value="">— Skip —</option>']
      .concat(
        csvHeaders.map((h) => {
          const selected = columnMapping[field.key] === h ? "selected" : "";
          return `<option value="${escapeHtml(h)}" ${selected}>${escapeHtml(h)}</option>`;
        }),
      )
      .join("");

    row.innerHTML = `
      <div class="mapping-field">${field.label}${required}</div>
      <div class="mapping-arrow">→</div>
      <select class="mapping-select" data-field="${field.key}">
        ${options}
      </select>
    `;

    grid.appendChild(row);
  });

  document.querySelectorAll(".mapping-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const field = e.target.dataset.field;
      const value = e.target.value;
      if (value) {
        columnMapping[field] = value;
      } else {
        delete columnMapping[field];
      }
      updateImportNextButton();
    });
  });

  document.getElementById("csvRowCount").textContent = csvData.length;
  updateImportNextButton();
}

function updateImportNextButton() {
  const required = ["clientName", "clientPhone", "amount", "dueDate"];
  const allMapped = required.every((f) => columnMapping[f]);

  const btn = document.getElementById("importNextBtn");
  if (allMapped) {
    btn.disabled = false;
    btn.classList.remove("hidden");
  } else {
    btn.disabled = true;
  }

  document.querySelectorAll(".mapping-select").forEach((sel) => {
    const field = sel.dataset.field;
    if (required.includes(field) && !sel.value) {
      sel.classList.add("error");
    } else {
      sel.classList.remove("error");
    }
  });
}

function parseDate(str) {
  if (!str) return null;
  str = String(str).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let day = m[1].padStart(2, "0");
    let month = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }

  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return null;
}

function parseAmount(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[₹$€,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

function cleanPhone(str) {
  if (!str) return "";
  return String(str).replace(/[^0-9]/g, "");
}

function validateAndBuildInvoices() {
  validInvoices = [];
  invalidRows = [];

  csvData.forEach((row, idx) => {
    const errors = [];

    const clientName = columnMapping.clientName
      ? String(row[columnMapping.clientName] || "").trim()
      : "";
    const clientPhone = columnMapping.clientPhone
      ? cleanPhone(row[columnMapping.clientPhone])
      : "";
    const clientEmail = columnMapping.clientEmail
      ? String(row[columnMapping.clientEmail] || "").trim()
      : "";
    const invoiceNumber = columnMapping.invoiceNumber
      ? String(row[columnMapping.invoiceNumber] || "").trim()
      : "";
    const amountRaw = columnMapping.amount ? row[columnMapping.amount] : "";
    const currencyRaw = columnMapping.currency
      ? String(row[columnMapping.currency] || "")
          .trim()
          .toUpperCase()
      : "";
    const dueDateRaw = columnMapping.dueDate ? row[columnMapping.dueDate] : "";
    const promiseDateRaw = columnMapping.promiseDate
      ? row[columnMapping.promiseDate]
      : "";
    const work = columnMapping.work
      ? String(row[columnMapping.work] || "").trim()
      : "";
    const notes = columnMapping.notes
      ? String(row[columnMapping.notes] || "").trim()
      : "";

    if (!clientName) errors.push("Client name missing");
    if (!clientPhone) errors.push("Phone number missing");
    if (clientPhone && clientPhone.length < 10)
      errors.push("Phone number invalid (10+ digits required)");

    const amount = parseAmount(amountRaw);
    if (amount === null) errors.push("Amount missing or invalid");

    const dueDate = parseDate(dueDateRaw);
    if (!dueDate) errors.push("Due date missing or invalid");

    const promiseDate = promiseDateRaw ? parseDate(promiseDateRaw) : null;
    if (promiseDateRaw && !promiseDate)
      errors.push("Promise date format invalid");

    const validCurrencies = ["INR", "USD", "EUR"];
    const currency = validCurrencies.includes(currencyRaw)
      ? currencyRaw
      : settings.currency || "INR";

    if (errors.length > 0) {
      invalidRows.push({ rowIndex: idx + 1, row, errors });
      return;
    }

    validInvoices.push({
      id:
        "inv_" +
        Date.now() +
        "_" +
        idx +
        "_" +
        Math.random().toString(36).slice(2, 7),
      clientName,
      clientPhone: "+" + clientPhone,
      clientEmail,
      invoiceNumber,
      amount,
      currency,
      dueDate,
      promiseDate,
      work,
      notes,
      status: "pending",
      remindersSent: 0,
      lastTouchpoint: null,
      createdAt: todayISO(),
      paidAt: null,
      lateFeeType: null,
      lateFeeValue: 0,
      paymentStructure: "full",
      depositAmount: 0,
      depositReceived: false,
      callLogs: [],
      clientSaysPaidAt: null,
      demandLetterSentAt: null,
    });
  });
}

function renderPreviewUI() {
  validateAndBuildInvoices();

  document.getElementById("validCount").textContent = validInvoices.length;
  document.getElementById("invalidCount").textContent = invalidRows.length;

  const table = document.getElementById("previewTable");
  const previewInvoices = validInvoices.slice(0, 20);

  let html = `
    <thead>
      <tr>
        <th>Client</th>
        <th>Phone</th>
        <th>Invoice #</th>
        <th>Amount</th>
        <th>Due Date</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
  `;

  previewInvoices.forEach((inv) => {
    html += `
      <tr>
        <td>${escapeHtml(inv.clientName)}</td>
        <td>${escapeHtml(inv.clientPhone)}</td>
        <td>${escapeHtml(inv.invoiceNumber || "—")}</td>
        <td>${formatAmount(inv.amount, inv.currency)}</td>
        <td>${formatDate(inv.dueDate)}</td>
        <td><span class="inv-status status-pending">pending</span></td>
      </tr>
    `;
  });

  if (validInvoices.length > 20) {
    html += `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1rem;">+ ${validInvoices.length - 20} more...</td></tr>`;
  }

  html += "</tbody>";
  table.innerHTML = html;

  const errBox = document.getElementById("invalidErrors");
  if (invalidRows.length > 0) {
    errBox.classList.remove("hidden");
    errBox.innerHTML = `
      <div class="import-errors-title">${invalidRows.length} row${invalidRows.length > 1 ? "s" : ""} contain errors:</div>
      <ul>
        ${invalidRows
          .slice(0, 10)
          .map(
            (r) =>
              `<li><strong>Row ${r.rowIndex}:</strong> ${r.errors.join(", ")}</li>`,
          )
          .join("")}
        ${invalidRows.length > 10 ? `<li>... and ${invalidRows.length - 10} more error${invalidRows.length - 10 > 1 ? "s" : ""}</li>` : ""}
      </ul>
    `;
  } else {
    errBox.classList.add("hidden");
  }

  const btn = document.getElementById("importConfirmBtn");
  if (validInvoices.length > 0) {
    btn.disabled = false;
    btn.textContent = `Import ${validInvoices.length} Invoice${validInvoices.length > 1 ? "s" : ""}`;
  } else {
    btn.disabled = true;
    btn.textContent = "No valid invoices";
  }
}

function goToStep(step) {
  importStep = step;

  document.getElementById("importStep1").classList.add("hidden");
  document.getElementById("importStep2").classList.add("hidden");
  document.getElementById("importStep3").classList.add("hidden");
  document.getElementById("importStep" + step).classList.remove("hidden");

  const backBtn = document.getElementById("importBackBtn");
  const nextBtn = document.getElementById("importNextBtn");
  const confirmBtn = document.getElementById("importConfirmBtn");

  if (step === 1) {
    backBtn.classList.add("hidden");
    nextBtn.classList.add("hidden");
    confirmBtn.classList.add("hidden");
  } else if (step === 2) {
    backBtn.classList.remove("hidden");
    nextBtn.classList.remove("hidden");
    confirmBtn.classList.add("hidden");
    renderMappingUI();
  } else if (step === 3) {
    backBtn.classList.remove("hidden");
    nextBtn.classList.add("hidden");
    confirmBtn.classList.remove("hidden");
    renderPreviewUI();
  }
}

function importGoBack() {
  if (importStep === 2) goToStep(1);
  else if (importStep === 3) goToStep(2);
}

function importGoNext() {
  if (importStep === 2) goToStep(3);
}

function confirmImport() {
  if (validInvoices.length === 0) return;

  const count = validInvoices.length;
  validInvoices.forEach((inv) => invoices.push(inv));
  saveInvoices();

  showToast(
    `${count} invoice${count > 1 ? "s" : ""} imported successfully`,
    "success",
  );
  closeImportModal();
  refreshAll();
}

function downloadSampleCSV() {
  const sample = `Client Name,Phone,Email,Invoice Number,Amount,Currency,Due Date,Work,Notes
Acme Studios,+919876543210,acme@example.com,INV-047,25000,INR,2026-09-10,Video editing,Regular client
Beta Corp,+919876543211,beta@example.com,INV-048,40000,INR,2026-09-05,Web design,Prefers WhatsApp
Gamma Ltd,+919876543212,gamma@example.com,INV-049,15000,INR,2026-09-20,Logo design,New client`;

  const blob = new Blob([sample], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "invoicefollow-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// GOOGLE SHEETS IMPORT
// ============================================
function openSheetModal() {
  document.getElementById("sheetUrlInput").value = "";
  document.getElementById("sheetStatus").textContent = "";
  document.getElementById("sheetModal").classList.remove("hidden");
}

function closeSheetModal() {
  document.getElementById("sheetModal").classList.add("hidden");
}

async function fetchGoogleSheet() {
  const url = document.getElementById("sheetUrlInput").value.trim();
  const statusEl = document.getElementById("sheetStatus");

  if (!url) {
    statusEl.textContent = "Please paste a Google Sheet URL.";
    return;
  }

  if (!url.includes("docs.google.com/spreadsheets")) {
    statusEl.textContent = "This doesn't look like a Google Sheets URL.";
    return;
  }

  statusEl.textContent = "Fetching your sheet...";

  try {
    const response = await fetch("/api/fetch-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetUrl: url }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      statusEl.textContent = "";
      showToast(
        "Could not fetch sheet: " + (data.error || "Unknown error"),
        "error",
      );
      return;
    }

    Papa.parse(data.csv, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        if (results.data.length === 0) {
          statusEl.textContent = "Sheet is empty.";
          return;
        }

        if (results.data.length > 500) {
          statusEl.textContent =
            "Sheet has more than 500 rows. Please reduce it.";
          return;
        }

        csvData = results.data;
        csvHeaders = results.meta.fields || [];
        columnMapping = {};
        autoMapColumns();

        closeSheetModal();

        document.getElementById("importStep1").classList.add("hidden");
        document.getElementById("importStep2").classList.remove("hidden");
        document.getElementById("importStep3").classList.add("hidden");
        document.getElementById("importNextBtn").classList.remove("hidden");
        document.getElementById("importConfirmBtn").classList.add("hidden");
        document.getElementById("importBackBtn").classList.add("hidden");

        renderMappingUI();
        document.getElementById("importModal").classList.remove("hidden");
      },
    });
  } catch (err) {
    statusEl.textContent = "";
    showToast("Error: " + err.message, "error");
  }
}

// ============================================
// PAGE LOAD — Init
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  const authenticated = await checkAuthAndLoad();
  if (!authenticated) return;

  await migrateLocalDataToSupabase();
  await grantSignupBonusIfNeeded();

  loadData();
  updateGreeting();
  renderStats();
  renderTodayActions();
  renderInvoices();
  await renderUserMenu();
  attachEventListeners();

  // URL parameter check — buy credits flow
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("buy") === "credits") {
    setTimeout(() => {
      if (isGuestMode) {
        showConfirm(
          "Buying credits requires an account.\n\nSign up free — you'll also get 15 bonus credits (25 total).",
          {
            title: "Sign up required",
            type: "info",
            okText: "Sign up",
            cancelText: "Not now",
          },
        ).then((goSignup) => {
          if (goSignup) window.location.href = "signup.html";
        });
      } else {
        showBuyCreditsModal();
      }
      window.history.replaceState({}, "", "dashboard.html");
    }, 500);
  }
});

// ============================================
// END OF FILE
// ============================================
