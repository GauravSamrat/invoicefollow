// ============================================
// InvoiceFollow Dashboard — Main Logic
// Saara data localStorage mein store hota hai
// ============================================

// ---------- Constants ----------
const STORAGE_INVOICES = "invoicefollow_invoices";
const STORAGE_SETTINGS = "invoicefollow_settings";
const STORAGE_PRO = "invoicefollow_pro";
const FREE_LIMIT = 5; // Free mein 5 invoices tak

// ---------- App State ----------
let invoices = [];
let settings = {};
let currentFilter = "all";
let searchQuery = "";
let activeInvoiceId = null;
let reminderMode = "whatsapp"; // ya "email"
// CSV Import state
let csvData = [];           // Parsed CSV rows (raw)
let csvHeaders = [];        // CSV column names
let columnMapping = {};     // { clientName: "Client Name", phone: "Phone", ... }
let importStep = 1;         // 1 = upload, 2 = mapping, 3 = preview
let validInvoices = [];     // Validated invoices ready to import
let invalidRows = [];       // Rows with errors

// ============================================
// INITIALIZATION
// ============================================

  // ========== CSV IMPORT EVENT LISTENERS ==========
  
  // Import button
  document.getElementById("importCsvBtn").addEventListener("click", openImportModal);
  
  // Close modal
  document.getElementById("closeImportModal").addEventListener("click", closeImportModal);
  document.getElementById("cancelImport").addEventListener("click", closeImportModal);
  
  // Back button
  document.getElementById("importBackBtn").addEventListener("click", importGoBack);
  
  // Next button (step 2 → 3)
  document.getElementById("importNextBtn").addEventListener("click", importGoNext);
  
  // Confirm import (step 3)
  document.getElementById("importConfirmBtn").addEventListener("click", confirmImport);
  
  // Sample CSV download
  document.getElementById("downloadSampleBtn").addEventListener("click", downloadSampleCSV);
  
  // Drop zone — click
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("csvFileInput");
  
  dropZone.addEventListener("click", () => fileInput.click());
  
  // Drop zone — drag & drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });
  
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  });
  
  // File input change
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleCSVFile(file);
  });

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  updateGreeting();
  renderStats();
  renderTodayActions();
  renderInvoices();
  renderUserMenu();
  attachEventListeners();
});

// Data load karo localStorage se
function loadData() {
  invoices = JSON.parse(localStorage.getItem(STORAGE_INVOICES) || "[]");
  settings = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || "{}");

  // Default settings agar khaali hai
  if (!settings.yourName) settings.yourName = "";
  if (!settings.yourEmail) settings.yourEmail = "";
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

function isPro() {
  return localStorage.getItem(STORAGE_PRO) === "true";
}

// ============================================
// CSV IMPORT — MAIN FUNCTIONS
// ============================================

// ---------- Modal kholo ----------
function openImportModal() {
  // Free limit check
  if (!isPro() && invoices.length >= FREE_LIMIT) {
    alert(`Free plan mein sirf ${FREE_LIMIT} invoices tak. Upgrade karo unlimited ke liye.`);
    return;
  }
  
  // Reset state
  csvData = [];
  csvHeaders = [];
  columnMapping = {};
  importStep = 1;
  validInvoices = [];
  invalidRows = [];
  
  // Reset UI
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

// ---------- File handle karo ----------
function handleCSVFile(file) {
  // Extension check
  if (!file.name.toLowerCase().endsWith(".csv")) {
    alert("Sirf .csv file support karte hain. Excel file ko pehle CSV mein export karein.");
    return;
  }
  
  // Size check (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    alert("File bahut badi hai. 5MB se chhoti file upload karein.");
    return;
  }
  
  // PapaParse se parse karo
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.data.length === 0) {
        alert("CSV file khaali hai.");
        return;
      }
      
      if (results.data.length > 500) {
        alert("Ek baar mein 500 invoices tak import kar sakte hain.");
        return;
      }
      
      csvData = results.data;
      csvHeaders = results.meta.fields || [];
      
      // Auto-mapping try karo (header names match karke)
      autoMapColumns();
      
      // Step 2 pe jao
      goToStep(2);
    },
    error: function (err) {
      alert("CSV parse nahi ho payi: " + err.message);
    }
  });
}

