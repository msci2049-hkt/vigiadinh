# ADR 0001 — Stack choices

**Status**: Accepted (2026-05-13)

## Context

Cần stack backend cho project SMB/MVP. Yêu cầu:

- Tốc độ phát triển nhanh (founder không chuyên code)
- AI-assisted development (Claude Code)
- Production-ready từ đầu
- Chi phí vận hành thấp

## Decision

5 quyết định chính:

### 1. Runtime: Bun (không Node.js)

- 3-4x faster runtime
- Built-in TypeScript, test, bundle
- Anthropic-backed 2026 → AI-aligned
- Trade-off: ecosystem nhỏ hơn Node 13 năm

### 2. Framework: Hono (không Elysia/Express)

- Đa runtime (Bun + Node + CF Workers + Deno)
- 2M weekly downloads, pragmatic default
- Trade-off: type inference kém Elysia

### 3. ORM: Drizzle (không Prisma)

- Bundle nhỏ, edge-compatible
- Type-first, không codegen
- Trade-off: viết SQL-shaped, không abstract như Prisma

### 4. Auth: Better Auth (không NextAuth/Clerk)

- NextAuth/Auth.js đã merge vào Better Auth team 2026
- Self-hosted, no vendor lock-in
- Built-in 2FA/passkey/org
- Trade-off: ecosystem nhỏ hơn NextAuth

### 5. Cache/Queue: Dragonfly (không Redis)

- Multi-thread, throughput 10x Redis
- Drop-in compatible với BullMQ
- Setup: queue `{}` hashtag + `cluster_mode=emulated`
- Trade-off: không support Redis modules

## Consequences

**Positive**:

- Dev time: 4-5 ngày setup → 5 phút (template sẵn)
- Performance: tốt hơn Node stack
- AI workflow: Claude Code support tốt nhất với Bun

**Negative**:

- Ecosystem trẻ → ít Stack Overflow answer
- Bun có ~4700 issues mở (vs Node 1700)
- Nếu cần deploy serverless cold-start critical → cân nhắc lại

**Mitigation**:

- Theo dõi Bun changelog mỗi major
- Có fallback: Hono multi-runtime, dễ chuyển Node
- Drizzle/Better Auth/Dragonfly có alternative drop-in
