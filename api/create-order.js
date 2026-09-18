// ============================================
// Razorpay Order Creation API
// Yeh backend hai — Key Secret yahan safe hai
// ============================================

export default async function handler(req, res) {
  // Sirf POST request allow karo
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, currency = "USD" } = req.body;

  // Environment variables se keys lo (Vercel pe set hain)
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({ error: "Razorpay keys not configured" });
  }

  try {
    // Basic Auth header banao (Key ID : Key Secret)
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    // Razorpay Orders API call karo
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amount * 100, // Razorpay paise/subunits mein leta hai (9 USD = 900)
        currency: currency,
        receipt: `receipt_${Date.now()}`,
        notes: {
          product: "InvoiceFollow Pro",
          plan: "monthly",
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

    // Frontend ko order details bhejo (Key Secret NAHI bhejna!)
    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId, // Key ID safe hai frontend ke liye
    });
  } catch (err) {
    console.error("Razorpay error:", err);
    return res.status(500).json({ error: err.message });
  }
}