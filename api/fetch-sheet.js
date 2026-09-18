// ============================================
// Google Sheets Fetch API
// Yeh endpoint Google Sheet ka CSV fetch karta hai
// User public "view" link paste karta hai
// ============================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sheetUrl } = req.body;

  if (!sheetUrl) {
    return res.status(400).json({ error: "Google Sheet URL is required" });
  }

  try {
    // URL se sheet ID nikaalo
    // Format: https://docs.google.com/spreadsheets/d/{SHEET_ID}/...
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return res.status(400).json({
        error: "Invalid Google Sheets URL. Please paste the full sheet URL.",
      });
    }

    const sheetId = sheetIdMatch[1];

    // GID (sheet tab ID) nikaalo agar URL mein hai
    const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : "0";

    // CSV export URL banao
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    // Fetch karo
    const response = await fetch(csvUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (InvoiceFollow Sheet Fetcher)",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          error: "Sheet not found. Make sure the link is correct and the sheet is shared publicly.",
        });
      }
      if (response.status === 403) {
        return res.status(403).json({
          error: "Sheet is private. Please share it with 'Anyone with the link can view'.",
        });
      }
      return res.status(response.status).json({
        error: `Could not fetch sheet (status ${response.status}).`,
      });
    }

    // CSV text lo
    const csvText = await response.text();

    // Agar response HTML hai (login page), toh sheet private hai
    if (csvText.trim().startsWith("<!DOCTYPE") || csvText.trim().startsWith("<html")) {
      return res.status(403).json({
        error: "Sheet is not publicly accessible. Please share it with 'Anyone with the link can view'.",
      });
    }

    // CSV text bhejo frontend ko
    return res.status(200).json({
      success: true,
      csv: csvText,
    });
  } catch (err) {
    console.error("Sheet fetch error:", err);
    return res.status(500).json({ error: err.message });
  }
}