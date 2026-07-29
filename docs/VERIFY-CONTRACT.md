# VERIFY-CONTRACT — trạng thái "tích xanh" trên explorer

> Audit read-only 2026-07-29 (phiên AUDIT-TINH-NANG). Mọi số liệu có lệnh/URL kèm theo.
> **Kết luận nhanh: CHƯA có tích xanh.** Cả 5 contract trên StellarExpert testnet đều
> `"validation": {"status": "unverified"}`. Build tái lập thì ĐÃ đạt (hash khớp 100%),
> nhưng chưa có bên thứ ba nào attest công khai. Hai thứ đó khác nhau — xem §1.

---

## §1 · Phân biệt hai khái niệm

| | Build tái lập khớp hash | Verified trên explorer |
|---|---|---|
| Là gì | Tự build từ source ra đúng wasm hash on-chain | GitHub Action build từ tag công khai, attest hash, explorer gắn badge + link source |
| Ai xác nhận | Chính mình | StellarExpert (bên thứ ba) + GitHub attestation |
| Trạng thái dự án | ✅ **ĐÃ CÓ** (bảng §2) | ⛔ **CHƯA CÓ** (bằng chứng §3) |

## §2 · Hiện trạng hash — build local khớp on-chain 100% (V-Q1)

Lệnh: `stellar contract fetch --id <C> --network testnet` rồi `sha256sum` so với
`contracts/target/wasm32v1-none/release/*.wasm` (artifact build 2026-07-28 00:56 từ cây source ae9cdd8):

| Contract | ID | Hash on-chain | Local build | Khớp |
|---|---|---|---|---|
| recovery-registry | `CDDOCXZ3…F4Q3` | `02d832652ec304a7…` | `recovery_registry.wasm` cùng hash | ✅ |
| web-auth | `CCSIOPPE…57F5O` | `e44a1fcbebb81958…` | `web_auth.wasm` cùng hash | ✅ |
| origin-verifier | `CAYJGXLB…EOYQS` | `f08df14171043125…` | `origin_verifier.wasm` cùng hash | ✅ |
| verifier-ed25519 | `CBKTEIWO…PHDGK` | `ca426cd366ca2f9d…` | `verifier_ed25519.wasm` cùng hash | ✅ |
| smart-account (ví thật `CD5QX3…E7AJT`) | wasm | `2c19ee49d7f25a6a…` | `smart_account.wasm` cùng hash | ✅ |

Metadata nhúng trong wasm (V-Q2) — `stellar contract info meta --id CDDOCXZ3… --network testnet`:

```
rsver: 1.97.1  ·  rssdkver: 26.1.1#8ac18efb  ·  rssdk_spec_shaking: 2  ·  cliver: 27.0.0#5a7c5fe
```

→ chỉ có version toolchain. **KHÔNG có `source_repo`, KHÔNG có commit hash** nhúng trong wasm.

## §3 · Trạng thái verify trên explorer (V-Q5)

`curl https://api.stellar.expert/explorer/testnet/contract/<C>` — cả 5 contract (4 hạ tầng + ví
thật CD5QX3…) đều trả:

```json
"validation": {"status": "unverified"}
```

→ **Chưa contract nào có tích xanh.** (Trường `validation` xuất hiện trên API testnet —
tức StellarExpert CÓ hỗ trợ validation cho testnet, không chỉ mainnet.)

## §4 · Cơ chế verify của StellarExpert (V-Q3)

Nguồn: `https://stellar.expert/explorer/public/contract/validation` +
`github.com/stellar-expert/soroban-build-workflow` (README đọc 2026-07-29).

- Cơ chế = **reproducible build qua GitHub Actions**, không phải submit source thủ công:
  repo chứa `.github/workflows/release.yml` gọi reusable workflow
  `stellar-expert/soroban-build-workflow/.github/workflows/release.yml@main`.
- Trigger: **push tag `v*`** (hoặc `workflow_dispatch` với release name duy nhất).
- Workflow build wasm tối ưu → tạo GitHub Release đính artifact → sinh **build attestation**
  (cần permissions `id-token: write`, `contents: write`, `attestations: write`).
- Explorer khớp theo **wasm hash**: hash on-chain trùng hash artifact đã attest → badge
  "Build Verified" + link tới repo/snapshot source tại thời điểm build.
- Lưu ý quan trọng trong README: *"Build Verified means the GitHub Action run has attested to
  have built the Wasm, but does not verify the source code"* — badge là chứng nhận build,
  không phải security audit.
