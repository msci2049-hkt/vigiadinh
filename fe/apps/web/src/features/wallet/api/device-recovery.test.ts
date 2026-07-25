import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const create = vi.fn();

vi.mock("@/lib/api-client", () => ({ apiClient: { post } }));
vi.mock("@/lib/env", () => ({
  env: {
    VITE_APP_NAME: "Ví Gia Đình",
    VITE_WEBAUTHN_VERIFIER_ADDRESS: `G${"A".repeat(55)}`,
  },
}));
vi.mock("../lib/kit", () => ({
  getWalletKit: () => ({ credentials: { create } }),
}));

const { clearRecoveryDraft, knockWithNewPasskey, loadRecoveryDraft } = await import(
  "./device-recovery"
);

describe("device recovery draft", () => {
  beforeEach(() => {
    localStorage.clear();
    clearRecoveryDraft();
    post.mockReset();
    create.mockReset();
  });

  it("keeps wallet-linking material in SPA memory, never web storage", async () => {
    create.mockResolvedValue({
      credentialId: "credential-1",
      publicKey: new Uint8Array([1, 2, 3]),
    });
    post.mockResolvedValue({
      data: { accepted: true, fingerprint: "ABCD-1234" },
    });

    const address = `C${"B".repeat(55)}`;
    const draft = await knockWithNewPasskey(address);

    expect(loadRecoveryDraft()).toEqual(draft);
    expect(localStorage.length).toBe(0);

    clearRecoveryDraft();
    expect(loadRecoveryDraft()).toBeNull();
  });
});
