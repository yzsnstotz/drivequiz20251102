import { describe, it, expect } from "vitest";
import { authOptions } from "@/lib/auth";

describe("Google signIn email normalization", () => {
  it("normalizes Google email to lower-case when no existing user", async () => {
    const user: any = { email: "Test.Google@Example.com" };
    const account: any = { provider: "google", type: "oauth" };
    const profile: any = { email: "Test.Google@Example.com" };

    const result = await authOptions.callbacks!.signIn!({ user, account, profile } as any);

    expect(result).toBe(true);
    expect(user.email).toBe("test.google@example.com");
  });

  it("does not change non-google provider email", async () => {
    const user: any = { email: "MixedCase@Example.com" };
    const account: any = { provider: "line", type: "oauth" };
    const profile: any = { email: "MixedCase@Example.com" };

    const result = await authOptions.callbacks!.signIn!({ user, account, profile } as any);
    expect(result).toBe(true);
    expect(user.email).toBe("MixedCase@Example.com");
  });
});
