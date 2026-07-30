**[🇬🇧 English](README.md) · [🇻🇳 Tiếng Việt](README.vi.md) · [🇨🇳 中文](README.zh.md)**

<div align="center">

<img src="docs/images/banner.png" alt="FamilyHaven 欧洲虚拟家庭主视觉" width="1200">

# FamilyHaven

**无需助记词的 Stellar 智能钱包——家人就是你的恢复机制。**

*其他钱包给你十二个可能丢失的单词；这个钱包把恢复权交给你的家人。*

Stellar APAC Hackathon 2026

![合约已验证](https://img.shields.io/badge/contracts-5%2F5%20verified-1a7f37)
![测试](https://img.shields.io/badge/tests-600%2B%20passing-1a7f37)
![链上限额](https://img.shields.io/badge/spending%20limits-enforced%20on--chain-f26522)
![无助记词](https://img.shields.io/badge/seed%20phrase-none-15324a)
![网络](https://img.shields.io/badge/network-Stellar%20Testnet-15324a)
![恢复](https://img.shields.io/badge/recovery-3%20guardians%20%C2%B7%2024h%20timelock-15324a)

**[🌐 项目主页](https://familyhavenwallet.mscilabs.com/)** · **[↗ 在线应用](https://familyhaven.mscilabs.com)** · **[▶ 预告片](https://www.youtube.com/watch?v=K5jz1tClGng)** · **[⚡ 快速开始](#快速开始)**

<img src="docs/images/welcome-judges.png" alt="欢迎 Stellar 评委的欧洲虚拟家庭" width="900">

欢迎 Stellar 评委——上方链接分别指向项目说明、真实 Testnet 应用和两分钟产品预告片。

</div>

## 60 秒评审

| | |
|---|---|
| **问题** | 助记词把钱包恢复压在一个脆弱的秘密上。丢失它可能永远失去访问权；分享它又可能交出整个钱包。 |
| **方案** | 由通行密钥保护的 Stellar 智能账户把签名密钥留在设备的 Secure Enclave 或 TPM 中。用户选择至少三位家人作为守护人，通过阈值投票、24 小时时间锁和所有者否决权完成恢复。 |
| **结果** | 所有者无需保存或输入十二个单词，即可使用并恢复真实的 Testnet 智能钱包。独立的链上监视进程能在恢复启动时从应用外部发送警报。 |
| **控制** | 最少守护人数、阈值、时间锁、密钥轮换冷却期和消费上限均由链上逻辑强制执行。StellarExpert 可公开检查合约源码重建结果。 |

## 两分钟演示

1. 打开[在线应用](https://familyhaven.mscilabs.com)，创建账户并注册设备通行密钥。系统不会生成助记词。
2. 添加家人作为守护人。邀请页会在登录前说明职责与风险；只有至少三把守护人密钥上链后，恢复能力才会启用。
3. 在 Stellar Testnet 上发送 XLM。日常转账遵循用户配置的软限额；策略合约记录累计支出并强制执行硬上限。
4. 从另一台设备发起恢复。守护人批准后，24 小时否决窗口仍然有效；即使应用索引器不可用，独立链上监视进程仍可发送电子邮件。
5. 最终执行会轮换智能账户签名者。旧密钥立即失效，300 秒冷却期阻止密钥变更后的抢跑交易。

本仓库**没有预先编排的演示模式**。产品流程使用真实的 Stellar Testnet 合约和交易。

## 技术上有何不同

| 能力 | 防止的问题 |
|---|---|
| 无助记词——通行密钥保存在 Secure Enclave 或 TPM | 丢失纸张，或被钓鱼网站诱导输入十二个单词 |
| 最低恢复约束在**合约内部**强制执行 | 被入侵的服务器把恢复降为一名守护人或零等待时间 |
| **两条独立警报路径**——一个进程直接读取合约，并从应用外发送电子邮件 | 攻击者只停用索引器 24 小时就让所有者收不到警报 |
| 24 小时时间锁和链上所有者否决权 | 守护人串通后立即夺取钱包 |
| 消费限额是附着在 OpenZeppelin 授权规则上的**策略合约** | 被入侵的服务器清空钱包 |
| 提高限额必须等待 24 小时 | 账户攻击者先提高上限再立即提款 |
| 不存在“发行方守护人” | 应用发行方自行恢复用户钱包 |
| 签名者轮换后冷却 300 秒 | 密钥更换后立即抢跑交易 |
| 仅追加审计日志，并在角色层撤销修改权限 | 管理员删除痕迹 |
| 邀请页在**登录前**解释职责 | 产品本身培养容易受骗的使用习惯 |

### 链上恢复不变量

这些约束曾仅由服务器检查。一次内部复核后，它们被下移到合约中，因此控制服务器的人也无法降低约束：

| 不变量 | 强制值 | 合约结果 |
|---|---:|---|
| `MIN_GUARDIANS` | `3` | 违反时 panic `#4` |
| `MIN_THRESHOLD` | `2` | 违反时 panic `#3` |
| `MIN_TIMELOCK_SECS` | `86,400` | 违反时 panic `#17` |
| 轮换后冷却期 | `300s` | 生效期间返回代码 `#101` |

### 消费策略

| 控制层 | 产品显示的默认值 | 变更控制 |
|---|---:|---|
| 单笔软限额，用户可配置 | `1,000 XLM` | 降低限额立即生效 |
| 滚动 24 小时软限额，用户可配置 | `10,000 XLM` | 提高限额等待 24 小时、向所有者发邮件，并可取消 |
| 链上硬上限 | `20,000 XLM` | 服务器无法绕过 |

## 架构

<img src="docs/images/architecture.png" alt="FamilyHaven 四层架构：设备、界面、编排和链上合约" width="1200">

```text
家庭成员（浏览器，无需安装应用）
      │
 通行密钥 ── Secure Enclave / TPM · 密钥永不离开设备
      │
 SEP-45 钱包会话 ── 与应用登录会话分离
      │
┌────────────────────────── 链上（事实来源）───────────────────────────────────────┐
│  smart-account (OZ stellar-accounts)                                             │
│    __check_auth ── 轮换冷却 → 上下文规则 → policy.enforce()                      │
│         ├── rule 0（默认） + spending-limit policy                               │
│         └── rule 1（所有者）+ spending-limit policy                              │
│  recovery-registry ── MIN_GUARDIANS 3 · THRESHOLD 2 · TIMELOCK 24h · 否决        │
│  origin-verifier ── 部署时固定通行密钥来源允许列表                                │
└──────────────────────────────────────────────────────────────────────────────────┘
      │                                        │
 索引器（Postgres 镜像）             recovery-watch ── 直接读取链上状态
      │                                        │
 应用内警报                           应用外电子邮件
                                      （即使本系统中断仍可工作）
```

### 技术栈

| 层 | 组件 |
|---|---|
| 合约 | Rust · Soroban SDK 26.1.1 · OpenZeppelin `stellar-accounts =0.7.2` · `wasm32v1-none` · stellar-cli 27.0.0 · rustc 1.97.1 |
| 后端 | Bun · Hono 4.12 · Drizzle · PostgreSQL · Dragonfly · BullMQ · Better Auth 1.6 |
| 前端 | React 19 · Vite · TanStack Router/Query · 三种语言（`vi`、`en`、`zh`） |
| 部署 | Docker Compose，包含三个发布前检查和零停机发布 · Cloudflare Pages |
| 身份验证 | WebAuthn 通行密钥 · SEP-45 钱包会话 · 代码库中任何位置都没有助记词 |

## 证据，而非承诺

### 公开合约验证

StellarExpert 目前为五个已部署合约全部返回 `validation.status = verified`：

| 合约 | Stellar Testnet ID | 状态 | 已验证源码 |
|---|---|---|---|
| `recovery-registry` | [`CDGB…4JIR`](https://stellar.expert/explorer/testnet/contract/CDGBHEXSPNO4CJHYSSV4FZBN3C7XXQOPZPDATR65SH5QHRCDB2WL4JIR) | **verified** | [`da689235`](https://github.com/msci2049-hkt/vigiadinh/commit/da6892353e8b2076508e866efe9e1d13a7264ed4) |
| `origin-verifier` | [`CBFC…VVGW`](https://stellar.expert/explorer/testnet/contract/CBFCNHIOQN3N5IVSIVW4TTKYXZ73YQI4DZPADC6UCWF2XU35W4GVVWGW) | **verified** | [`da689235`](https://github.com/msci2049-hkt/vigiadinh/commit/da6892353e8b2076508e866efe9e1d13a7264ed4) |
| `web-auth`（SEP-45） | [`CBWM…JBWD`](https://stellar.expert/explorer/testnet/contract/CBWMHVEEXEOSOSWULYNYN62EYVMWJT55NKRPUI2MXSYHVVZ6NIMRJBWD) | **verified** | [`da689235`](https://github.com/msci2049-hkt/vigiadinh/commit/da6892353e8b2076508e866efe9e1d13a7264ed4) |
| `verifier-ed25519` | [`CC7L…VDEE`](https://stellar.expert/explorer/testnet/contract/CC7L7IGJ7ZBUQCYUTV6J6KLKMKYKAZIV5FMRISPNIZZW63664TWOVDEE) | **verified** | [`96957faa`](https://github.com/msci2049-hkt/vigiadinh/commit/96957faa46230744a56f90655b7994ff045c4844) |
| `spending-limit-policy` | [`CCIN…FJZK`](https://stellar.expert/explorer/testnet/contract/CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK) | **verified** | [`96957faa`](https://github.com/msci2049-hkt/vigiadinh/commit/96957faa46230744a56f90655b7994ff045c4844) |

验证表示从所链接的公开源码重建后，哈希与链上代码一致。它**不是**独立安全审计。

| 其他部署标识 | 值 |
|---|---|
| 网络 | **Stellar Testnet** |
| Smart-account WASM | `c1b28d42da1b7b091307c9acb0d72b88f45cc29d404b4d3c30bca0250a9d565f` |
| 固定原生 SAC | [`CDLZ…CYSC`](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

### 可复现检查与交易证据

| 质量门 | 结果 |
|---|---|
| 公开验证合约 | **5/5**——三个来自 `da689235`，两个来自 `96957faa` |
| Rust 合约测试 | **82 pass** |
| 当前 Windows 全量后端测试 | **457 pass**，22 项因环境要求跳过；一个 Bash 备份保留测试因临时路径跨越 Windows/Bash 边界而失败 |
| 前端单元测试 | **209 pass** |
| 链上限额——低于阈值 | 通过，**并计入累计支出** |
| 链上限额——单笔超过阈值 | 以 `#3221` 拒绝 |
| 链上限额——多笔累计超过阈值 | 拒绝 |
| 链上限额——滚动窗口结束后 | 再次通过 |
| 对含 **15 把密钥**的钱包执行轮换 | 成功，并有账本证据 |
| 300 秒冷却期 | 窗口内阻止，边界到达时重新开放 |
| 守护人数不足 | 以 `#4` 拒绝 |
| 直接读取链上状态的恢复警报 | 从应用外发送邮件，`status=sent` |
| 未替换 i18n 占位符检查 | 已存在；可捕获曾两次漏过的回归 |
| 仅追加审计 | 两层：PostgreSQL 触发器和角色级权限撤销 |

徽章写“600+ passing”，因为最新记录的合约、后端和前端套件共有 **748 项通过测试**。需要 Testnet 或 Dragonfly 环境的项目单独报告为跳过，不会被当作通过。

## 快速开始

```bash
git clone https://github.com/msci2049-hkt/vigiadinh.git
cd vigiadinh

# 合约
cd contracts && cargo test --workspace && stellar contract build

# 后端 (:3000)
cd ../be && cp .env.example .env
# 填写 DATABASE_URL、REDIS_URL、RESEND_API_KEY 和合约 ID。
bun install && bun run validate && bun test

# 前端 (:5173)
cd ../fe && pnpm install && pnpm validate && pnpm test && pnpm dev
```

本源码树**没有预先编排的演示模式**。运行时流程连接 Stellar Testnet。

## 演示访问

| | |
|---|---|
| 项目主页 | [familyhavenwallet.mscilabs.com](https://familyhavenwallet.mscilabs.com/) |
| 在线产品 | [familyhaven.mscilabs.com](https://familyhaven.mscilabs.com) |
| 网络 | **Stellar Testnet** |
| 演示模式 | 无——使用 Testnet 账户和真实 Testnet 流程 |

## 源码地图

```text
contracts/          recovery-registry · origin-verifier · web-auth · verifier-ed25519
                    smart-account · spending-limit-policy
be/                 modules: guardians · recovery · intents · notifications · inheritance
                    jobs: recovery-watch · indexer · presence · heartbeat · sweeper
fe/apps/web/        wallet · guardians · protecting · setup wizard · settings
docs/               VERIFY-CONTRACT.md · AUDIT-TINH-NANG.md · evidence/TESTNET.md
                    INHERITANCE.md · SEND-ADDRESSES.md · THREAT-MODEL.md
```

## 参赛链接

| | |
|---|---|
| 🌐 项目主页 | [FamilyHaven](https://familyhavenwallet.mscilabs.com/) |
| ↗ 在线产品 | [打开 Testnet 应用](https://familyhaven.mscilabs.com) |
| ▶ 预告片 | [Family Haven 4K Introduction](https://www.youtube.com/watch?v=K5jz1tClGng) |
| ⌘ 源码 | [github.com/msci2049-hkt/vigiadinh](https://github.com/msci2049-hkt/vigiadinh) |
| ✉ 联系方式 | [MSCI Labs](https://www.mscilabs.com) |

## 已知局限

| 局限 | 状态 |
|---|---|
| 守护人批准是数据库记录，**尚不是链上签名** | 被入侵的服务器可能伪造批准。已在内部发现，正在修复 |
| 通行密钥绑定域名 | 丢失域名会失去当前签名路径。CLI 恢复签名指南正在编写 |
| **尚未进行独立安全审计** | 主网上线前的必要条件 |
| 界面仅显示和支出 XLM | 协议层钱包可以接收任意 Stellar 资产；仍需垃圾代币过滤器 |
| 住院照护流程和按百分比分配继承 | 路线图项目，尚未实现 |
| 仅限 Testnet | 原型阶段的有意选择；见范围说明 |

## 团队

**[MSCI Labs](https://www.mscilabs.com)** — Vietnam · Singapore · Thailand · India

---

> **范围。** 在 Stellar Testnet 上运行的黑客松原型。不使用真实资金。策略阈值仅作说明，并可由用户配置。合约验证只确认已发布源码与链上字节码一致——它不是独立安全审计。不构成财务建议。
