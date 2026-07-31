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

const { clearRecoveryDraft, knockWithNewPasskey, loadRecoveryAddress, loadRecoveryDraft } =
  await import("./device-recovery");

const ADDRESS = `C${"B".repeat(55)}`;

async function knock() {
  create.mockResolvedValue({
    credentialId: "credential-1",
    publicKey: new Uint8Array([1, 2, 3]),
  });
  post.mockResolvedValue({
    data: { accepted: true, fingerprint: "ABCD-1234" },
  });
  return knockWithNewPasskey(ADDRESS);
}

describe("device recovery draft", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearRecoveryDraft();
    post.mockReset();
    create.mockReset();
  });

  it("keeps wallet-linking material in SPA memory, never web storage", async () => {
    const draft = await knock();

    expect(loadRecoveryDraft()).toEqual(draft);
    expect(localStorage.length).toBe(0);

    clearRecoveryDraft();
    expect(loadRecoveryDraft()).toBeNull();
  });

  // ── R6 (D6) — địa chỉ sống qua F5, ba trường còn lại thì KHÔNG ─────────────
  // Đóng tab từng là mất luôn đường về màn tiến trình, và người mất máy phải nhớ
  // lại 56 ký tự base32 — đúng thứ họ không nhớ nổi. Địa chỉ ví vốn public trên
  // chain (và đang nằm trong `?address=` của mọi màn khôi phục) nên giữ nó không
  // hạ chuẩn gì; vật liệu khoá thì tuyệt đối không.
  it("sessionStorage CHỈ chứa địa chỉ — không credentialId / keyBase64 / fingerprint", async () => {
    const draft = await knock();

    expect(loadRecoveryAddress()).toBe(ADDRESS);

    // Soi TOÀN BỘ sessionStorage, không chỉ key mình biết tên: khẳng định phải là
    // "không có bí mật nào ở đây", không phải "key của tôi thì sạch".
    const dump = Object.keys(sessionStorage)
      .map((k) => `${k}=${sessionStorage.getItem(k)}`)
      .join("|");
    expect(dump).toContain(ADDRESS);
    expect(dump).not.toContain(draft.credentialId);
    expect(dump).not.toContain(draft.keyBase64);
    expect(dump).not.toContain(draft.fingerprint);
    // localStorage (sống qua cả đóng trình duyệt) vẫn phải trắng tinh.
    expect(localStorage.length).toBe(0);
  });

  it("clearRecoveryDraft dọn luôn địa chỉ", async () => {
    await knock();
    clearRecoveryDraft();
    expect(loadRecoveryAddress()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("giá trị rác trong sessionStorage → bỏ qua, không đẩy vào ?address=", () => {
    sessionStorage.setItem("vgd.recovery.address", "javascript:alert(1)");
    expect(loadRecoveryAddress()).toBeNull();
  });
});
