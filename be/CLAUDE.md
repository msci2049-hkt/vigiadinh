# CLAUDE.md — FamilyWallet Backend (`stellaer-be`)

Ví Stellar mà gia đình khôi phục được: social recovery + thừa kế chia % + AI người gác đêm +
theo dõi kết nối người bảo hộ. Sản phẩm TOÀN CẦU (không hardcode ngôn ngữ/kênh/tiền tệ nước nào).

Đọc trước khi làm bất cứ việc gì: `docs/PROJECT-BRIEF.md` (dự án là gì, trạng thái, lỗ hổng đã biết)
→ rule khớp việc trong `.claude/rules/` → skill khớp việc trong `.claude/skills/`.
Nền template BE chi tiết (stack, mount order, convention, BUG-001…014, deploy): `docs/TEMPLATE-PRIMER-BE.md`.

## Bản đồ dự án — monorepo `family-wallet` (git chung, build riêng)

```
family-wallet/
  be/          ← THƯ MỤC NÀY — Backend: Bun + Hono + Drizzle/Postgres + Dragonfly + BullMQ + Better Auth
  fe/          Frontend: React 19 + Vite + TanStack + Tailwind 4 (pnpm 9 + Node ≥20 — KHÔNG bun)
  contracts/   Soroban Rust — dựng ở PHA 2+ (nguồn cũ: vigiadinh-main/recovery-registry, ngoài repo)
  shared/      NGUỒN hợp đồng BE↔FE (enum trạng thái, intent) — `bun run sync:contract` ở root
```

- BE và FE nói chuyện **chỉ qua HTTP** — CẤM import chéo giữa `be/`/`fe/` (luật CLAUDE.md root).
  Enum dùng chung: `shared/` (root) là nguồn → copy AUTO-SYNC vào `src/shared-contract/`
  (contract.ts + intent.ts, gác bằng `check:contract` root). Phần còn lại của
  `src/shared-contract/` (api-envelope, sse) BE vẫn là nguồn, sync theo `docs/CONTRACT-SYNC.md`.
- `src/lib/access-control.ts` phải **giống hệt** FE `packages/auth/src/access-control.ts`.
  Thêm/sửa role = sửa CẢ HAI bên trong cùng một commit (kiểm bằng `contract:check`).
- Spec UI = `vigiadinh-mockup.html` (41 màn, 8 nhóm — **nhóm két di chúc ĐÃ HỦY**).

## Luật bất biến (chi tiết trong .claude/rules/)

1. Custody trên chuỗi — backend sập không ai mất tiền. 2. AI nhìn, không cầm — không key/không ký/không ghi.
3. Soroban KHÔNG phát được classic op — contract gate, client submit SetOptions. 4. Dữ liệu sống còn:
persistent/instance, cấm temporary. 5. Risk score chỉ trì hoãn, không bao giờ tự cancel. 6. Trạng thái online
guardian chỉ chủ ví thấy. 7. Cấm seed `S...` trong repo; cấm `--force`/`--no-verify`; migration forward-only
(ngoại lệ duy nhất: reset baseline lúc bootstrap, trước khi có dữ liệu thật); CHECK constraint thay enum;
file ≤300 dòng. *(Két di chúc đã hủy — luật "server không đọc được di chúc" chỉ hồi sinh nếu tính năng quay lại.)*

## Bản đồ code THẬT (2026-07-20 — sau bootstrap)

```
src/modules/
  wallets/       GET /api/wallets · /:id          ví Stellar của user
  guardians/     GET /api/guardians/wallet/:id    người bảo hộ (status CHECK 5 giá trị)
  presence/      GET /api/presence/guardian/:id   devices + presence_pings
  recovery/      GET /api/recovery/wallet/:id     mirror yêu cầu khôi phục on-chain
  inheritance/   GET /api/inheritance/wallet/:id  heirs (bps) + heartbeats
  indexer/       GET /api/audit/wallet/:id        audit_log append-only
  notifications/ GET /api/notifications           hộp thông báo (template_key + params)
  risk/          GET /api/risk                    rules thuần, KHÔNG bảng riêng
  realtime/      GET /api/events                  SSE — GIỮ (trạng thái guardian realtime)
  product/       KHUÔN Vertical Slice — CÒN CODE nhưng ĐÃ UNMOUNT khỏi app.ts
                 (list/get của nó không có requireAuth). Đọc làm mẫu, đừng mount lại.
src/shared-contract/   types + zod FE cần (BE là NGUỒN) — enums/api-envelope/sse
drizzle/0000_init.sql  14 bảng (9 FamilyWallet + products + 4 auth) + 9 CHECK
```

