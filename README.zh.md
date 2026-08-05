**[🇬🇧 English](README.md) · [🇻🇳 Tiếng Việt](README.vi.md) · [🇨🇳 中文](README.zh.md)**

<div align="center">

<img src="docs/images/banner.png" alt="FamilyHaven 欧洲虚拟家庭主视觉" width="1200">

# FamilyHaven

**无需助记词的 Stellar 智能钱包-家人就是你的恢复机制。**

*其他钱包给你十二个可能丢失的单词；这个钱包把恢复权交给你的家人。*

APAC Stellar Hackathon 2026

![Mainnet 核心](https://img.shields.io/badge/Mainnet%20%E6%A0%B8%E5%BF%83-4%20%E4%B8%AA%E5%90%88%E7%BA%A6%E5%B7%B2%E9%AA%8C%E8%AF%81-1a7f37)
![应用运行网络](https://img.shields.io/badge/%E5%BA%94%E7%94%A8%E8%BF%90%E8%A1%8C%E7%BD%91%E7%BB%9C-Stellar%20Testnet-15324a)
![Mainnet WASM](https://img.shields.io/badge/Mainnet%20WASM-5%2F5%20%E5%93%88%E5%B8%8C%E5%8C%B9%E9%85%8D-1a7f37)
![Testnet 合约](https://img.shields.io/badge/Testnet%20%E5%90%88%E7%BA%A6-5%2F5%20%E5%B7%B2%E9%AA%8C%E8%AF%81-1a7f37)
![测试](https://img.shields.io/badge/tests-976%20passing-1a7f37)
![链上限额](https://img.shields.io/badge/spending%20limits-enforced%20on--chain-f26522)
![无助记词](https://img.shields.io/badge/seed%20phrase-none-15324a)
![恢复](https://img.shields.io/badge/recovery-3%20guardians%20%C2%B7%2024h%20timelock-15324a)

**[🌐 项目主页](https://familyhavenwallet.mscilabs.com/)** · **[↗ Testnet 在线应用](https://familyhaven.mscilabs.com)** · **[◆ Mainnet 证据](https://familyhavenwallet.mscilabs.com/mainnet)** · **[↗ Testnet 链上数据](https://familyhavenwallet.mscilabs.com/traction)** · **[▶ 预告片](https://www.youtube.com/watch?v=K5jz1tClGng)** · [演示](https://youtu.be/8LUc_K2RAqY) · **[⚡ 快速开始](#快速开始)**

<a href="https://www.youtube.com/watch?v=K5jz1tClGng">
  <img src="docs/images/familyhaven-trailer.png" alt="观看 Family Haven 4K Introduction 预告片" width="1200">
</a>

## **[▶ 观看 Family Haven 4K Introduction](https://www.youtube.com/watch?v=K5jz1tClGng)**

完整产品流程：[FamilyHaven Wallet Demo Video](https://youtu.be/8LUc_K2RAqY)

欢迎 Stellar 评委-上方链接分别指向项目说明、真实 Testnet 应用、电影感预告片和完整产品演示视频。

</div>

## 链上状态

| 环境 | 当前状态 | 证据 |
|---|---|---|
| **Stellar Mainnet 核心** | 5 个 WASM 构建产物哈希匹配；4 个全局基础设施合约已部署并验证；9 笔部署交易成功 | [Mainnet 部署页](https://familyhavenwallet.mscilabs.com/mainnet) · [详细证据](docs/MAINNET-EVIDENCE.md) |
| **Stellar Testnet 应用** | Passkey 钱包、守护人设置、支出控制、转账和社会化恢复流程均可运行 | [Testnet 链上数据](https://familyhavenwallet.mscilabs.com/traction) · [打开在线应用](https://familyhaven.mscilabs.com) |

> **部署范围：** Mainnet 当前仅包含尚未接入公开应用的核心合约。公开应用、现有用户、钱包和资金仍运行在 Testnet。

## Stellar Mainnet 核心部署

> **已于 2026 年 8 月 4 日部署并验证。** 这是合约部署层面的技术进展，并不代表 Mainnet 用户采用或 TVL。

FamilyHaven 的核心 Soroban 合约已部署至 Stellar Mainnet。公开应用目前仍运行在 Testnet，并处于安全加固和分阶段生产发布阶段。

五个锁定的 WASM 构建产物已上传并完成哈希匹配。四个全局基础设施合约已部署，并按照预期的 executable hash 完成验证。

### 已验证的全局合约

| 合约 | Mainnet Contract ID | 作用 | 状态 |
|---|---|---|---|
| `origin-verifier` | [`CD2E…GQE7J`](https://stellar.expert/explorer/public/contract/CD2ESBAKCSTPUJANAYZJ5YEOMTK7GMISBRECR2RP2SWL2RSBESAGQE7J) | 验证 Passkey 身份认证所允许的 RP ID 和应用来源 | 已验证 |
| `web-auth` | [`CCKX…RU3RY`](https://stellar.expert/explorer/public/contract/CCKXCJHQ5ZINR4V7H7FTH2G4KI2FNVX4I6LHMMHIFQMKXMFTCAGRU3RY) | 验证 Web 身份认证输入 | 已验证 |
| `recovery-registry` | [`CDVX…SLJMH`](https://stellar.expert/explorer/public/contract/CDVX3E3PV4TE5HAHSFS4R3YHOB5SLCYU2KQWO5GCZDV2TPQUZ66SLJMH) | 协调守护人注册与社会化恢复 | 已验证 |
| `spending-limit-policy` | [`CAL3…TK45W`](https://stellar.expert/explorer/public/contract/CAL3TR34D6FY6ZLQNJGHLIX4LUWU277V2CHAVEUL4X2DNOJXMV6TK45W) | 强制执行单笔及滚动累计支出策略 | 已验证 |

### 仅代码形式的 Smart Account

| 项目 | 值 |
|---|---|
| Mainnet WASM 哈希 | `c1b28d42da1b7b091307c9acb0d72b88f45cc29d404b4d3c30bca0250a9d565f` |
| 部署模型 | 仅提供可复用代码；未来应用发布时才会为每位用户创建独立钱包实例 |
| 全局 Contract ID | 按设计不创建 |
| Mainnet 用户引导 | 未启用 |
| Mainnet 用户钱包 | 本次部署未创建任何用户钱包 |

`verifier-ed25519` 并非必需，因此未部署至 Mainnet。原生 XLM SAC 仅按协议推导，没有执行自定义部署。

### 部署快照

| 指标 | 结果 |
|---|---:|
| 锁定的 WASM 构建产物已存在且匹配 | **5/5** |
| 全局合约实例已部署并验证 | **4/4** |
| 成功的部署交易 | **9/9** |
| 已创建的 Mainnet 用户钱包 | **0** |
| Mainnet TVL | **0** |

此次部署包括五笔成功的 WASM 上传和四笔成功的全局实例部署。完整的交易哈希、账本编号、executable hash 与构造函数证据可在 [MAINNET-EVIDENCE.md](docs/MAINNET-EVIDENCE.md) 和 [Mainnet 部署页](https://familyhavenwallet.mscilabs.com/mainnet)中查看。

公开前端和后端在安全加固及分阶段生产发布期间继续运行于 Stellar Testnet。“已验证”仅指部署状态和 executable hash 验证，并不表示已经过独立安全审计。

## 60 秒评审

| | |
|---|---|
| **问题** | 助记词把钱包恢复压在一个脆弱的秘密上。丢失它可能永远失去访问权；分享它又可能交出整个钱包。 |
| **方案** | 由通行密钥保护的 Stellar 智能账户把签名密钥留在设备的 Secure Enclave 或 TPM 中。用户选择至少三位家人作为守护人，通过阈值投票、24 小时时间锁和所有者否决权完成恢复。 |
| **结果** | 所有者无需保存或输入十二个单词，即可使用并恢复真实的 Testnet 智能钱包。同一套锁定的核心合约构建产物现已部署至 Mainnet，为安全加固后的分阶段发布做好准备。 |
| **控制** | 产品行为已在 Testnet 上得到验证；核心基础设施已在 Mainnet 部署并完成哈希验证。不声称 Mainnet 产品流程已经运行。 |

## 产品演示流程

1. 打开[在线应用](https://familyhaven.mscilabs.com)，创建账户并注册设备通行密钥。系统不会生成助记词。
2. 添加家人作为守护人。邀请页会在登录前说明职责与风险；只有至少三把守护人密钥上链后，恢复能力才会启用。
3. 在 Stellar Testnet 上发送 XLM。日常转账遵循用户配置的软限额；策略合约记录累计支出并强制执行硬上限。
4. 从另一台设备发起恢复。守护人批准后，24 小时否决窗口仍然有效；即使应用索引器不可用，独立链上监视进程仍可发送电子邮件。
5. 最终执行会轮换智能账户签名者。旧密钥立即失效，300 秒冷却期阻止密钥变更后的抢跑交易。

本仓库**没有预先编排的演示模式**。产品流程使用真实的 Stellar Testnet 合约和交易。

## 技术上有何不同

| 能力 | 防止的问题 |
|---|---|
| 无助记词-通行密钥保存在 Secure Enclave 或 TPM | 丢失纸张，或被钓鱼网站诱导输入十二个单词 |
| 最低恢复约束在**合约内部**强制执行 | 被入侵的服务器把恢复降为一名守护人或零等待时间 |
| **两条独立警报路径**-一个进程直接读取合约，并从应用外发送电子邮件 | 攻击者只停用索引器 24 小时就让所有者收不到警报 |
| 24 小时时间锁和链上所有者否决权 | 守护人串通后立即夺取钱包 |
| 消费限额是附着在 OpenZeppelin 授权规则上的**策略合约** | 被入侵的服务器清空钱包 |
| 提高限额必须等待 24 小时 | 账户攻击者先提高上限再立即提款 |
| 不存在“发行方守护人” | 应用发行方自行恢复用户钱包 |
| 签名者轮换后冷却 300 秒 | 密钥更换后立即抢跑交易 |
| 仅追加审计日志，并在角色层撤销修改权限 | 管理员删除痕迹 |
| 邀请页在**登录前**解释职责 | 产品本身培养容易受骗的使用习惯 |
| 确定性 SQL 风险信号随守护人审批请求一同显示 | 仅凭一个 56 字符地址审批他人的大额转账 |
| 邮箱找回钱包对任何地址都返回相同的已接受响应 | 枚举注册用户，并把身份与链上余额关联起来 |

### 链上恢复不变量

这些约束由已部署合约强制执行，因此控制服务器的人也无法降低约束：

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

### 确定性风险信号

超过配置阈值的转账在交给守护人审批前，会通过确定性 SQL 查询计算三项信号-不使用模型，也不进行推测：

| 信号 | 衡量内容 |
|---|---|
| 频率 | 最近一小时的转账笔数与总金额 |
| 熟悉或陌生的收款地址 | 过去成功转账至该地址的次数 |
| 与日常支出的偏差 | 相对于 30 天平均值的比率；不足三笔交易时省略 |

这些事实让正在审批他人资金的守护人获得比一个 56 字符地址更多的判断依据。审批界面直接读取该笔转账记录中的 `policy_decision` 和 `policy_version`，不会重新评估，因此后续策略变化不能追溯性地改变已有请求所处的阈值分支。

### 转账流程

```mermaid
graph TD
    A["所有者创建转账"] --> B["确定性策略 + SQL 信号"]
    B --> C{"超过审批阈值？"}
    C -->|"否"| D["所有者签名"]
    C -->|"是"| E["awaiting_guardian"]
    E --> F["守护人查看信号并批准"]
    F --> D
    D --> G["链上策略强制执行"]
    G --> H["Stellar Testnet"]
```

低于阈值的转账直接进入所有者签名步骤。高于阈值的转账保留已记录的策略结果，等待守护人批准，然后回到同一条所有者签名和链上强制执行路径。

### 找回钱包而不暴露账户名单

丢失设备的人可能不记得 56 字符的钱包地址，但通常记得邮箱。无论邮箱是否存在，查询端点始终返回 `{"data":{"accepted":true}}`；如果存在对应钱包，系统会通过邮件发送链接。

钱包地址是链上公开数据，但邮箱到钱包的映射不是。响应时间同样由测试约束：实测差异为 **1.9 ms**（11.6 ms 对 9.7 ms），阈值为 100 ms；端点还限制为每 60 秒 5 次请求。

### 守护人恢复警报

恢复请求发起后，守护人会同时收到电子邮件和应用内实时更新。电子邮件尤其重要，因为守护人可能多日不打开应用，而这往往正是钱包所有者最需要他们的时候。

“我守护的钱包”页面显示完整的 56 字符钱包地址并提供复制按钮，守护人可将其读给丢失设备的所有者。余额和交易历史仍保持隐藏。

### 钱包恢复流程

```mermaid
graph TD
    R1["1 · 找到钱包<br/>邮箱或家人读出地址"] --> R2["2 · 通知家人<br/>电子邮件 + 实时更新"]
    R2 --> R3["3 · 语音身份核验<br/>应用之外 · 对照代码"]
    R3 --> R4["4 · 达到批准阈值<br/>24 小时时间锁"]
    R4 --> R5["5 · 所有者收到警报<br/>24 小时内可以否决"]
    classDef outside fill:#fff4cc,stroke:#b7791f,stroke-width:2px,color:#111;
    class R3 outside;
```

语音核验有意在 FamilyHaven 之外进行；显示的代码把人工核验结果绑定到预期的新密钥。达到批准阈值后，24 小时时间锁开始，所有者在此窗口内仍可否决。

## AI 助手：只做表达，不做授权

可选的语言模型只读取第 2 层的确定性结果，并将其改写成更便于年长用户理解的语言。它**不**决定转账是否继续：语言模型具有非确定性，可能遭遇提示注入；如果服务中断就让控制失效，它便会成为 fail-open 门。

这一边界由架构保证：

- 任何失败分支都返回 `null`；界面回退到**第 2 层原始数据**，批准按钮和策略控制仍可工作。
- 转账发送路径中的任何文件都不导入 AI 模块；数据只单向进入可选的解释层。
- 模型**没有工具，也没有写权限**。成功的提示注入最多生成错误句子；它不能自行获取额外数据、批准或签名。
- 设置 `AI_ADVISOR_ENABLED=false` 会移除 AI 区块，而所有保护保持有效。

模型输出必须通过确定性后置校验，否则返回 `null`：禁止“安全”“危险”“应该批准”等结论性措辞；所有数字必须与输入事实一致；检测对 system prompt 的复述；免责声明由后端追加，不依赖模型自行生成。朗读按钮使用浏览器的 Web Speech API，因此语音朗读不会把数据发送到设备之外。

### AI fail-safe

```mermaid
graph TD
    A["第 2 层原始策略数据"] --> B["可选 AI 助手"]
    B --> C{"AI 返回有效输出？"}
    C -->|"是"| D["易懂的文字说明"]
    C -->|"否 · 错误 · null"| E["第 2 层原始数据"]
    D --> F["同一个守护人批准按钮"]
    E --> F
    F --> G["确定性策略仍拥有决定权"]
```

两条分支最终都到达同一个批准控件。AI 是否可用只改变呈现方式；确定性决策路径和强制执行路径保持不变。

## 架构

```mermaid
graph TD
    T["转账或恢复请求"] --> L2["第 2 层 · 决策<br/>确定性策略 + SQL<br/>单笔 · 滚动 24 小时 · 频率 · 地址"]
    L2 --> L1["第 1 层 · 强制执行<br/>链上守护人阈值 · 24 小时时间锁 · 硬性支出上限"]
    L1 --> TN["Stellar Testnet<br/>公开应用当前运行网络"]
    L2 -.->|"只读事实"| L3["第 3 层 · 表达<br/>可选语言模型"]
    L3 --> U["易懂文字 + 浏览器语音"]
    MN["Stellar Mainnet 核心<br/>4 个已验证的全局合约<br/>仅代码形式的 Smart Account WASM"]
    MN -.->|"尚未启用分阶段生产发布"| TN
```

第 1 层是可强制执行限制的事实来源，第 2 层依据存储数据作出可复现的策略决策。第 3 层位于只读旁路，不存在返回授权路径的通道。

### 技术栈

| 层 | 组件 |
|---|---|
| 合约 | Rust · Soroban SDK 26.1.1 · OpenZeppelin `stellar-accounts =0.7.2` · `wasm32v1-none` · stellar-cli 27.0.0 · rustc 1.97.1 |
| 后端 | Bun · Hono 4.12 · Drizzle · PostgreSQL · Dragonfly · BullMQ · Better Auth 1.6 |
| 前端 | React 19 · Vite · TanStack Router/Query · 三种语言（`vi`、`en`、`zh`） |
| 部署 | Docker Compose，包含三个发布前检查和零停机发布 · Cloudflare Pages |
| 身份验证 | WebAuthn 通行密钥 · SEP-45 钱包会话 · 代码库中任何位置都没有助记词 |

## 证据，而非承诺

### Testnet 合约公开验证

StellarExpert 目前为下列五个 Testnet 合约全部返回 `validation.status = verified`：

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
| 公开验证合约 | **5/5**-三个来自 `da689235`，两个来自 `96957faa` |
| Rust 合约测试 | **82 pass** |
| 后端测试 | **566 pass**，**22 skip**；跳过项需要 `RUN_TESTNET_E2E=1` |
| 前端单元测试 | **328 pass** |
| 通过测试总数 | **976 pass** |
| 链上限额-低于阈值 | 通过，**并计入累计支出** |
| 链上限额-单笔超过阈值 | 以 `#3221` 拒绝 |
| 链上限额-多笔累计超过阈值 | 拒绝 |
| 链上限额-滚动窗口结束后 | 再次通过 |
| 对含 **15 把密钥**的钱包执行轮换 | 成功，并有账本证据 |
| 300 秒冷却期 | 窗口内阻止，边界到达时重新开放 |
| 守护人数不足 | 以 `#4` 拒绝 |
| 直接读取链上状态的恢复警报 | 从应用外发送邮件，`status=sent` |
| 未替换 i18n 占位符检查 | 已存在；含未替换占位符的构建会被拒绝 |
| 仅追加审计 | 两层：PostgreSQL 触发器和角色级权限撤销 |

测试套件共记录 **976 项通过**：合约 82 项、后端 566 项、前端 328 项。需要 `RUN_TESTNET_E2E=1` 的 22 项后端用例报告为 skip，不计入通过数。

#### 可点击验证的 Testnet 交易

| 操作 | 交易 |
|---|---|
| 将钱包注册到守护人登记表 | [`7d989c7cd38311e177230e576c59d4ba1a6bb46b4343f955ea733b6d353eae6e`](https://stellar.expert/explorer/testnet/tx/7d989c7cd38311e177230e576c59d4ba1a6bb46b4343f955ea733b6d353eae6e) |
| 守护人批准后发送超过阈值的转账 | [`36a0c44f1158c4f569c0eb591bc4e74e2494cef05a6ec28ccc8b29d820ce2973`](https://stellar.expert/explorer/testnet/tx/36a0c44f1158c4f569c0eb591bc4e74e2494cef05a6ec28ccc8b29d820ce2973) |
| 为新密钥发起社会化恢复 | [`14807debc73a5b7dbfaa6b65e69ee4900cff7660ffa0a6d1bfe1cb13c9b19d58`](https://stellar.expert/explorer/testnet/tx/14807debc73a5b7dbfaa6b65e69ee4900cff7660ffa0a6d1bfe1cb13c9b19d58) |

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
| 演示模式 | 无-使用 Testnet 账户和真实 Testnet 流程 |

## 源码地图

```text
contracts/          recovery-registry · origin-verifier · web-auth · verifier-ed25519
                    smart-account · spending-limit-policy
be/                 modules: guardians · recovery · intents · notifications · inheritance
                    jobs: recovery-watch · indexer · presence · heartbeat · sweeper
fe/apps/web/        wallet · guardians · protecting · setup wizard · settings
docs/               VERIFY-CONTRACT.md · AUDIT-TINH-NANG.md · evidence/TESTNET.md
                    MAINNET-EVIDENCE.md · INHERITANCE.md · THREAT-MODEL.md
```

## 参赛链接

| | |
|---|---|
| 🌐 项目主页 | [FamilyHaven](https://familyhavenwallet.mscilabs.com/) |
| ↗ 在线产品 | [打开 Testnet 应用](https://familyhaven.mscilabs.com) |
| ◆ Mainnet 证据 | [已验证的核心部署](https://familyhavenwallet.mscilabs.com/mainnet) |
| ↗ Testnet 链上数据 | [产品链上活动](https://familyhavenwallet.mscilabs.com/traction) |
| ▶ 预告片 | [Family Haven 4K Introduction](https://www.youtube.com/watch?v=K5jz1tClGng) |
| ▶ 演示视频 | [FamilyHaven Wallet Demo Video](https://youtu.be/8LUc_K2RAqY) |
| ⌘ 源码 | [github.com/msci2049-hkt/vigiadinh](https://github.com/msci2049-hkt/vigiadinh) |
| ✉ 联系方式 | [MSCI Labs](https://www.mscilabs.com) |

## 已知局限

| 局限 | 状态 |
|---|---|
| 守护人批准是数据库记录，**尚不是链上签名** | 被入侵的服务器可能伪造批准。已在内部发现，正在修复 |
| 通行密钥绑定域名 | 丢失域名会失去当前签名路径。CLI 恢复签名指南正在编写 |
| **尚未进行独立安全审计** | 公开应用切换至 Mainnet 前的必要条件 |
| 界面仅显示和支出 XLM | 协议层钱包可以接收任意 Stellar 资产；仍需垃圾代币过滤器 |
| 住院照护流程和按百分比分配继承 | 路线图项目，尚未实现 |
| 公开应用仍运行在 Testnet | Mainnet 核心处于待用状态；用户、钱包、资金、数据库、worker 和 indexer 均未迁移 |

## 路线图

### 大额转账审批中的应用内语音与视频核验

路线图计划：当转账超过审批阈值时，守护人可从待审批请求发起应用内语音或视频通话，同时保持收款人、金额和交易指纹可见。通话只是协调层，**不是授权因子**；确定性策略、守护人批准和所有者的加密签名仍然必不可少。该功能尚未实现。

## 团队

**[MSCI Labs](https://www.mscilabs.com)** - Vietnam

---

> **范围。** 公开的黑客松应用仍运行在 Stellar Testnet；Mainnet 上没有用户资金或生产钱包活动。待用的核心合约已部署至 Mainnet，以支持后续分阶段发布。策略阈值仅作说明，并可由用户配置。合约验证不等同于独立安全审计。不构成财务建议。
