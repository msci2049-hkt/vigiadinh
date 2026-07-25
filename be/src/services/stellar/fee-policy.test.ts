// Test THUẦN cổng ví phí (B-SEC-3) + trả lời kịch bản đỏ #2 phần "ví phí".
//
// Trọng tâm không chỉ là "chối ví chưa đăng ký", mà là CHỐI DỰA VÀO ĐÂU. Kịch bản #2
// giả định kẻ tấn công ghi DB tuỳ ý; nếu hàng rào 1 đọc một cột DB thì nó tự mở cửa
// bằng một câu UPDATE. Nên test khẳng định cổng hỏi ĐÚNG registry on-chain, đúng
// method, đúng địa chỉ ví — và không có đường DB nào trong hàm.
import { describe, expect, it } from "bun:test";
import { Address, StrKey, scValToNative, type xdr } from "@stellar/stellar-sdk";
import {
  assertSponsorshipAllowed,
  FEE_BOOTSTRAP_METHODS,
  FEE_CAP_STROOPS,
  FeePolicyError,
} from "./fee-policy";

const REGISTRY = StrKey.encodeContract(Buffer.alloc(32, 3));
const WALLET = StrKey.encodeContract(Buffer.alloc(32, 5));

type Call = { contractId: string; method: string; args: xdr.ScVal[] };

function recorder(answer: unknown | (() => never)) {
  const calls: Call[] = [];
  const read = async (input: Call): Promise<unknown> => {
    calls.push(input);
    if (typeof answer === "function") return (answer as () => never)();
    return answer;
  };
  return { calls, read };
}

describe("assertSponsorshipAllowed — hàng rào 1 của ví phí", () => {
  it("ví đã đăng ký → cho qua, và hỏi ĐÚNG registry/method/ví", async () => {
    const { calls, read } = recorder(true);
    await assertSponsorshipAllowed({
      read,
      registryContractId: REGISTRY,
      walletAddress: WALLET,
      method: "approve_recovery",
    });

    expect(calls).toHaveLength(1);
    // Hỏi REGISTRY, không phải contract nào khác — nếu sai chỗ hỏi thì câu trả lời
    // "đã đăng ký" có thể do chính contract của kẻ tấn công cung cấp.
    expect(calls[0]?.contractId).toBe(REGISTRY);
    expect(calls[0]?.method).toBe("is_registered");
    const arg = calls[0]?.args[0];
    if (!arg) throw new Error("thiếu arg ví");
    expect(Address.fromScAddress(arg.address()).toString()).toBe(WALLET);
    expect(scValToNative(arg)).toBe(WALLET);
  });

  it("ví CHƯA đăng ký → 403 WALLET_NOT_REGISTERED_FOR_SPONSORSHIP", async () => {
    const { read } = recorder(false);
    const err = await assertSponsorshipAllowed({
      read,
      registryContractId: REGISTRY,
      walletAddress: WALLET,
      method: "approve_recovery",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(FeePolicyError);
    expect((err as FeePolicyError).status).toBe(403);
    expect((err as FeePolicyError).message).toBe("WALLET_NOT_REGISTERED_FOR_SPONSORSHIP");
  });

  // FAIL-CLOSED, ca quan trọng nhất của cả file. Bất kỳ câu trả lời KHÔNG phải
  // `true` đều là "không chứng minh được", kể cả những thứ JS coi là truthy.
  it("mọi câu trả lời không-phải-true đều bị chối (fail-closed)", async () => {
    for (const answer of [undefined, null, 0, 1, "true", "", {}, [], Number.NaN]) {
      const { read } = recorder(answer);
      const err = await assertSponsorshipAllowed({
        read,
        registryContractId: REGISTRY,
        walletAddress: WALLET,
        method: "approve_recovery",
      }).catch((e) => e);
      expect(err).toBeInstanceOf(FeePolicyError);
    }
  });

  it("đọc chain lỗi (RPC chết) → chối, KHÔNG thả", async () => {
    const { read } = recorder(() => {
      throw new Error("RPC unreachable");
    });
    const err = await assertSponsorshipAllowed({
      read,
      registryContractId: REGISTRY,
      walletAddress: WALLET,
      method: "approve_recovery",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(FeePolicyError);
    expect((err as FeePolicyError).message).toBe("SPONSORSHIP_CHECK_UNAVAILABLE");
  });

  // Cửa bootstrap: KHÔNG hỏi chain, vì `register_wallet` chính là hành động tạo ra
  // is_registered. Hỏi trước nó là deadlock cho mọi hộ mới.
  it("register_wallet → qua mà KHÔNG hỏi chain (bootstrap)", async () => {
    const { calls, read } = recorder(false);
    await assertSponsorshipAllowed({
      read,
      registryContractId: REGISTRY,
      walletAddress: WALLET,
      method: "register_wallet",
    });
    expect(calls).toHaveLength(0);
  });

  it("cửa bootstrap CHỈ có register_wallet — không nới thêm method nào", () => {
    expect([...FEE_BOOTSTRAP_METHODS]).toEqual(["register_wallet"]);
    // Trần phí giữ cùng con số với ttl-keeper (hai trần khác nhau cho một ví là
    // mời người sau sửa lệch một bên).
    expect(FEE_CAP_STROOPS).toBe(5_000_000);
  });

  // KỊCH BẢN ĐỎ #2 — kẻ tấn công ghi DB tuỳ ý. Cổng này KHÔNG có tham số nào lấy từ
  // DB: `registryContractId` từ env, `walletAddress` từ bản ghi ví đã scope theo chủ,
  // và câu trả lời "đã đăng ký chưa" từ CHAIN. Ghi DB tuỳ ý KHÔNG bật được hàng rào.
  it("#2: không có đường DB nào — chỉ chain quyết định", async () => {
    // Dựng reader trả `false` như một registry thật nói "chưa đăng ký". Không có
    // cách nào để một giá trị DB lật kết quả này, vì hàm không đọc DB.
    const { calls, read } = recorder(false);
    const err = await assertSponsorshipAllowed({
      read,
      registryContractId: REGISTRY,
      walletAddress: WALLET,
      method: "finalize_recovery",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(FeePolicyError);
    // Đúng một lời gọi, và là lời gọi CHAIN.
    expect(calls.map((c) => c.method)).toEqual(["is_registered"]);
  });
});
