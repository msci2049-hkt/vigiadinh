# SECURITY-NOTES — cảnh báo khóa đã lộ (T1)

> Cập nhật 2026-07-20. File append-only: thêm ghi chú mới ở dưới, đừng xoá lịch sử.

## 🔴 P0 — 5 secret seed trong `vigiadinh-main/.../scripts/keys.json` coi như CÔNG KHAI

`vigiadinh-main/vigiadinh-main/scripts/keys.json` chứa **5 secret seed `S...` dạng plaintext**
(1 owner ví + 3 guardian + 1 newOwner). File dùng cho demo recovery testnet của dự án cũ. Vì nó
nằm trong cây thư mục dự án và **không được `.gitignore`** (thư mục contract chưa phải git repo),
mọi seed này phải bị coi là **đã rò rỉ vĩnh viễn**.

### Kết quả quét (2026-07-20)
- `git log -p --all | grep -E "S[A-Z2-7]{55}"` trên **stellaer-be** → **0 match** (lịch sử BE sạch). ✅
- `git log -p --all | grep ...` trên **stellar-fe-vite** → **0 match** (lịch sử FE sạch). ✅
- `vigiadinh-main` **KHÔNG phải git repo** → không có lịch sử để rewrite, nhưng file plaintext
  vẫn nằm trên đĩa và được `scripts/demo.sh`, `demo-veto.sh`, `gen-keys.mjs`, `config.mjs` tham chiếu.
- → Không cần rewrite history (chưa repo nào push seed). **NHƯNG** trước khi đưa thư mục contract
  vào bất kỳ repo push lên GitHub, PHẢI `.gitignore` `keys.json` (xem "Việc bắt buộc").

### Địa chỉ công khai (G...) có secret ĐÃ LỘ — CẤM dùng ở mainnet VĨNH VIỄN
Các địa chỉ dưới đây có private key đã public. **Cấm nạp tiền thật / cấm làm signer trên mainnet.**
Chỉ được xuất hiện lại như dữ liệu test testnet (nơi tiền không có giá trị).

| Vai trò | Địa chỉ công khai (an toàn để ghi) | Trạng thái secret |
|---|---|---|
| Ví (owner gốc) | `GAFEYPMPYEL7NJR6KJJMD3TAMBYOY6BTAZOTI7SAY7CYHVPTG7AUCUMF` | 🔴 LỘ — cấm mainnet |
| Guardian 1 | `GAFPGGDSR76QBBZFOR7DCYSN2FQZECHN6QIZFGNLY3JMWBM4QEYGFTXN` | 🔴 LỘ — cấm mainnet |
| Guardian 2 | `GADEMB5763QM3KTF3CMFQF36E5P23R2CWFRLSNQVDIRPB4LHYUNSIY54` | 🔴 LỘ — cấm mainnet |
| Guardian 3 | `GDLCMHSL6CH2KO3LONRKP4UXTSVZOWXDPHUP5YYGYGGSYFUBKSAOLQMG` | 🔴 LỘ — cấm mainnet |
| newOwner | `GBS3FXQRTDHFDYDTEIYJ6PITXUCKZSF4IKI7MRIAPUK5UFHFBY5QJJ7R` | 🔴 LỘ — cấm mainnet |

### Việc bắt buộc (làm trước khi push repo có chứa thư mục contract)
1. **`.gitignore` cho thư mục contract**: thêm `scripts/keys.json` (+ bất kỳ `*keys*.json`) và `.env`
   trước khi `git init`/`git add` thư mục contract. Thà thừa còn hơn để lộ.
2. **Sinh key deploy testnet MỚI** khi M0 cần tx thật (`stellar keys generate <name> --network testnet`
   + friendbot fund). Lưu ngoài repo hoặc trong file đã `.gitignore` — KHÔNG commit secret.
3. **Mainnet (P3)**: sinh bộ khóa hoàn toàn mới, khác dev/testnet (rule `security.md`:
   "Key deploy testnet ≠ key mainnet ≠ key dev"). Không bao giờ tái dùng 5 seed ở trên.

### Tự quyết (session 2026-07-20)
- **Chưa sinh key testnet mới ngay** — chỉ có nghĩa khi M0 deploy (cần friendbot fund tại thời điểm
  deploy). Ghi rõ yêu cầu ở đây; sinh + fund trong bước deploy của M0, lưu vào file `.gitignore`.
- **Chưa xoá `keys.json`** — thư mục contract chưa được đưa vào git nào; xoá bây giờ có thể phá
  demo cũ của dự án tham chiếu. Sẽ `.gitignore` (không xoá nội dung) ngay khi thư mục vào git.
