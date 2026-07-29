// Người bảo hộ tạo DANH TÍNH BẢO MẬT của chính họ trên máy của họ.
//
// Về mặt kỹ thuật đây là một smart account đầy đủ (giống ví chủ). Về mặt NGÔN
// NGỮ với người dùng thì không được gọi là "ví crypto của bạn": người bảo hộ là
// mẹ, là anh chị — họ nhận lời giúp người thân, không phải mở tài khoản tiền số.
// Copy ở màn /guardian/accept phải nói "danh tính bảo mật".
//
// Vì sao người bảo hộ cần địa chỉ hợp đồng chứ không phải chỉ passkey: registry
// nhận phiếu bằng `require_auth()`, mà chỉ Address mới require_auth được. Passkey
// thô là `Signer`, không phải Address. Muốn passkey bỏ phiếu thì nó phải nằm
// trong thứ có địa chỉ — chính là hợp đồng này.
//
// Phí deploy do VÍ PHÍ của app trả (kit dùng deployer keypair) — cấm bắt người
// bảo hộ tự nạp XLM để giúp người thân.
import { createWalletMinimal } from "./create-wallet";

/**
 * Tạo passkey + deploy hợp đồng của người bảo hộ → địa chỉ C… công khai.
 *
 * `ownerLabel` = email người bảo hộ, để passkey trong trình quản lý mật khẩu có
 * tên phân biệt được (một người có thể vừa là chủ ví của mình, vừa là người bảo
 * hộ cho hai ba ví khác — bốn khoá cùng tên là không dùng được).
 */
export async function createGuardianIdentity(opts?: {
  ownerLabel?: string | undefined;
}): Promise<{ address: string }> {
  const created = await createWalletMinimal(opts);
  return { address: created.stellarAddress };
}
