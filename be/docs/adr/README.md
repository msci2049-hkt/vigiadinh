# Architecture Decision Records (ADR)

Mỗi quyết định kỹ thuật quan trọng → ghi vào 1 file ADR riêng.

## Format

File: `NNNN-tieu-de-ngan.md` (NNNN = 4-digit số tăng dần).

Structure:

- **Status**: `Proposed` / `Accepted` / `Deprecated` / `Superseded by ADR-XXXX`
- **Context**: vấn đề gì, ràng buộc gì
- **Decision**: chọn gì, làm thế nào
- **Consequences**: lợi gì, hại gì, đánh đổi gì

## Index

| ID | Title | Status | Date |
|---|---|---|---|
| [0001](./0001-stack-choices.md) | Stack choices (Bun, Hono, Drizzle, Better Auth, Dragonfly) | Accepted | 2026-05-13 |

## Khi nào thêm ADR

- Đổi runtime/framework/ORM
- Đổi data store (Postgres → MySQL, Redis → Dragonfly...)
- Đổi auth/payment provider
- Thay đổi pattern coding cốt lõi (vd: chuyển từ Redlock → DB advisory lock)
- Quyết định ảnh hưởng > 1 module
