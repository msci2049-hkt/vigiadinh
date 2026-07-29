// GÁC TÁI DIỄN sự cố 29/07: mã lỗi BE có nói rõ nguyên nhân mà FE vẫn hiện câu
// chung "Chưa có gì được gửi đi". Test này khoá hai điều:
//   1. mã ĐÃ MAP không bao giờ rơi về câu chung;
//   2. mã CHƯA MAP thì rơi về câu chung NHƯNG kèm mã kỹ thuật (không im lặng).
import { ApiError } from "@repo/core";
import { describe, expect, it } from "vitest";
import { mapSendApiError } from "./send-error";

/** Đúng envelope lỗi của BE: `{error:{code,message}}` (middlewares/error.ts). */
const apiErr = (status: number, code: string) =>
  new ApiError(`Request failed (${status})`, status, { error: { code, message: code } });

describe("mapSendApiError — mã đã map", () => {
  it("403 WALLET_NOT_REGISTERED_FOR_SPONSORSHIP → câu RIÊNG + lối thoát bảo vệ ví", () => {
    const v = mapSendApiError(apiErr(403, "WALLET_NOT_REGISTERED_FOR_SPONSORSHIP"));
    expect(v.title).toBe("wallet.send.errors.notProtectedTitle");
    expect(v.body).toBe("wallet.send.errors.notProtectedBody");
    expect(v.action).toBe("protect");
    expect(v.title).not.toBe("wallet.send.errors.notSent");
  });

  it("403 SPONSORSHIP_CHECK_UNAVAILABLE → câu riêng, KHÁC câu ví chưa được bảo vệ", () => {
    const v = mapSendApiError(apiErr(403, "SPONSORSHIP_CHECK_UNAVAILABLE"));
    expect(v.title).toBe("wallet.send.errors.checkUnavailableTitle");
    expect(v.action).toBeNull();
  });

  it("403 NOT_OWNER và NOT_GUARDIAN_OF_INTENT là HAI câu khác nhau", () => {
    const owner = mapSendApiError(apiErr(403, "NOT_OWNER"));
    const guardian = mapSendApiError(apiErr(403, "NOT_GUARDIAN_OF_INTENT"));
    expect(owner.title).toBe("wallet.send.errors.notOwnerTitle");
    expect(guardian.title).toBe("wallet.send.errors.notGuardianTitle");
    expect(owner.title).not.toBe(guardian.title);
  });

  it("409 SPENDING_LIMIT_EXCEEDED → dẫn thẳng tới Cài đặt An toàn", () => {
    const v = mapSendApiError(apiErr(409, "SPENDING_LIMIT_EXCEEDED"));
    expect(v.title).toBe("wallet.send.errors.spendingLimit");
    expect(v.action).toBe("safety");
  });

  it("429 RATE_LIMITED / RATE_LIMIT_STORE_DOWN → câu 'bấm hơi nhanh', không phải câu chung", () => {
    for (const code of ["RATE_LIMITED", "RATE_LIMIT_STORE_DOWN"]) {
      const v = mapSendApiError(apiErr(429, code));
      expect(v.title, code).toBe("wallet.send.errors.rateLimitedTitle");
    }
  });

  it("409 INVALID_TRANSITION:… (bấm lại cùng intent) → câu 'lệnh đã cũ' + làm lại từ đầu", () => {
    const v = mapSendApiError(apiErr(409, "INVALID_TRANSITION:policy_gate:owner:confirm"));
    expect(v.title).toBe("wallet.send.errors.staleIntentTitle");
    expect(v.action).toBe("startOver");
  });

  it("400 INSUFFICIENT_BALANCE:{json} → giữ nguyên số tiền còn thiếu", () => {
    const v = mapSendApiError(apiErr(400, 'INSUFFICIENT_BALANCE:{"shortfall":"1230000000"}'));
    expect(v.title).toBe("wallet.send.errors.insufficient");
    expect(v.shortfall).toBe("1230000000");
  });

  it("INSUFFICIENT_BALANCE với JSON hỏng vẫn ra câu đúng (không văng)", () => {
    const v = mapSendApiError(apiErr(400, "INSUFFICIENT_BALANCE:{khong-phai-json"));
    expect(v.title).toBe("wallet.send.errors.insufficient");
    expect(v.shortfall).toBeUndefined();
  });

  it("5xx → câu 'mạng', KHÔNG phải câu chung (lỗi của chúng tôi, không phải của họ)", () => {
    expect(mapSendApiError(apiErr(502, "STELLAR_UNAVAILABLE")).title).toBe(
      "wallet.send.errors.network",
    );
    expect(mapSendApiError(apiErr(500, "INTERNAL_ERROR")).title).toBe("wallet.send.errors.network");
  });
});

describe("mapSendApiError — mã chưa map", () => {
  it("mã LẠ → câu chung NHƯNG kèm mã kỹ thuật để còn debug", () => {
    const v = mapSendApiError(apiErr(409, "SOME_BRAND_NEW_CODE"));
    expect(v.title).toBe("wallet.send.errors.notSent");
    expect(v.code).toBe("SOME_BRAND_NEW_CODE");
  });

  it("body rỗng / không đúng envelope → câu chung, KHÔNG hiện mã rỗng", () => {
    const v = mapSendApiError(new ApiError("boom", 418, null));
    expect(v.title).toBe("wallet.send.errors.notSent");
    expect(v.code).toBeUndefined();
  });

  it("BE bản cũ chỉ có `message` (không có `code`) vẫn map được", () => {
    const err = new ApiError("x", 403, { error: { message: "WALLET_NOT_REGISTERED_FOR_SPONSORSHIP" } });
    expect(mapSendApiError(err).title).toBe("wallet.send.errors.notProtectedTitle");
  });
});
