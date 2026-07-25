// Chính sách VÍ PHÍ hệ thống (B-SEC-3) — AI được ví phí trả tiền hộ, và TỐI ĐA
// bao nhiêu mỗi tx. Thuần: reader truyền vào bằng tham số nên test hermetic, không mạng.
//
// Ví phí là tài nguyên CHUNG, hữu hạn, và mọi tx nó ký tiêu XLM THẬT. Ba hàng rào,
// phải đủ cả ba — thiếu một là cạn ví phí, và ví phí cạn thì MỌI hộ mất đường ghi
// on-chain (kể cả recovery đang chạy):
//   1. `is_registered` — ví người gọi phải ĐÃ đăng ký trên registry (hàng rào NÀY);
//   2. rate-limit per-user (`writeLimit`, failOpen:false — đã có từ trước);
//   3. trần phí per-tx ([`FEE_CAP_STROOPS`] — đợt 1 viết hàm nhưng chỉ cắm ttl-keeper,
//      hai cửa người dùng gọi vẫn không có trần; closeout này cắm nốt).
//
// Vì sao hỏi CHAIN chứ không đọc cột DB: đề bài closeout viết "is_registered trong
// DB", nhưng kịch bản đỏ #2 (kẻ tấn công ghi DB tuỳ ý) biến đúng cột đó thành công
// tắc CỦA KẺ TẤN CÔNG — nó `UPDATE ... SET is_registered = true` rồi bơm tx tới khi
// ví phí cạn, và hàng rào 1 tự mở cửa. Chain-truth không có công tắc đó: registry là
// nguồn duy nhất, ghi vào registry đòi tx on-chain có chữ ký hợp lệ. Giá phải trả là
// một RPC `simulateTransaction` mỗi lần gác — simulate KHÔNG submit nên không tốn
// XLM, và cửa này đã bị rate-limit 10/phút. Đắt hơn một chút, đứng vững cả khi DB
// bị chiếm; đó là đánh đổi đúng cho hàng rào tiêu tiền.
import { Address, nativeToScVal, type xdr } from "@stellar/stellar-sdk";

/** Vi phạm chính sách ví phí — mang sẵn HTTP status để handler khỏi đoán. */
export class FeePolicyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FeePolicyError";
  }
}

/**
 * Trần phí per-tx (stroops) cho mọi cửa ví phí trả hộ. 5_000_000 = 0.5 XLM — dư xa
 * cho tx thật (invoke registry/SAC tốn cỡ vài trăm nghìn stroops), nhưng chặn
 * cost-attack: `assembleTransaction` nướng resource fee từ SIMULATION vào tx, nên
 * một contract do kẻ tấn công khai có thể ngốn tài nguyên tối đa và ví phí ký + trả
 * sạch. Giữ CÙNG một con số với ttl-keeper — hai trần khác nhau cho cùng một ví là
 * mời người sau sửa lệch một bên.
 */
export const FEE_CAP_STROOPS = 5_000_000;

/**
 * Method DUY NHẤT ví phí trả hộ khi ví CHƯA đăng ký.
 *
 * `register_wallet` chính là hành động SINH RA `is_registered == true`. Đòi
 * is_registered trước nó là deadlock: không hộ nào đăng ký được lần đầu, tức hàng
 * rào tự khoá luôn sản phẩm. Đây là ngoại lệ bootstrap có chủ đích, và nó hẹp: một
 * ví chỉ `register_wallet` được MỘT lần (contract chối `AlreadyRegistered` #1), nên
 * cửa này không thành đường bơm tx vô hạn.
 */
export const FEE_BOOTSTRAP_METHODS: ReadonlySet<string> = new Set(["register_wallet"]);

/** Đọc view on-chain (simulate, không submit) — khớp `read` của các gateway sẵn có. */
export type ContractReader = (input: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
}) => Promise<unknown>;

/**
 * HÀNG RÀO 1 — ví phí chỉ trả hộ ví ĐÃ đăng ký trên registry.
 *
 * Fail-closed một cách tường minh: chỉ `=== true` mới qua. Read trả `undefined`,
 * `null`, chuỗi rỗng, hay panic (throw) đều là "không chứng minh được đã đăng ký"
 * → chặn. Nếu để `if (registered === false) throw` thì RPC lỗi/đọc hụt sẽ thành
 * cửa mở, đúng cái nết fail-open mà luật phiên này cấm.
 */
export async function assertSponsorshipAllowed(input: {
  read: ContractReader;
  registryContractId: string;
  walletAddress: string;
  method: string;
}): Promise<void> {
  if (FEE_BOOTSTRAP_METHODS.has(input.method)) return;

  let registered: unknown;
  try {
    registered = await input.read({
      contractId: input.registryContractId,
      method: "is_registered",
      args: [nativeToScVal(new Address(input.walletAddress))],
    });
  } catch {
    // Không đọc được chain = không chứng minh được quyền tiêu ví phí.
    throw new FeePolicyError(403, "SPONSORSHIP_CHECK_UNAVAILABLE");
  }
  if (registered !== true) {
    throw new FeePolicyError(403, "WALLET_NOT_REGISTERED_FOR_SPONSORSHIP");
  }
}