- README khuyến cáo: contract nên được **deploy trực tiếp từ artifact của GitHub Release**,
  nếu không hash có thể lệch do khác môi trường build.
- Chuẩn hoá dài hạn: có draft SEP "Contract Source Validation" (stellar discussion #1573).

## §5 · Repo public hay private (V-Q4)

| Repo | Kiểm tra | Kết quả |
|---|---|---|
| `msci2026vn/family-wallet` (origin) | `curl api.github.com/repos/...` không token → **404** | **PRIVATE** (không thấy công khai) |
| `msci2049-hkt/vigiadinh` (mirror, CI đang chạy ở đây) | `"private": false, "visibility": "public"` | **PUBLIC** ✅ |

→ Điều kiện "source công khai" **đã thoả sẵn** qua mirror. Chạy verify trên mirror, không cần đổi gì ở origin.

## §6 · Các bước cần làm để có tích xanh

1. **Thêm 1 file duy nhất** `.github/workflows/release.yml` (trigger `push: tags: v*`,
   permissions `id-token/contents/attestations: write`), 4 job — mỗi contract một job:
   `relative_path: '["contracts/recovery-registry"]'` + `package: 'recovery-registry'`
   (tương tự web-auth, origin-verifier, verifier-ed25519; thêm smart-account nếu muốn verify wasm ví).
   Lưu ý workspace: `contracts/Cargo.toml` là workspace root — cần thử `relative_path: '["contracts"]'`
   + `package` từng crate nếu đường dẫn crate con không tự resolve.
2. **Push tag** `v0.x` lên mirror `msci2049-hkt/vigiadinh` (repo đã public, gh đã có token account này).
3. **So hash release với on-chain**: workflow in SHA256 từng wasm trong output.
   - Toolchain pin đã trùng loại (rsver 1.97.1 / sdk 26.1.1 / cli 27) và build local đã reproducible,
     nên xác suất khớp cao — nhưng **chưa chắc chắn** vì máy build của Action khác WSL.
4. **Nhánh A — hash khớp**: validation match theo hash, badge tự xuất hiện trên trang contract
   (testnet lẫn mainnet sau này). Xong.
5. **Nhánh B — hash lệch**: phải **redeploy contract từ artifact release** để hash on-chain = hash attest.
   Chi phí nhánh B không nhỏ:
   - `recovery-registry` redeploy = contract ID mới = **mất đăng ký guardian on-chain hiện có**,
     phải chạy lại luồng đăng ký + cập nhật env/vars trỏ ID mới.
   - `web-auth` / `origin-verifier` / `verifier-ed25519` ít state hơn nhưng vẫn phải cập nhật
     mọi chỗ pin ID (FE vars, BE env, docs).
   - Ví thật `CD5QX3…` KHÔNG cần đụng (chỉ wasm hash smart-account cần attest; ví đang chạy giữ nguyên).

Việc phụ (không bắt buộc cho badge, nên làm cho lần deploy sau): nhúng `source_repo` + commit vào
contractmeta khi build để wasm tự khai nguồn gốc — đổi hash nên chỉ áp cho bản deploy mới.

## §7 · Ước lượng công & rủi ro

| Việc | Công |
|---|---|
| Viết workflow + push tag + theo dõi run | ~0.5 ngày |
| Nhánh A (hash khớp) — không làm gì thêm | +0 |
| Nhánh B (hash lệch) — redeploy 4 contract hạ tầng + re-register guardian + sửa env/vars | +0.5–1 ngày |

Rủi ro khi source công khai: **không phát sinh mới** — mirror `msci2049-hkt/vigiadinh` đã public
từ trước (CI chạy ở đó), lịch sử đã có gate gitleaks trong CI. Không có secret trong contracts/
(chỉ Rust source + Cargo.lock). Điều duy nhất "lộ" là điều đã lộ sẵn.

Rủi ro kỹ thuật: workflow của StellarExpert build bằng container riêng — nếu version stellar-cli
của container khác 27.0.0 thì meta (`cliver`) đổi → hash đổi → rơi vào nhánh B. Có thể pin
version qua input của workflow nếu cần (xem tài liệu workflow khi làm).

---

*Kết luận cho ban giám khảo (một câu, trung thực): "Toàn bộ contract build tái lập được —
hash on-chain khớp source công khai 100%; badge verify của StellarExpert đang trong lộ trình,
cần một workflow release + tag (~nửa ngày), không chặn demo."*