// ---------- Column auto-mapping (smart guess) ----------
function autoMapColumns() {
  const headerLower = csvHeaders.map(h => h.toLowerCase().trim());
  
  // Har field ke liye possible header names
  const fieldPatterns = {
    clientName: ["client name", "client", "name", "customer", "customer name", "party", "party name"],
    clientPhone: ["phone", "mobile", "whatsapp", "contact", "phone number", "mobile number"],
    clientEmail: ["email", "e-mail", "mail", "email id", "email address"],
    invoiceNumber: ["invoice", "invoice #", "invoice no", "invoice number", "inv", "inv no", "bill no"],
    amount: ["amount", "total", "value", "invoice amount", "amt", "price"],
    currency: ["currency", "curr"],
    dueDate: ["due date", "due", "due on", "payment due", "duedate"],
    promiseDate: ["promise date", "promise", "promised date", "commitment date"],
    work: ["work", "description", "service", "project", "notes", "details"],
    notes: ["notes", "remarks", "comment", "comments"]
  };
  
  // Auto-detect
  Object.keys(fieldPatterns).forEach(field => {
    const patterns = fieldPatterns[field];
    for (let i = 0; i < headerLower.length; i++) {
      if (patterns.includes(headerLower[i])) {
        columnMapping[field] = csvHeaders[i];
        return;
      }
    }
  });
}

// ---------- Step 2 UI render karo (mapping) ----------
function renderMappingUI() {
  const fields = [
    { key: "clientName", label: "Client Name", required: true },
    { key: "clientPhone", label: "Client Phone (WhatsApp)", required: true },
    { key: "clientEmail", label: "Client Email", required: false },
    { key: "invoiceNumber", label: "Invoice Number", required: false },
    { key: "amount", label: "Amount", required: true },
    { key: "currency", label: "Currency", required: false },
    { key: "dueDate", label: "Due Date", required: true },
    { key: "promiseDate", label: "Promise Date", required: false },
    { key: "work", label: "Work Description", required: false },
    { key: "notes", label: "Notes", required: false }
  ];
  
  const grid = document.getElementById("mappingGrid");
  grid.innerHTML = "";
  
  fields.forEach(field => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    
    const required = field.required ? '<span class="mapping-field-required">*</span>' : '';
    
    // Dropdown options — "— Select column —" + all CSV headers
    const options = ['<option value="">— Skip / Not in CSV —</option>']
      .concat(csvHeaders.map(h => {
        const selected = columnMapping[field.key] === h ? "selected" : "";
        return `<option value="${escapeHtml(h)}" ${selected}>${escapeHtml(h)}</option>`;
      }))
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
  
  // Dropdown change listeners
  document.querySelectorAll(".mapping-select").forEach(sel => {
    sel.addEventListener("change", (e) => {
      const field = e.target.dataset.field;
      const value = e.target.value;
      if (value) {
        columnMapping[field] = value;
      } else {
        delete columnMapping[field];
      }
      
      // Next button enable/disable
      updateImportNextButton();
    });
  });
  
  // Row count
  document.getElementById("csvRowCount").textContent = csvData.length;
  
  // Next button status update
  updateImportNextButton();
}

// ---------- Next button enable/disable ----------
function updateImportNextButton() {
  const required = ["clientName", "clientPhone", "amount", "dueDate"];
  const allMapped = required.every(f => columnMapping[f]);
  
  const btn = document.getElementById("importNextBtn");
  if (allMapped) {
    btn.disabled = false;
    btn.classList.remove("hidden");
  } else {
    btn.disabled = true;
  }
  
  // Highlight missing required fields
  document.querySelectorAll(".mapping-select").forEach(sel => {
    const field = sel.dataset.field;
    if (required.includes(field) && !sel.value) {
      sel.classList.add("error");
    } else {
      sel.classList.remove("error");
    }
  });
}

// ---------- Date parse karo (multiple formats support) ----------
function parseDate(str) {
  if (!str) return null;
  str = String(str).trim();
  
  // Already ISO format?
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // DD/MM/YYYY ya DD-MM-YYYY
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let day = m[1].padStart(2, "0");
    let month = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }
  
  // YYYY/MM/DD
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  
  // Native Date try karo
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  
  return null;
}

