// ============================================
// OCR Invoice Scanning API — Gemini Vision
// Yeh endpoint invoice image/PDF receive karta hai
// Gemini 2.0 Flash use karke data extract karta hai
// ============================================

// Vercel serverless function — default export
export default async function handler(req, res) {
  // Sirf POST requests allow karo
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Request body se image data lo
  const { imageBase64, mimeType } = req.body;

  // Validation — image data aur mime type dono chahiye
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "Image data and MIME type are required" });
  }

  // Mime type check karo — sirf images aur PDF allow
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
  if (!allowedTypes.includes(mimeType)) {
    return res.status(400).json({
      error: `Unsupported file type: ${mimeType}. Allowed: JPG, PNG, WEBP, HEIC, PDF.`
    });
  }

  // Gemini API key environment variable se lo
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API key not configured" });
  }

  // AI ko yeh prompt bhejenge — structured JSON output chahiye
  const prompt = `You are an invoice data extraction assistant. Extract the following fields from this invoice image and return ONLY a valid JSON object with no additional text, no markdown formatting, no code blocks.

Required fields:
- clientName (string, the "Bill To" or "Client" name)
- clientEmail (string, if present, else "")
- clientPhone (string, if present, else "")
- invoiceNumber (string, the invoice number, if present, else "")
- amount (number, the total amount due, without currency symbols or commas)
- currency (string, one of: INR, USD, EUR — infer from symbol ₹/$/€ or context)
- dueDate (string in YYYY-MM-DD format, if present, else "")
- work (string, short description of the work or service, if present, else "")

Return the JSON object in this exact format:
{
  "clientName": "...",
  "clientEmail": "...",
  "clientPhone": "...",
  "invoiceNumber": "...",
  "amount": 0,
  "currency": "INR",
  "dueDate": "YYYY-MM-DD",
  "work": "..."
}

If a field is not present in the invoice, use empty string for text fields and 0 for numbers. Do not invent data. Only extract what you can see.`;

  try {
    // Gemini API ko call karo
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                // Text prompt
                { text: prompt },
                // Image data inline bhejo
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          // Generation config — temperature kam rakho for accuracy
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    // Agar API error aaye toh handle karo
    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      return res.status(response.status).json({
        error: "Failed to scan invoice. Please try again or enter manually.",
      });
    }

    // Response parse karo
    const data = await response.json();

    // Gemini ke response se text nikaalo
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return res.status(500).json({ error: "Empty response from AI" });
    }

    // AI ne shayad markdown code blocks add kiye ho — hata do
    let cleanedText = textContent.trim();
    cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    cleanedText = cleanedText.trim();

    // JSON parse karo
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Raw text:", cleanedText);
      return res.status(500).json({
        error: "Could not parse invoice data. Please enter manually.",
      });
    }

    // Response bhejo
    return res.status(200).json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    console.error("Scan error:", err);
    return res.status(500).json({ error: err.message });
  }
}