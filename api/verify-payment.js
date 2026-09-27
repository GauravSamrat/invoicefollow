// ============================================
// Razorpay Payment Verification API
// Credits add karo payment success ke baad
// ============================================

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    userId,
    credits,
  } = req.body;

  // Validation
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Payment details required" });
  }

  if (!userId || !credits) {
    return res.status(400).json({ error: "User ID and credits required" });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!keySecret || !supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    // ============================================
    // STEP 1: Razorpay Signature Verify Karo
    // ============================================
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.warn("Signature mismatch — possible fraud");
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // ============================================
    // STEP 2: Supabase Admin Client Banao
    // ============================================
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ============================================
    // STEP 3: User ka Current Credits Get Karo
    // ============================================
    const { data: profile, error: fetchError } = await supabase
      .from("users")
      .select("credits")
      .eq("id", userId)
      .single();

    if (fetchError || !profile) {
      console.error("User fetch error:", fetchError);
      return res.status(404).json({ error: "User not found" });
    }

    // ============================================
    // STEP 4: Credits Add Karo
    // ============================================
    const newBalance = (profile.credits || 0) + parseInt(credits, 10);

    const { error: updateError } = await supabase
      .from("users")
      .update({ credits: newBalance })
      .eq("id", userId);

    if (updateError) {
      console.error("Credit update error:", updateError);
      return res.status(500).json({ error: "Failed to add credits" });
    }

    // ============================================
    // STEP 5: Transaction Log Karo
    // ============================================
    await supabase.from("credits_transactions").insert({
      user_id: userId,
      amount: parseInt(credits, 10),
      task_type: "purchase",
      description: `Purchased ${credits} credits via Razorpay`,
      razorpay_payment_id: razorpay_payment_id,
    });

    return res.status(200).json({
      success: true,
      newBalance,
      creditsAdded: parseInt(credits, 10),
    });
  } catch (err) {
    console.error("Verification error:", err);
    return res.status(500).json({ error: err.message });
  }
}