import { describe, expect, it } from "bun:test";
import {
  ChainShapeError,
  mirrorDisagrees,
  parseCooldown,
  parseRecoveryStatus,
  parseWalletConfig,
} from "./domain";

describe("đọc cấu hình ví từ chain", () => {
  it("giải mã guardians + threshold + timelock (u64 về dạng bigint)", () => {
    const cfg = parseWalletConfig({
      guardians: ["CAAA", "CBBB", "CCCC"],
      owner: "CWALLET",
      threshold: 2,
      timelock_secs: 86400n,
    });
    expect(cfg.guardians).toEqual(["CAAA", "CBBB", "CCCC"]);
    expect(cfg.threshold).toBe(2);
    expect(cfg.timelockSecs).toBe(86400);
  });

  it("hình dạng lạ thì THROW, không đoán — đọc nhầm ở màn veto là mất khả năng chặn", () => {
    expect(() => parseWalletConfig(null)).toThrow(ChainShapeError);
    expect(() => parseWalletConfig({ guardians: "CAAA", threshold: 2 })).toThrow(ChainShapeError);
    expect(() => parseWalletConfig({ guardians: [], threshold: "hai" })).toThrow(ChainShapeError);
  });
});

describe("đọc trạng thái khôi phục từ chain", () => {
  const raw = { approvals: ["CAAA"], started_at: 1000n, status: "Pending" };

  it("map enum contract sang chữ thường của app", () => {
    const req = parseRecoveryStatus(raw, 3600n);
    expect(req.status).toBe("pending");
    expect(req.approvals).toEqual(["CAAA"]);
    expect(req.startedAt).toBe(1000);
    expect(req.timelockRemainingSecs).toBe(3600);
  });

  it("timelock còn 0 = hết cửa sổ chặn", () => {
    expect(parseRecoveryStatus(raw, 0n).timelockRemainingSecs).toBe(0);
  });

  it("trạng thái lạ THROW thay vì im lặng coi như đã đóng", () => {
    expect(() => parseRecoveryStatus({ ...raw, status: "Whatever" }, 0n)).toThrow(ChainShapeError);
  });
});

describe("chain vs mirror", () => {
  it("chain mở mà mirror nói không có gì → BÁO LỆCH (đây là kịch bản indexer chết)", () => {
    expect(mirrorDisagrees({ chainOpen: true, mirrorOpen: false })).toBe(true);
  });

  it("hai bên khớp → không báo gì", () => {
    expect(mirrorDisagrees({ chainOpen: true, mirrorOpen: true })).toBe(false);
    expect(mirrorDisagrees({ chainOpen: false, mirrorOpen: false })).toBe(false);
  });
});

describe("cửa sổ bảo vệ sau khôi phục (cooldown)", () => {
  const link = ["CREGISTRY", 86400n];

  it("chưa từng khôi phục → không có cửa sổ nào", () => {
    const c = parseCooldown({ lastRotation: null, registryLink: link, nowSecs: 1000 });
    expect(c.active).toBe(false);
    expect(c.activeUntil).toBeNull();
  });

  it("vừa xoay khoá → ĐANG trong cửa sổ, biết chính xác lúc nào hết", () => {
    const c = parseCooldown({ lastRotation: 1000n, registryLink: link, nowSecs: 1500 });
    expect(c.active).toBe(true);
    expect(c.activeUntil).toBe(1000 + 86400);
    expect(c.cooldownSecs).toBe(86400);
  });

  it("qua mốc → hết bảo vệ, ví ký lại được bình thường", () => {
    const c = parseCooldown({ lastRotation: 1000n, registryLink: link, nowSecs: 1000 + 86400 });
    expect(c.active).toBe(false);
  });

  it("ví chưa nối registry → cooldown 0, không hiện cảnh báo giả", () => {
    const c = parseCooldown({ lastRotation: 1000n, registryLink: null, nowSecs: 1001 });
    expect(c.cooldownSecs).toBe(0);
    expect(c.active).toBe(false);
  });
});