**Mọi module đều là KHUNG**: route + schema + repository + test stub, CHƯA có logic nghiệp vụ.
Query đã scope theo owner sẵn (JOIN `wallets` assert `user_id`) — giữ nguyên khi thêm logic.

## Lệnh chuẩn (repo này — mọi thứ bằng bun)

```bash
bun install && cp .env.example .env && bun run env:check
docker compose up -d        # KHÔNG kèm tên service — kèm là thiếu mailhog, email lỗi
bun run auth:generate && bun run db:migrate && bun run seed:admin
bun run dev                 # cửa sổ 1 — http://localhost:3000
bun run worker              # cửa sổ 2 — BullMQ
bun run validate            # typecheck + biome + boundaries + env-parity (KHÔNG gồm test)
bun test
```

FE chạy bằng pnpm ở repo bên kia — xem `../stellar-fe-vite/CLAUDE.md`. Wiring bắt buộc:
FE `VITE_API_URL` == BE `BETTER_AUTH_URL` (= `http://localhost:3000`), origin FE ∈ `TRUSTED_ORIGINS`.

## Skills (.claude/skills/ — đọc SKILL.md khớp việc TRƯỚC khi code)

| Việc | Skill |
|---|---|
| bootstrap từ template, dọn demo, wiring BE↔FE | fw-bootstrap-monorepo |
| passkey, WebAuthn, ký giao dịch, rpId | fw-passkey-auth |
| ping 12:00, trạng thái guardian, nối máy mới | fw-guardian-presence |
| risk engine, LLM explainer, copilot, prompt injection | fw-ai-night-watch |
| getEvents, mirror DB, thông báo, SEP-7 | fw-indexer-notify |
| contract recovery/thừa kế (repo contract riêng) | fw-soroban-contracts |
| build Android/iOS (Phase 2) | fw-capacitor-mobile |
| lên mainnet, RPC, TTL | stellar-mainnet-deploy |

*(fw-will-vault còn trên đĩa nhưng tính năng ĐÃ HỦY — đừng dựng theo nó.)*
Ngoài ra: 42 skill template (new-module, new-cron, add-sse, webhook-receiver, deploy-vps, …) vẫn nguyên giá trị.

## Agents (.claude/agents/)

`security-reviewer` trước release + sau thay đổi auth/AI · `soroban-auditor` sau mỗi thay đổi contract ·
`e2e-verifier` thu tx hash làm bằng chứng trước demo · `ux-writer` cho mọi chuỗi người dùng (chủ yếu bên FE) ·
+ 5 agent template: `code-explorer` `code-reviewer` `security-auditor` `migration-checker` `test-curler`.

## Trạng thái & bẫy hiện tại (chi tiết: PROJECT-BRIEF §4 + docs/TEMPLATE-DEVIATIONS.md)

- Recovery contract ĐÃ chạy thật trên testnet (CONTRACT_ID trong PROJECT-BRIEF) nhưng còn 3 lỗ hổng mở:
  DoS request treo · phiếu ma · collusion 2 guardian (trade-off phải disclose).
- **Cron/repeatable job template CHƯA CÓ** (`redlock.ts` mồ côi; 2 job hiện có đều theo sự kiện).
  Ping 12:00 dựng theo skill `new-cron`; queue name bắt buộc có `{ngoặc nhọn}`.
- **Webhook CHƯA nối dây** (verify.ts + captureRawBody tồn tại nhưng không route nào gọi, không bảng
  `webhook_events`) — đừng tưởng có sẵn.
- FE thiếu `.env` = trang trắng không lỗi; origin FE phải nằm trong `TRUSTED_ORIGINS` của BE.
- Fee sponsor dùng OpenZeppelin Relayer (Launchtube đã chết — cấm thêm dependency mới vào nó).

## Định nghĩa "xong"

Code chưa xong khi thiếu một trong: test pass · `bun run validate` xanh · e2e có tx hash thật (nếu chạm
chain) · chuỗi người dùng qua ux-writer · agent review tương ứng không còn P0.
