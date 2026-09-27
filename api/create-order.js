// ============================================
// Razorpay Order Creation API
// Credits purchase ke liye
// ============================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, currency = "INR", credits, userId } = req.body;

  // Validation
  if (!amount || !credits) {
    return res.status(400).json({ error: "Amount and credits are required" });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({ error: "Razorpay not configured" });
  }

  try {
    // Basic Auth header
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    // Razorpay Orders API call
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // INR to paise
        currency: currency,
        receipt: `credits_${credits}_${Date.now()}`,
        notes: {
          credits: credits,
          userId: userId || "guest",
          product: "AI Credits",
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errData.error?.description || "Order creation failed",
      });
    }

    const order = await response.json();

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId,
    });
  } catch (err) {
    console.error("Razorpay error:", err);
    return res.status(500).json({ error: err.message });
  }
}