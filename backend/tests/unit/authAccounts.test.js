import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

const AuthService = require("../../src/services/authService.js");

const ADMIN = { adminUsername: "admin", adminPassword: "admin123" };

describe("Account validation", () => {
  it("should accept a valid new account", () => {
    expect(
      AuthService.validateNewAccount({
        username: "cashier2",
        email: "cashier2@jowen.com",
        password: "cafe123",
        role: "cashier",
        fullName: "Cashier Two",
      })
    ).toEqual({
      username: "cashier2",
      email: "cashier2@jowen.com",
      fullName: "Cashier Two",
      role: "cashier",
    });
  });

  it("should reject short passwords, bad emails, and bad roles", () => {
    const base = {
      username: "x",
      email: "x@jowen.com",
      password: "cafe123",
      role: "cashier",
    };
    expect(() => AuthService.validateNewAccount({ ...base, password: "123" })).toThrow(
      "at least 6 characters"
    );
    expect(() => AuthService.validateNewAccount({ ...base, email: "not-an-email" })).toThrow(
      "valid email"
    );
    expect(() => AuthService.validateNewAccount({ ...base, role: "manager" })).toThrow(
      "admin, cashier, stockist"
    );
    expect(() => AuthService.validateNewAccount({ ...base, username: "  " })).toThrow(
      "Username is required"
    );
  });

  it("should hash passwords with bcrypt (verifiable, salted)", async () => {
    const hash = await bcrypt.hash("cafe123", 10);
    expect(hash).not.toBe("cafe123");
    expect(await bcrypt.compare("cafe123", hash)).toBe(true);
    expect(await bcrypt.compare("wrong", hash)).toBe(false);
  });
});

describe("Legacy login fallback", () => {
  it("should log in the seeded accounts without a database", async () => {
    const admin = await AuthService.login({ username: "admin", password: "admin123" });
    expect(admin).toEqual({
      success: true,
      user: expect.objectContaining({ username: "admin", role: "admin" }),
    });
    const cashier = await AuthService.login({ username: "cashier1", password: "cashier123" });
    expect(cashier.user.role).toBe("cashier");
  });

  it("should reject wrong passwords and missing fields", async () => {
    expect((await AuthService.login({ username: "admin", password: "nope" })).success).toBe(false);
    expect((await AuthService.login({ username: "", password: "" })).success).toBe(false);
  });
});

describe("Manager verification without a database", () => {
  it("should approve the admin password and reject the rest", async () => {
    expect(await AuthService.verifyManager({ password: "admin123" })).toEqual({
      success: true,
      username: "admin",
    });
    expect((await AuthService.verifyManager({ password: "cashier123" })).success).toBe(false);
    expect((await AuthService.verifyManager({})).success).toBe(false);
  });
});

describe("Account guards", () => {
  it("should require admin approval for account writes", async () => {
    await expect(
      AuthService.createAccount(
        { username: "x", email: "x@jowen.com", password: "cafe123", role: "cashier" },
        { adminUsername: "cashier", adminPassword: "cashier123" }
      )
    ).rejects.toThrow("Manager approval failed");
  });

  it("should validate the account before touching the database", async () => {
    await expect(
      AuthService.createAccount(
        { username: "x", email: "bad", password: "cafe123", role: "cashier" },
        ADMIN
      )
    ).rejects.toThrow("valid email");
  });
});
