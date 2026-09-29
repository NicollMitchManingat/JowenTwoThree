const bcrypt = require("bcryptjs");
const { mockUsers } = require("../models/mockUsers");
const { supabase } = require("../config/supabaseClient");

const VALID_ROLES = ["admin", "cashier", "stockist"];
const BCRYPT_COST = 10;

function isMissingTableError(err) {
  const msg = `${err?.message || ""} ${err?.details || ""} ${err?.hint || ""} ${err?.code || ""}`;
  return /app_users/i.test(msg);
}

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
    isActive: row.is_active,
  };
}

// Legacy hardcoded login (pre-migration fallback + offline dev).
function legacyLogin({ username, email, password }) {
  const user = mockUsers.find(
    (u) => u.username === username && u.email === email && u.password === password
  );

  if (!user) {
    return { success: false, error: "Invalid username, email, or password" };
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    },
  };
}

async function dbLogin({ username, password }) {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .limit(1)
    .single();

  if (error || !data) {
    return { success: false, error: "Invalid username or password" };
  }
  if (!data.is_active) {
    return { success: false, error: "Account is deactivated. Ask an admin to reactivate it." };
  }
  const ok = await bcrypt.compare(String(password || ""), data.password_hash || "");
  if (!ok) {
    return { success: false, error: "Invalid username or password" };
  }
  return { success: true, user: toPublicUser(data) };
}

// Username+password match ignoring email (the POS login form has no email field).
function legacyUsernameMatch(username, password) {
  const u = mockUsers.find((m) => m.username === username && m.password === password);
  if (!u) return { success: false, error: "Invalid username or password" };
  return {
    success: true,
    user: { id: u.id, username: u.username, email: u.email, role: u.role, fullName: u.fullName },
  };
}

// Primary login: DB-backed bcrypt check, legacy fallback when the
// app_users table (or Supabase config) is unavailable.
async function login({ username, email, password }) {
  if (!username || !password) {
    return { success: false, error: "Username and password are required" };
  }
  const legacy = () => {
    const full = legacyLogin({ username, email, password });
    return full.success ? full : legacyUsernameMatch(username, password);
  };
  if (!supabase) {
    return legacy();
  }
  try {
    return await dbLogin({ username, password });
  } catch (err) {
    if (isMissingTableError(err)) {
      return legacy();
    }
    throw err;
  }
}