// ---------- Amount parse karo ----------
function parseAmount(str) {
  if (!str) return null;
  // Remove ₹, $, commas, spaces
  const cleaned = String(str).replace(/[₹$€,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

// ---------- Phone clean karo ----------
function cleanPhone(str) {
  if (!str) return "";
  // Sirf digits rakho
  return String(str).replace(/[^0-9]/g, "");
}

// ---------- Validate + build invoices ----------
function validateAndBuildInvoices() {
  validInvoices = [];
  invalidRows = [];
  
  csvData.forEach((row, idx) => {
    const errors = [];
    
    // Extract values
    const clientName = columnMapping.clientName ? String(row[columnMapping.clientName] || "").trim() : "";
    const clientPhone = columnMapping.clientPhone ? cleanPhone(row[columnMapping.clientPhone]) : "";
    const clientEmail = columnMapping.clientEmail ? String(row[columnMapping.clientEmail] || "").trim() : "";
    const invoiceNumber = columnMapping.invoiceNumber ? String(row[columnMapping.invoiceNumber] || "").trim() : "";
    const amountRaw = columnMapping.amount ? row[columnMapping.amount] : "";
    const currencyRaw = columnMapping.currency ? String(row[columnMapping.currency] || "").trim().toUpperCase() : "";
    const dueDateRaw = columnMapping.dueDate ? row[columnMapping.dueDate] : "";
    const promiseDateRaw = columnMapping.promiseDate ? row[columnMapping.promiseDate] : "";
    const work = columnMapping.work ? String(row[columnMapping.work] || "").trim() : "";
    const notes = columnMapping.notes ? String(row[columnMapping.notes] || "").trim() : "";
    
    // Validations
    if (!clientName) errors.push("Client name missing");
    if (!clientPhone) errors.push("Phone missing");
    if (clientPhone && clientPhone.length < 10) errors.push("Phone number invalid (10+ digits chahiye)");
    
    const amount = parseAmount(amountRaw);
    if (amount === null) errors.push("Amount invalid ya missing");
    
    const dueDate = parseDate(dueDateRaw);
    if (!dueDate) errors.push("Due date invalid ya missing");
    
    const promiseDate = promiseDateRaw ? parseDate(promiseDateRaw) : null;
    if (promiseDateRaw && !promiseDate) errors.push("Promise date format galat hai");
    
    // Currency — agar missing, default use karo
    const validCurrencies = ["INR", "USD", "EUR"];
    const currency = validCurrencies.includes(currencyRaw) ? currencyRaw : (settings.currency || "INR");
    
    if (errors.length > 0) {
      invalidRows.push({ rowIndex: idx + 1, row, errors });
      return;
    }
    
    // Valid invoice banao
    validInvoices.push({
      id: "inv_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).slice(2, 7),
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
    });
  });
}

// ---------- Step 3 UI render karo (preview) ----------
function renderPreviewUI() {
  validateAndBuildInvoices();
  
  // Counts
  document.getElementById("validCount").textContent = validInvoices.length;
  document.getElementById("invalidCount").textContent = invalidRows.length;
  
  // Preview table — first 20 rows
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
  
  previewInvoices.forEach(inv => {
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
  
  // Invalid rows errors
  const errBox = document.getElementById("invalidErrors");
  if (invalidRows.length > 0) {
    errBox.classList.remove("hidden");
    errBox.innerHTML = `
      <div class="import-errors-title">⚠ ${invalidRows.length} rows mein errors mile:</div>
      <ul>
        ${invalidRows.slice(0, 10).map(r => 
          `<li><strong>Row ${r.rowIndex}:</strong> ${r.errors.join(", ")}</li>`
        ).join("")}
        ${invalidRows.length > 10 ? `<li>... aur ${invalidRows.length - 10} errors</li>` : ""}
      </ul>
    `;
  } else {
    errBox.classList.add("hidden");
  }
  
  // Confirm button enable/disable
  const btn = document.getElementById("importConfirmBtn");
  if (validInvoices.length > 0) {
    btn.disabled = false;
    btn.textContent = `Import ${validInvoices.length} Invoice${validInvoices.length > 1 ? "s" : ""}`;
  } else {
    btn.disabled = true;
    btn.textContent = "No valid invoices";
  }
}

// ---------- Step navigation ----------
function goToStep(step) {
  importStep = step;
  
  // Hide all steps
  document.getElementById("importStep1").classList.add("hidden");
  document.getElementById("importStep2").classList.add("hidden");
  document.getElementById("importStep3").classList.add("hidden");
  
  // Show current step
  document.getElementById("importStep" + step).classList.remove("hidden");
  
  // Buttons visibility
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
  if (importStep === 2) {
    goToStep(1);
  } else if (importStep === 3) {
    goToStep(2);
  }
}

function importGoNext() {
  if (importStep === 2) {
    goToStep(3);
  }
}

// ---------- Confirm import ----------
function confirmImport() {
  if (validInvoices.length === 0) return;
  
  // Free limit check
  if (!isPro()) {
    const remaining = FREE_LIMIT - invoices.length;
    if (validInvoices.length > remaining) {
      alert(`Free plan mein sirf ${remaining} invoices aur add ho sakte hain. ${validInvoices.length - remaining} invoices skip ho jayenge. Upgrade karo unlimited ke liye.`);
      validInvoices = validInvoices.slice(0, remaining);
    }
  }
  
  if (validInvoices.length === 0) {
    alert("Koi invoice import nahi ho sakta. Free limit khatam hai.");
    closeImportModal();
    return;
  }
  
  // Sab invoices add karo
  validInvoices.forEach(inv => invoices.push(inv));
  saveInvoices();
  
  // Success message
  alert(`${validInvoices.length} invoices successfully imported!`);
  
  // Modal close + refresh
  closeImportModal();
  refreshAll();
}

// ---------- Sample CSV download ----------
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
// HELPERS
// ============================================

// Currency symbol nikaalo
function getCurrencySymbol(code) {
  return { INR: "₹", USD: "$", EUR: "€" }[code] || "₹";
}

// Amount ko format karo (₹25,000)
function formatAmount(amount, currency) {
  const symbol = getCurrencySymbol(currency || settings.currency);
  return symbol + Number(amount).toLocaleString("en-IN");
}

// Date ko readable banao (15 Sep 2026)
function formatDate(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Aaj ki date ISO format mein
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Date difference (days)
function daysDiff(fromISO, toISO) {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

// Invoice ka status calculate karo
function computeStatus(inv) {
  if (inv.status === "paid") return "paid";
  if (!inv.dueDate) return "pending";
  const today = todayISO();
  if (inv.dueDate < today) return "overdue";
  return "pending";
}

// Next follow-up date calculate karo (due date + reminder days)
function computeNextFollowUp(inv) {
  if (!inv.dueDate || inv.status === "paid") return inv.dueDate || null;

  const today = todayISO();
  const days = [settings.days1, settings.days2, settings.days3];
  const sent = inv.remindersSent || 0;

  if (sent >= 3) return null; // Saare reminders bhej diye

  const nextDate = new Date(inv.dueDate);
  nextDate.setDate(nextDate.getDate() + days[sent]);
  return nextDate.toISOString().split("T")[0];
}

// Aaj follow-up karna hai ya nahi
function isActionDueToday(inv) {
  if (inv.status === "paid") return false;

  const today = todayISO();

  // Promise date aaj hai
  if (inv.promiseDate === today) return true;

  // Due date aaj hai
  if (inv.dueDate === today) return true;

  // Next follow-up aaj ya pehle tha
  const nextFU = computeNextFollowUp(inv);
  if (nextFU && nextFU <= today) return true;

  return false;
}

// ============================================
// GREETING
// ============================================

function updateGreeting() {
  const hour = new Date().getHours();
  let greet = "Good morning";
  if (hour >= 12 && hour < 17) greet = "Good afternoon";
  if (hour >= 17) greet = "Good evening";

  const name = settings.yourName ? settings.yourName.split(" ")[0] : "";
  document.getElementById("greeting").textContent = name ? `${greet}, ${name}` : greet;

  const actions = invoices.filter(isActionDueToday);
  const summary = document.getElementById("actionSummary");
  if (actions.length === 0) {
    summary.textContent = "No follow-ups today. You're all caught up!";
  } else {
    summary.textContent = `Aaj ${actions.length} client${actions.length > 1 ? "s" : ""} ko follow-up karna hai`;
  }
}

// ============================================
// STATS
// ============================================

function renderStats() {
  const total = invoices
    .filter(inv => inv.status !== "paid")
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  const overdue = invoices
    .filter(inv => computeStatus(inv) === "overdue")
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  // Is mahine paid
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const paidThisMonth = invoices
    .filter(inv => inv.status === "paid" && inv.paidAt && inv.paidAt >= monthStart)
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  const pendingCount = invoices.filter(inv => inv.status !== "paid").length;
  const overdueCount = invoices.filter(inv => computeStatus(inv) === "overdue").length;
  const paidCount = invoices.filter(inv => inv.status === "paid" && inv.paidAt && inv.paidAt >= monthStart).length;

  document.getElementById("statTotal").textContent = formatAmount(total);
  document.getElementById("statTotalSub").textContent = `${pendingCount} invoice${pendingCount !== 1 ? "s" : ""}`;

  document.getElementById("statOverdue").textContent = formatAmount(overdue);
  document.getElementById("statOverdueSub").textContent = `${overdueCount} invoice${overdueCount !== 1 ? "s" : ""}`;

  document.getElementById("statPaid").textContent = formatAmount(paidThisMonth);
  document.getElementById("statPaidSub").textContent = `${paidCount} invoice${paidCount !== 1 ? "s" : ""}`;
}

// ============================================
// TODAY'S ACTIONS
// ============================================

function renderTodayActions() {
  const container = document.getElementById("todayActions");
  const allClear = document.getElementById("allClear");
  const actions = invoices.filter(isActionDueToday);

  container.innerHTML = "";

  if (actions.length === 0) {
    allClear.classList.remove("hidden");
    return;
  }

  allClear.classList.add("hidden");

  actions.forEach(inv => {
    const card = document.createElement("div");
    card.className = "action-card";

    const status = computeStatus(inv);
    let meta = "";
    if (inv.promiseDate === todayISO()) {
      meta = `Promise date: aaj`;
    } else if (inv.dueDate === todayISO()) {
      meta = `Due today`;
    } else if (status === "overdue") {
      const days = daysDiff(inv.dueDate, todayISO());
      meta = `${days} day${days > 1 ? "s" : ""} overdue`;
    } else {
      meta = `Due: ${formatDate(inv.dueDate)}`;
    }

    card.innerHTML = `
      <div class="action-info">
        <div class="action-client">${escapeHtml(inv.clientName)}</div>
        <div class="action-meta">${meta}</div>
      </div>
      <div class="action-amount">${formatAmount(inv.amount, inv.currency)}</div>
      <div class="action-buttons">
        <button class="btn-whatsapp btn-sm" data-action="whatsapp" data-id="${inv.id}">WhatsApp</button>
        <button class="btn-primary btn-sm" data-action="email" data-id="${inv.id}">Email</button>
        <button class="btn-ghost btn-sm" data-action="paid" data-id="${inv.id}">Paid</button>
      </div>
    `;

    container.appendChild(card);
  });
}

// ============================================
// ALL INVOICES
// ============================================

function renderInvoices() {
  const container = document.getElementById("invoiceList");
  const emptyState = document.getElementById("emptyState");

  let filtered = invoices;

  // Filter lagao
  if (currentFilter !== "all") {
    filtered = filtered.filter(inv => {
      if (currentFilter === "pending") return computeStatus(inv) === "pending";
      if (currentFilter === "overdue") return computeStatus(inv) === "overdue";
      if (currentFilter === "paid") return inv.status === "paid";
      return true;
    });
  }

  // Search lagao
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(inv =>
      (inv.clientName || "").toLowerCase().includes(q) ||
      (inv.invoiceNumber || "").toLowerCase().includes(q)
    );
  }

  // Sort karo — overdue pehle, phir due date
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

  filtered.forEach(inv => {
    const status = computeStatus(inv);
    const row = document.createElement("div");
    row.className = "invoice-row";
    row.dataset.id = inv.id;

    row.innerHTML = `
      <div>
        <div class="inv-client">${escapeHtml(inv.clientName)}</div>
        <div class="inv-client-sub">${inv.invoiceNumber ? escapeHtml(inv.invoiceNumber) : ""}</div>
      </div>
      <div class="inv-amount">${formatAmount(inv.amount, inv.currency)}</div>
      <div class="inv-due">${formatDate(inv.dueDate)}</div>
      <div><span class="inv-status status-${status}">${status}</span></div>
      <div class="inv-actions">
        <button class="btn-ghost btn-sm" data-action="open" data-id="${inv.id}">Open</button>
      </div>
    `;

    container.appendChild(row);
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

function attachEventListeners() {
  // Add Invoice
  document.getElementById("addInvoiceBtn").addEventListener("click", openAddModal);
  document.getElementById("closeAddModal").addEventListener("click", closeAddModal);
  document.getElementById("cancelAdd").addEventListener("click", closeAddModal);
  document.getElementById("saveInvoice").addEventListener("click", saveNewInvoice);

  // Detail Modal
  document.getElementById("closeDetailModal").addEventListener("click", () => {
    document.getElementById("detailModal").classList.add("hidden");
  });

  // Settings
  document.getElementById("settingsBtn").addEventListener("click", openSettingsModal);
  document.getElementById("closeSettingsModal").addEventListener("click", closeSettingsModal);
  document.getElementById("cancelSettings").addEventListener("click", closeSettingsModal);
  document.getElementById("saveSettings").addEventListener("click", saveSettingsFromModal);
  document.getElementById("exportCsvBtn").addEventListener("click", exportToCSV);

  // Reminder Modal
  document.getElementById("closeReminderModal").addEventListener("click", () => {
    document.getElementById("reminderModal").classList.add("hidden");
  });
  document.getElementById("sendWhatsappBtn").addEventListener("click", sendWhatsApp);
  document.getElementById("sendEmailBtn").addEventListener("click", sendEmail);
  document.getElementById("copyMessageBtn").addEventListener("click", copyMessage);

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderInvoices();
    });
  });

  // Search
  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderInvoices();
  });

  // User Menu
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

  // Sign out
  document.getElementById("signOutBtn").addEventListener("click", () => {
    if (confirm("Sign out? Aapka data localStorage mein rahega — dobara login karne pe milega.")) {
      window.location.href = "/";
    }
  });

  // Delegated events (invoice list + action cards)
  document.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;
    if (!action || !id) return;

    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    if (action === "open") openDetailModal(inv);
    if (action === "whatsapp") openReminderModal(inv, "whatsapp");
    if (action === "email") openReminderModal(inv, "email");
    if (action === "paid") markAsPaid(inv);
  });
}

// ============================================
// ADD INVOICE
// ============================================

function openAddModal() {
  // Free limit check
  if (!isPro() && invoices.length >= FREE_LIMIT) {
    alert(`Free plan mein sirf ${FREE_LIMIT} invoices tak. Upgrade karo unlimited ke liye.`);
    return;
  }

  // Form clear karo
  ["fClientName", "fClientPhone", "fClientEmail", "fInvoiceNumber", "fAmount", "fDueDate", "fPromiseDate", "fWork", "fNotes"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("fCurrency").value = settings.currency || "INR";

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

  // Validation
  if (!clientName || !clientPhone || !amount || !dueDate) {
    alert("Client name, phone, amount, aur due date zaroori hain.");
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
  };

  invoices.push(newInvoice);
  saveInvoices();
  closeAddModal();
  refreshAll();
}

// ============================================
// DETAIL MODAL
// ============================================

function openDetailModal(inv) {
  activeInvoiceId = inv.id;
  const modal = document.getElementById("detailModal");
  const body = document.getElementById("detailBody");
  const status = computeStatus(inv);

  document.getElementById("detailTitle").textContent = `${inv.clientName} — ${formatAmount(inv.amount, inv.currency)}`;

  // Timeline events build karo
  const timeline = [];
  timeline.push({ date: inv.createdAt, text: "Invoice created", type: "done" });
  if (inv.dueDate) {
    const isPast = inv.dueDate < todayISO();
    timeline.push({ date: inv.dueDate, text: "Due date", type: isPast ? "done" : "" });
  }
  if (inv.promiseDate) {
    const isToday = inv.promiseDate === todayISO();
    timeline.push({ date: inv.promiseDate, text: "Client promise date", type: isToday ? "today" : (inv.promiseDate < todayISO() ? "done" : "") });
  }
  if (inv.lastTouchpoint) {
    timeline.push({ date: inv.lastTouchpoint, text: "Last contact", type: "done" });
  }
  if (inv.status === "paid" && inv.paidAt) {
    timeline.push({ date: inv.paidAt, text: "Payment received", type: "done" });
  } else {
    const nextFU = computeNextFollowUp(inv);
    if (nextFU) timeline.push({ date: nextFU, text: "Next follow-up", type: "" });
  }

  timeline.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  body.innerHTML = `
    <div class="detail-section">
      <h4>Details</h4>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="inv-status status-${status}">${status}</span></span></div>
      <div class="detail-row"><span class="detail-label">Client Phone</span><span class="detail-value">${escapeHtml(inv.clientPhone)}</span></div>
      ${inv.clientEmail ? `<div class="detail-row"><span class="detail-label">Client Email</span><span class="detail-value">${escapeHtml(inv.clientEmail)}</span></div>` : ""}
      ${inv.invoiceNumber ? `<div class="detail-row"><span class="detail-label">Invoice #</span><span class="detail-value">${escapeHtml(inv.invoiceNumber)}</span></div>` : ""}
      <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">${formatAmount(inv.amount, inv.currency)}</span></div>
      <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value">${formatDate(inv.dueDate)}</span></div>
      ${inv.promiseDate ? `<div class="detail-row"><span class="detail-label">Promise Date</span><span class="detail-value">${formatDate(inv.promiseDate)}</span></div>` : ""}
      ${inv.work ? `<div class="detail-row"><span class="detail-label">Work</span><span class="detail-value">${escapeHtml(inv.work)}</span></div>` : ""}
      <div class="detail-row"><span class="detail-label">Reminders Sent</span><span class="detail-value">${inv.remindersSent || 0}</span></div>
    </div>

    <div class="detail-section">
      <h4>Timeline</h4>
      <div class="timeline">
        ${timeline.map(t => `
          <div class="timeline-item ${t.type}">
            <div class="timeline-date">${formatDate(t.date)}</div>
            <div class="timeline-text">${t.text}</div>
          </div>
        `).join("")}
      </div>
    </div>

    ${inv.notes ? `
      <div class="detail-section">
        <h4>Notes</h4>
        <div style="font-size:0.88rem; color:var(--text-muted);">${escapeHtml(inv.notes)}</div>
      </div>
    ` : ""}

    <div class="detail-section">
      <h4>Actions</h4>
      <div class="reminder-actions">
        <button class="btn-whatsapp" data-action="whatsapp" data-id="${inv.id}">WhatsApp</button>
        <button class="btn-primary" data-action="email" data-id="${inv.id}">Email</button>
        ${inv.status !== "paid" ? `<button class="btn-ghost" data-action="paid" data-id="${inv.id}">Mark as Paid</button>` : ""}
        <button class="btn-ghost" id="deleteInvoiceBtn" data-id="${inv.id}">Delete</button>
      </div>
    </div>
  `;

  // Delete button
  document.getElementById("deleteInvoiceBtn").addEventListener("click", () => {
    if (confirm("Yeh invoice delete kar dein? Wapas nahi aayega.")) {
      invoices = invoices.filter(i => i.id !== inv.id);
      saveInvoices();
      modal.classList.add("hidden");
      refreshAll();
    }
  });

  modal.classList.remove("hidden");
}

// ============================================
// REMINDER MODAL
// ============================================

function openReminderModal(inv, mode) {
  activeInvoiceId = inv.id;
  reminderMode = mode;

  // Message draft karo
  const message = buildReminderMessage(inv);

  document.getElementById("reminderTitle").textContent =
    mode === "whatsapp" ? `WhatsApp Reminder — ${inv.clientName}` : `Email Reminder — ${inv.clientName}`;

  document.getElementById("reminderMessage").value = message;

  document.getElementById("reminderModal").classList.remove("hidden");
}

function buildReminderMessage(inv) {
  const yourName = settings.yourName || "Your name";
  const amount = formatAmount(inv.amount, inv.currency);
  const invNum = inv.invoiceNumber ? ` #${inv.invoiceNumber}` : "";
  const overdueDays = inv.dueDate ? daysDiff(inv.dueDate, todayISO()) : 0;

  let opening = `Just circling back on invoice${invNum} for ${amount} — it was due on ${formatDate(inv.dueDate)}.`;
  if (overdueDays >= 7) {
    opening = `Following up again on invoice${invNum} for ${amount}, which was due on ${formatDate(inv.dueDate)}. It's now ${overdueDays} days past due.`;
  }
  if (overdueDays >= 14) {
    opening = `Invoice${invNum} for ${amount} is now ${overdueDays} days overdue. I haven't heard back from my previous emails.`;
  }

  const closer = overdueDays >= 14
    ? "If I don't receive payment or a clear plan by this Friday, I'll need to pause future work. I'd rather avoid that — let me know how you'd like to proceed."
    : "Could you confirm a payment date? If there's an issue, let me know so we can sort it out.";

  return `Hi ${inv.clientName},

${opening}

${closer}

Thanks,
${yourName}`;
}

function sendWhatsApp() {
  const inv = invoices.find(i => i.id === activeInvoiceId);
  if (!inv) return;

  const message = document.getElementById("reminderMessage").value;
  const phone = (inv.clientPhone || "").replace(/[^0-9]/g, "");
  if (!phone) {
    alert("Client ka phone number nahi hai. Pehle add karo.");
    return;
  }

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");

  // Reminders sent count badhao + last touchpoint update
  inv.remindersSent = (inv.remindersSent || 0) + 1;
  inv.lastTouchpoint = todayISO();
  saveInvoices();
  document.getElementById("reminderModal").classList.add("hidden");
  refreshAll();
}

async function sendEmail() {
  const inv = invoices.find(i => i.id === activeInvoiceId);
  if (!inv) return;

  const message = document.getElementById("reminderMessage").value;
  const subject = inv.invoiceNumber ? `Invoice ${inv.invoiceNumber} — Follow-up` : `Invoice Follow-up`;

  // Clipboard pe copy karo (since mailto pe lambi body pass karna unreliable hai)
  try {
    await navigator.clipboard.writeText(message);
  } catch (e) {}

  // Mailto link kholo — client email ke saath
  if (inv.clientEmail) {
    const mailto = `mailto:${inv.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = mailto;
  } else {
    alert("Client ka email nahi hai. Message clipboard mein copy ho gaya — manually bhejo.");
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
  setTimeout(() => btn.textContent = orig, 1500);
}

// ============================================
// MARK AS PAID
// ============================================

function markAsPaid(inv) {
  if (!confirm(`${inv.clientName} ka payment receive hua? Amount: ${formatAmount(inv.amount, inv.currency)}`)) return;

  inv.status = "paid";
  inv.paidAt = todayISO();
  saveInvoices();
  document.getElementById("detailModal").classList.add("hidden");
  refreshAll();
}

// ============================================
// SETTINGS
// ============================================

function openSettingsModal() {
  document.getElementById("sYourName").value = settings.yourName || "";
  document.getElementById("sYourEmail").value = settings.yourEmail || "";
  document.getElementById("sCurrency").value = settings.currency || "INR";
  document.getElementById("sDay1").value = settings.days1 || 3;
  document.getElementById("sDay2").value = settings.days2 || 7;
  document.getElementById("sDay3").value = settings.days3 || 14;

  const autoRadio = document.querySelector(`input[name="automation"][value="${settings.automation || "guided"}"]`);
  if (autoRadio) autoRadio.checked = true;

  document.getElementById("settingsModal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.add("hidden");
}

function saveSettingsFromModal() {
  settings.yourName = document.getElementById("sYourName").value.trim();
  settings.yourEmail = document.getElementById("sYourEmail").value.trim();
  settings.currency = document.getElementById("sCurrency").value;
  settings.days1 = Number(document.getElementById("sDay1").value) || 3;
  settings.days2 = Number(document.getElementById("sDay2").value) || 7;
  settings.days3 = Number(document.getElementById("sDay3").value) || 14;

  const autoRadio = document.querySelector('input[name="automation"]:checked');
  if (autoRadio) settings.automation = autoRadio.value;

  saveSettings();
  closeSettingsModal();
  refreshAll();
}

function exportToCSV() {
  if (invoices.length === 0) {
    alert("Koi invoice nahi hai export ke liye.");
    return;
  }

  const headers = ["Client", "Phone", "Email", "Invoice#", "Amount", "Currency", "Due Date", "Promise Date", "Status", "Reminders Sent", "Created", "Paid At"];
  const rows = invoices.map(inv => [
    inv.clientName, inv.clientPhone, inv.clientEmail, inv.invoiceNumber,
    inv.amount, inv.currency, inv.dueDate, inv.promiseDate,
    computeStatus(inv), inv.remindersSent || 0, inv.createdAt, inv.paidAt || ""
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoicefollow-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// USER MENU
// ============================================

function renderUserMenu() {
  const name = settings.yourName || "Guest User";
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  document.getElementById("userAvatar").textContent = initials;
  document.getElementById("userName").textContent = name.split(" ")[0] || "Account";
  document.getElementById("dropdownName").textContent = name;
  document.getElementById("dropdownEmail").textContent = settings.yourEmail || "—";
  document.getElementById("dropdownPlan").textContent = isPro() ? "Pro" : "Free";
  document.getElementById("dropdownUsage").textContent = isPro() ? "Unlimited" : `${invoices.length} / ${FREE_LIMIT}`;
}

// ============================================
// REFRESH ALL
// ============================================

function refreshAll() {
  updateGreeting();
  renderStats();
  renderTodayActions();
  renderInvoices();
  renderUserMenu();
}

// ============================================
// UTILS
// ============================================

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}