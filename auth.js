// ============================================
// InvoiceFollow — Supabase Client Setup
// Yeh file har page mein load hoti hai
// ============================================

// Vercel se environment variables fetch karo
// Direct HTML mein env vars nahi hote — hum API se lete hain
// Ya hardcode kar dete hain (anon key public hai, safe hai)

// ⚠️ Tu apni Supabase URL aur anon key yahan daal
// Yeh public hai — frontend mein rakhne se koi security issue nahi
const SUPABASE_URL = "https://vwinmkysoncgcmxlslkb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3aW5ta3lzb25jZ2NteGxzbGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MjY5OTksImV4cCI6MjEwNTMwMjk5OX0.cV_QKpJX_5e8WNprZSNKELdxXJkj9j3DRCCVtEGV1CQ";

// Supabase client initialize karo
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// AUTH HELPERS — Saare pages use kar sakte hain
// ============================================

// Current user get karo
async function getCurrentUser() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  return user;
}

// Current session get karo
async function getCurrentSession() {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  return session;
}

// User logged in hai ya nahi — check
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    // Login page pe redirect karo
    window.location.href = "login.html";
    return null;
  }
  return user;
}

// User ko logout karo
async function logout() {
  await window.supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

// User profile fetch karo (users table se)
async function getUserProfile(userId) {
  const { data, error } = await window.supabaseClient
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
  return data;
}

// User profile update karo
async function updateUserProfile(userId, updates) {
  const { data, error } = await window.supabaseClient
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    return null;
  }
  return data;
}

// Credits check karo
async function getUserCredits(userId) {
  const profile = await getUserProfile(userId);
  return profile ? profile.credits : 0;
}

// Credits deduct karo (task ke baad)
async function deductCredits(userId, amount, taskType, description) {
  // Pehle current credits get karo
  const profile = await getUserProfile(userId);
  if (!profile) return false;

  // Check karo enough credits hain
  if (profile.credits < amount) {
    return { success: false, error: "Insufficient credits" };
  }

  // Credits deduct karo
  const { error: updateError } = await window.supabaseClient
    .from("users")
    .update({ credits: profile.credits - amount })
    .eq("id", userId);

  if (updateError) return { success: false, error: updateError.message };

  // Transaction log karo
  await window.supabaseClient.from("credits_transactions").insert({
    user_id: userId,
    amount: -amount,
    task_type: taskType,
    description: description,
  });

  return { success: true, newBalance: profile.credits - amount };
}