function validateNewAccount({ username, email, password, role, fullName }) {
  const cleanUsername = String(username || "").trim();
  const cleanEmail = String(email || "").trim();
  if (!cleanUsername) throw new Error("Username is required");
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("A valid email is required");
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Role must be one of: ${VALID_ROLES.join(", ")}`);
  }
  return {
    username: cleanUsername,
    email: cleanEmail,
    fullName: String(fullName || "").trim() || cleanUsername,
    role,
  };
}

function legacyAdminMatch(adminUsername, adminPassword) {
  // Legacy mock entries carry email; match on username+password+role only.
  return mockUsers.find(
    (u) => u.username === adminUsername && u.password === adminPassword && u.role === "admin"
  );
}

async function requireAdmin({ adminUsername, adminPassword }) {
  if (!adminUsername || !adminPassword) {
    throw new Error("Admin approval is required");
  }
  if (!supabase) {
    const match = legacyAdminMatch(adminUsername, adminPassword);
    if (!match) throw new Error("Manager approval failed: incorrect admin password");
    return match.username;
  }
  let result;
  try {
    result = await dbLogin({ username: adminUsername, password: adminPassword });
  } catch (err) {
    if (isMissingTableError(err)) {
      const match = legacyAdminMatch(adminUsername, adminPassword);
      result = match
        ? { success: true, user: { username: match.username, role: match.role } }
        : { success: false };
    } else {
      throw err;
    }
  }
  if (!result.success || result.user.role !== "admin") {
    throw new Error("Manager approval failed: incorrect admin password");
  }
  return result.user.username;
}

function requireSupabase() {
  if (!supabase) throw new Error("Database is not configured");
}

async function createAccount(data, admin) {
  const approvedBy = await requireAdmin(admin);
  const clean = validateNewAccount(data);
  requireSupabase();
  const password_hash = await bcrypt.hash(String(data.password), BCRYPT_COST);

  const { data: row, error } = await supabase
    .from("app_users")
    .insert([
      {
        username: clean.username,
        email: clean.email,
        full_name: clean.fullName,
        role: clean.role,
        password_hash,
        is_active: true,
        created_by: approvedBy,
      },
    ])
    .select()
    .single();

  if (error) {
    if (/duplicate|unique|already exists/i.test(`${error.message || ""} ${error.details || ""} ${error.code || ""}`)) {
      throw new Error("Username or email is already taken");
    }
    throw error;
  }
  return toPublicUser(row);
}

async function listAccounts(admin) {
  await requireAdmin(admin);
  requireSupabase();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, email, full_name, role, is_active, created_by, created_at")
    .order("username");

  if (error) throw error;
  return (data || []).map(toPublicUser);
}

async function getAccountById(id) {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", id)
    .limit(1)
    .single();

  if (error || !data) throw new Error("Account not found");
  return data;
}

async function updateAccount(id, updates, admin) {
  const approvedBy = await requireAdmin(admin);
  if (!id) throw new Error("Account id is required");
  requireSupabase();

  const target = await getAccountById(id);
  const clean = {};

  if (typeof updates.fullName !== "undefined") {
    clean.full_name = String(updates.fullName || "").trim() || target.username;
  }
  if (typeof updates.email !== "undefined") {
    const email = String(updates.email || "").trim();
    if (!email.includes("@")) throw new Error("A valid email is required");
    clean.email = email;
  }
  if (typeof updates.role !== "undefined") {
    if (!VALID_ROLES.includes(updates.role)) {
      throw new Error(`Role must be one of: ${VALID_ROLES.join(", ")}`);
    }
    // Never demote yourself or the last active admin.
    if (target.role === "admin" && updates.role !== "admin") {
      if (target.username === approvedBy) {
        throw new Error("You cannot demote your own admin account");
      }
      const { data: admins, error: adminErr } = await supabase
        .from("app_users")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true);
      if (adminErr) throw adminErr;
      if ((admins || []).length <= 1) {
        throw new Error("Cannot demote the last active admin");
      }
    }
    clean.role = updates.role;
  }
  if (typeof updates.isActive !== "undefined") {
    const next = !!updates.isActive;
    if (!next) {
      if (target.username === approvedBy) {
        throw new Error("You cannot deactivate your own account");
      }
      if (target.role === "admin") {
        const { data: admins, error: adminErr } = await supabase
          .from("app_users")
          .select("id")
          .eq("role", "admin")
          .eq("is_active", true);
        if (adminErr) throw adminErr;
        if ((admins || []).length <= 1) {
          throw new Error("Cannot deactivate the last active admin");
        }
      }
    }
    clean.is_active = next;
  }
  if (typeof updates.password !== "undefined" && updates.password !== "") {
    if (String(updates.password).length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    clean.password_hash = await bcrypt.hash(String(updates.password), BCRYPT_COST);
  }
  if (Object.keys(clean).length === 0) throw new Error("Nothing to update");
  clean.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("app_users")
    .update(clean)
    .eq("id", id)
    .select("id, username, email, full_name, role, is_active, created_by, created_at")
    .single();

  if (error) {
    if (/duplicate|unique|already exists/i.test(`${error.message || ""} ${error.details || ""} ${error.code || ""}`)) {
      throw new Error("Username or email is already taken");
    }
    throw error;
  }
  return toPublicUser(data);
}

// Verifies a manager (admin) password for sensitive actions like refunds.
// Returns the admin username for approved_by audit. Never reveals which part failed.
async function verifyManager({ password }) {
  if (!password) {
    return { success: false, error: "Manager password is required" };
  }
  if (!supabase) {
    const match = mockUsers.find((u) => u.password === password && u.role === "admin");
    return match
      ? { success: true, username: match.username }
      : { success: false, error: "Manager approval failed: incorrect admin password" };
  }
  try {
    const { data, error } = await supabase
      .from("app_users")
      .select("username, password_hash, role, is_active");

    if (error) throw error;
    for (const row of data || []) {
      if (row.role !== "admin" || !row.is_active) continue;
      const ok = await bcrypt.compare(String(password), row.password_hash || "");
      if (ok) return { success: true, username: row.username };
    }
    return { success: false, error: "Manager approval failed: incorrect admin password" };
  } catch (err) {
    if (isMissingTableError(err)) {
      const match = mockUsers.find((u) => u.password === password && u.role === "admin");
      return match
        ? { success: true, username: match.username }
        : { success: false, error: "Manager approval failed: incorrect admin password" };
    }
    throw err;
  }
}

module.exports = {
  login,
  legacyLogin,
  createAccount,
  listAccounts,
  updateAccount,
  verifyManager,
  validateNewAccount,
  VALID_ROLES,
};
