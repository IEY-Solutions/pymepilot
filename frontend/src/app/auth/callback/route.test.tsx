import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockExchangeCodeForSession = vi.fn();
const mockVerifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      verifyOtp: mockVerifyOtp,
    },
  })),
}));

function get(url: string, headers?: Record<string, string>) {
  return GET(new Request(url, { headers }));
}

function locationOf(response: Response): string {
  const location = response.headers.get("location");
  if (!location) {
    throw new Error("expected a redirect Location header");
  }
  // Devolvemos pathname+search para asertar sin acoplarnos al host.
  const parsed = new URL(location);
  return `${parsed.pathname}${parsed.search}`;
}

describe("/auth/callback recovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges the code server-side and redirects to /reset-password", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await get("https://app.test/auth/callback?code=recovery-code-123");

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("recovery-code-123");
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("/reset-password");
  });

  it("redirects to forgot-password when the code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "Invalid or expired code" },
    });

    const response = await get("https://app.test/auth/callback?code=bad-code");

    expect(locationOf(response)).toBe("/forgot-password?reason=recovery-invalid");
  });

  it("verifies token_hash via verifyOtp and redirects to /reset-password", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const response = await get(
      "https://app.test/auth/callback?token_hash=hash-abc&type=recovery",
    );

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hash-abc",
    });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("/reset-password");
  });

  it("redirects to forgot-password when verifyOtp fails", async () => {
    mockVerifyOtp.mockResolvedValue({
      error: { message: "Invalid recovery token" },
    });

    const response = await get(
      "https://app.test/auth/callback?token_hash=bad&type=recovery",
    );

    expect(locationOf(response)).toBe("/forgot-password?reason=recovery-invalid");
  });

  it("redirects to forgot-password when neither code nor token_hash are provided", async () => {
    const response = await get("https://app.test/auth/callback");

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("/forgot-password?reason=recovery-missing-code");
  });

  it("honors x-forwarded-host for the redirect origin", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await get("https://internal.vercel/auth/callback?code=abc", {
      "x-forwarded-host": "pymepilot-hazel.vercel.app",
      "x-forwarded-proto": "https",
    });

    const location = response.headers.get("location") ?? "";
    expect(location).toBe("https://pymepilot-hazel.vercel.app/reset-password");
  });

  it("does not leak the recovery code in the redirect target", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await get("https://app.test/auth/callback?code=secret-code");

    expect(response.headers.get("location") ?? "").not.toContain("secret-code");
  });
});
