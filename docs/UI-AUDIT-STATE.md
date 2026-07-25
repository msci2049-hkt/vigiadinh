# UI Audit State — VíGiaĐình

## Pha hiện tại: 3/6
## Màn đã đọc: 41/41

| # | Route | File | Đọc xong | Thiếu gì | Đã vá | Commit |
|---:|---|---|:---:|---|---|---|
| 1 | `/welcome` | `fe/apps/web/src/app/routes/welcome.tsx:12` | Có | Hero PNG 427.647 B có thật nhưng thiếu `width`/`height`, chưa có WebP/AVIF; icon còn dựa Lucide | Chưa | — |
| 2 | `/get-started` | `fe/apps/web/src/app/routes/get-started.tsx:13` | Có | Không thiếu asset; icon family còn dựa Lucide | Chưa | — |
| 3 | `/passkey` | `fe/apps/web/src/app/routes/passkey.tsx:12` | Có | 3 avatar có thật nhưng `<img>` chung thiếu `width`/`height`; icon còn dựa Lucide | Chưa | — |
| 4 | `/recovery` | `fe/apps/web/src/app/routes/recovery/index.tsx:14` | Có | `loadRecoveryDraft()` dùng persisted wallet draft cần xử lý ở Pha 5B; icon còn dựa Lucide | Chưa | — |
| 5 | `/recovery/find-wallet` | `fe/apps/web/src/app/routes/recovery/find-wallet.tsx:27` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 6 | `/recovery/sent` | `fe/apps/web/src/app/routes/recovery/sent.tsx:20` | Có | Avatar thiếu kích thước nội tại; icon còn dựa Lucide | Chưa | — |
| 7 | `/recovery/progress` | `fe/apps/web/src/app/routes/recovery/progress.tsx:26` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 8 | `/recovery/countdown` | `fe/apps/web/src/app/routes/recovery/countdown.tsx:26` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 9 | `/recovery/done` | `fe/apps/web/src/app/routes/recovery/done.tsx:21` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 10 | `/setup` | `fe/apps/web/src/app/routes/_authenticated/setup/index.tsx:19` | Có | PNG 434.740 B thiếu kích thước nội tại/WebP; icon còn dựa Lucide | Chưa | — |
| 11 | `/setup/assistant` | `fe/apps/web/src/app/routes/_authenticated/setup/assistant.tsx:11` | Có | Không thiếu asset/button; đây là stub công khai “coming soon”; icon còn dựa Lucide | Chưa | — |
| 12 | `/setup/choose-guardians` | `fe/apps/web/src/app/routes/_authenticated/setup/choose-guardians.tsx:24` | Có | Nút tạo lời mời gọi mạng chỉ đổi chữ+disabled, thiếu `loading`; icon trạng thái còn dựa Lucide | Chưa | — |
| 13 | `/setup/invite` | `fe/apps/web/src/app/routes/_authenticated/setup/invite.tsx:35` | Có | Nút tạo/add guardian gọi mạng thiếu `loading`; có thể có 2+ primary khi nhiều invite deployed | Chưa | — |
| 14 | `/setup/threshold` | `fe/apps/web/src/app/routes/_authenticated/setup/threshold.tsx:30` | Có | Nút radio đang chọn và nút lưu đều primary (2 primary); icon trạng thái còn dựa Lucide | Chưa | — |
| 15 | `/setup/timelock` | `fe/apps/web/src/app/routes/_authenticated/setup/timelock.tsx:32` | Có | Nút radio đang chọn và nút lưu đều primary (2 primary); icon trạng thái còn dựa Lucide | Chưa | — |
| 16 | `/setup/review` | `fe/apps/web/src/app/routes/_authenticated/setup/review.tsx:29` | Có | Không thiếu asset/button; icon trạng thái còn dựa Lucide | Chưa | — |
| 17 | `/setup/done` | `fe/apps/web/src/app/routes/_authenticated/setup/done.tsx:12` | Có | Mascot PNG 183.685 B + avatar thiếu kích thước nội tại; PNG chưa có WebP/AVIF | Chưa | — |
| 18 | `/wallet` | `fe/apps/web/src/app/routes/_authenticated/wallet/index.tsx:46` | Có | Copy hứa balance/recent activity nhưng UI chưa có; icon còn dựa Lucide | Chưa | — |
| 19 | `/wallet/send` | `fe/apps/web/src/app/routes/_authenticated/wallet/send.tsx:82` | Có | Mascot wait PNG có thật nhưng thiếu kích thước nội tại/WebP; Android Back sẽ mất state route-local | Chưa | — |
| 20 | `/wallet/receive` | `fe/apps/web/src/app/routes/_authenticated/wallet/receive.tsx:18` | Có | Ô QR chỉ là icon placeholder, chưa sinh QR thật | Chưa | — |
| 21 | `/wallet/history` | `fe/apps/web/src/app/routes/_authenticated/wallet/history.tsx:36` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 22 | `/guardians` | `fe/apps/web/src/app/routes/_authenticated/guardians/index.tsx:22` | Có | 6 avatar có thật nhưng `<img>` thiếu kích thước nội tại | Chưa | — |
| 23 | `/guardians/$guardianId` | `fe/apps/web/src/app/routes/_authenticated/guardians/$guardianId.tsx:20` | Có | Luôn hardcode ảnh mẹ cho mọi guardian; ảnh thiếu kích thước nội tại | Chưa | — |
| 24 | `/night-watch` | `fe/apps/web/src/app/routes/_authenticated/night-watch/index.tsx:24` | Có | Nút xử lý người mất kết nối dùng `danger` dù không phá hoại; icon còn dựa Lucide | Chưa | — |
| 25 | `/night-watch/log` | `fe/apps/web/src/app/routes/_authenticated/night-watch/log.tsx:36` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 26 | `/night-watch/alert` | `fe/apps/web/src/app/routes/_authenticated/night-watch/alert.tsx:27` | Có | Avatar thiếu kích thước nội tại; action reconnect dùng `danger` sai ngữ nghĩa | Chưa | — |
| 27 | `/night-watch/resolve` | `fe/apps/web/src/app/routes/_authenticated/night-watch/resolve.tsx:16` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 28 | `/night-watch/waiting` | `fe/apps/web/src/app/routes/_authenticated/night-watch/waiting.tsx:25` | Có | Mascot PNG 189.380 B thiếu kích thước nội tại/WebP | Chưa | — |
| 29 | `/night-watch/guardian-view` | `fe/apps/web/src/app/routes/_authenticated/night-watch/guardian-view.tsx:16` | Có | Banker PNG 528.191 B thiếu kích thước nội tại/WebP | Chưa | — |
| 30 | `/guardian` | `fe/apps/web/src/app/routes/_authenticated/guardian/index.tsx:24` | Có | Mỗi card có primary nên dữ liệu nhiều tạo 2+ primary; avatar thiếu kích thước nội tại | Chưa | — |
| 31 | `/guardian/approve` | `fe/apps/web/src/app/routes/_authenticated/guardian/approve.tsx:56` | Có | Avatar hardcode/thiếu kích thước nội tại; icon còn dựa Lucide | Chưa | — |
| 32 | `/guardian/approve-warning` | `fe/apps/web/src/app/routes/_authenticated/guardian/approve-warning.tsx:24` | Có | Không thiếu asset/button; action nguy hiểm dùng danger đúng | Chưa | — |
| 33 | `/guardian/approved` | `fe/apps/web/src/app/routes/_authenticated/guardian/approved.tsx:23` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 34 | `/guardian/accept` | `fe/apps/web/src/app/routes/_authenticated/guardian/accept.tsx:28` | Có | Hai PNG thiếu kích thước nội tại/WebP; trạng thái success không có CTA thoát | Chưa | — |
| 35 | `/guardian/initiate` | `fe/apps/web/src/app/routes/_authenticated/guardian/initiate.tsx:89` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 36 | `/block` | `fe/apps/web/src/app/routes/_authenticated/block/index.tsx:31` | Có | Nút retry gọi mạng thiếu loading+disable; icon còn dựa Lucide | Chưa | — |
| 37 | `/block/confirm` | `fe/apps/web/src/app/routes/_authenticated/block/confirm.tsx:63` | Có | Không thiếu asset/button; destructive dùng danger + loading đúng | Chưa | — |
| 38 | `/block/done` | `fe/apps/web/src/app/routes/_authenticated/block/done.tsx:25` | Có | Không thiếu asset/button; icon còn dựa Lucide | Chưa | — |
| 39 | `/inheritance` | `fe/apps/web/src/app/routes/_authenticated/inheritance/index.tsx:30` | Có | Banker PNG 540.966 B + avatar thiếu kích thước nội tại/WebP | Chưa | — |
| 40 | `/inheritance/heartbeat` | `fe/apps/web/src/app/routes/_authenticated/inheritance/heartbeat.tsx:20` | Có | Không thiếu asset/button; action mạng có loading | Chưa | — |
| 41 | `/inheritance/claim` | `fe/apps/web/src/app/routes/_authenticated/inheritance/claim.tsx:41` | Có | Không thiếu asset/button; action mạng có loading | Chưa | — |

### Inventory chi tiết — màn 1–9

| Route | Ảnh (đường dẫn thật) | Icon (nguồn) | Button | Text VI dài nhất / EN dài nhất | Cao ước lượng |
|---|---|---|---|---|---:|
| `/welcome` | `public/assets/people/banker-open-left.png` (có, 427.647 B) | `shieldCheck` (`family/icon.tsx` → Lucide) | 2: primary + link; không action mạng | “Chẳng may mất điện thoại, những người bạn tin sẽ giúp bạn lấy lại.” / “If you ever lose your phone, people you trust help you get it back.” | ~720 px |
| `/get-started` | Không ảnh | `fingerprint`, `users`, `shieldCheck` (family → Lucide) | 2: primary + link; không action mạng | “Khuôn mặt hoặc vân tay thay cho một cụm từ có thể bị thất lạc.” / “Your face or fingerprint replaces a phrase you could lose.” | ~700 px |
| `/passkey` | `mom-160.webp`, `brother-160.webp`, `aunt-160.webp` (đều có) | `lock`, `users`, `fingerprint`, `shieldCheck` (family → Lucide) | 2: primary async có loading+disabled + link | “Thiết bị này chưa hỗ trợ mở khóa bằng khuôn mặt hay vân tay. Bạn vẫn có thể tiếp tục trên điện thoại khác, hoặc trình duyệt mới hơn.” / “This device is too old for face or fingerprint unlock. You can still continue on another phone, or on a newer browser.” | ~720 px |
| `/recovery` | Không ảnh | `fingerprint`, `users`, `shieldCheck` (family → Lucide) | 2–3: primary + secondary có điều kiện + link; không submit mạng | “Khi đủ người đồng ý và hết khoảng chờ, ví của bạn nghe theo chìa khóa mới. Địa chỉ giữ nguyên, tiền không di chuyển.” / “When enough of them agree and the waiting period passes, your wallet answers to the new key. Same address, nothing moves.” | ~700 px |
| `/recovery/find-wallet` | Không ảnh | `lock` (family → Lucide) | 1 primary async; có loading và tự disable khi pending | “Chưa kết nối được mạng. Chưa có gì được gửi — bạn có thể thử lại.” / “This app is not connected to the network yet. Try again later or contact support.” | ~610 px |
| `/recovery/sent` | 3 avatar WebP ở trên (đều có) | `checkCircle`, `shieldCheck` (family → Lucide) | 1 primary; navigation-only | “Gọi cho người thân và đọc mã này cho họ. Họ phải thấy ĐÚNG mã này rồi mới đồng ý.” / “Call your family members and read this code to them. They must see the exact same code before they agree.” | ~720 px |
| `/recovery/progress` | Không ảnh | `checkCircle`, `clock` (family → Lucide) | 1 primary theo trạng thái hoặc disabled; không submit mạng | “Đã đủ người đồng ý. Còn một khoảng chờ ngắn để bảo vệ ví trước khi đổi khoá.” / “Enough family members agreed. A short waiting period protects the wallet before the switch.” | ~650 px |
| `/recovery/countdown` | Không ảnh | `clock` qua `TimelockCountdown` (family → Lucide) | 2: primary có điều kiện/disabled + link | “Khoảng chờ này tồn tại để chủ ví kịp chặn khôi phục mà họ không yêu cầu. Nếu đó chính là bạn — không cần làm gì, chỉ cần chờ.” / “This waiting period exists so the wallet owner can stop a recovery they did not ask for. If that is you — do nothing, just wait.” | ~620 px |
| `/recovery/done` | Không ảnh | `checkCircle` (family → Lucide) | 1 primary; nhánh async có loading+disabled, nhánh link không async | “Ngay sau khôi phục, ví sẽ từ chối mọi thao tác trong một lúc ngắn. Đó là tính năng an toàn, không phải lỗi.” / “For a short while right after recovery, the wallet refuses every action. That is a safety feature, not an error.” | ~650 px |

### Inventory chi tiết — màn 10–17

| Route | Ảnh (đường dẫn thật) | Icon (nguồn) | Button | Text VI dài nhất / EN dài nhất | Cao ước lượng |
|---|---|---|---|---|---:|
| `/setup` | `public/assets/people/banker-present-right.png` (có, 434.740 B) | `checkCircle`, `xCircle` qua banner (family → Lucide) | 2: primary async có loading+disable + ghost | “Chọn những người thân tin cậy có thể giúp bạn lấy lại ví nếu chẳng may mất điện thoại.” / “Choose trusted people who can help you recover this wallet if you ever lose your phone.” | ~820 px |
| `/setup/assistant` | Không ảnh | `shieldCheck` (family → Lucide) | 1 primary navigation-only | “Thiết lập có người bảo hộ theo từng bước sẽ có ở bước kế. Hiện tại, hãy tạo ví — bạn có thể thêm người thân ngay sau đó.” / “Guided setup with protectors is coming next. For now, create your wallet — you can add protectors right afterward.” | ~480 px |
| `/setup/choose-guardians` | Không ảnh | `info`/`alertTriangle`/`xCircle` qua state banners (family → Lucide) | 3: secondary async thiếu spinner, outline, 1 primary | “Chọn những người bạn tin. Mỗi người nhận lời trên máy của họ, theo nhịp của họ.” / “Pick people you trust. Each one accepts on their own phone, in their own time.” | ~880 px |
| `/setup/invite` | Không ảnh | `users` + banner icons (family → Lucide) | 3+ tùy dữ liệu: create primary async thiếu loading; copy outline; mỗi add-guardian là primary async thiếu loading; done ghost | “Gửi cho mỗi người một đường dẫn. Họ nhận lời trên máy của họ — bạn rời đi rồi quay lại lúc nào cũng được.” / “Send each person a link. They accept on their own phone — you can leave and come back any time.” | ~1.020 px |
| `/setup/threshold` | Không ảnh | banner icons (family → Lucide) | 7: 5 radio (1 primary), save primary async loading, back ghost | “Nếu bạn mất điện thoại, phải có đủ bấy nhiêu người đồng ý thì ví mới mở lại.” / “{count, plural, one {# person} other {# people}} must agree before your wallet reopens.” | ~900 px |
| `/setup/timelock` | Không ảnh | banner icons (family → Lucide) | 5: 3 radio (1 primary), save primary async loading, back ghost | “Chờ lâu thì an toàn hơn — bạn có nhiều thời gian để phát hiện và chặn. Nhưng nếu bạn mất máy thật thì cũng phải chờ lâu hơn mới vào lại được.” / “Waiting longer is safer — you get more time to notice and stop it. But if you really did lose your phone, you also wait longer to get back in.” | ~820 px |
| `/setup/review` | Không ảnh | banner icons (family → Lucide) | 2: một primary theo trạng thái + ghost; register async có loading | “Chưa bật được. Chưa có gì thay đổi — bạn thử lại giúp nhé.” / “We could not turn it on. Nothing changed — please try again.” | ~850 px |
| `/setup/done` | `public/assets/mascot/mascot-wave.png` (có, 183.685 B) + 3 avatar WebP (có) | `shieldCheck` qua avatar cluster (family → Lucide) | 2: primary + ghost; navigation-only | “Tiếp theo, thêm người thân có thể giúp bạn khôi phục ví nếu mất máy — chưa thêm thì nó chạy như ví thường.” / “Next, add family members who can help you recover this wallet if you lose your phone — until you do, it works like a normal wallet.” | ~700 px |

### Inventory chi tiết — màn 18–23

| Route | Ảnh (đường dẫn thật) | Icon (nguồn) | Button | Text VI dài nhất / EN dài nhất | Cao ước lượng |
|---|---|---|---|---|---:|
| `/wallet` | Không ảnh (đúng rule: màn hằng ngày không dùng người mẫu) | `send`, `qrCode`, `history`, `moon`, `users` + banner icons (family → Lucide) | 4 link-tile, đúng 1 primary; thêm 1 primary `/setup` ở empty state | “Số dư, hoạt động gần đây và tình trạng bảo vệ trong một màn hình.” / “Balance, recent activity and protection status at a glance.” | ~900 px |
| `/wallet/send` | `public/assets/mascot/mascot-wait.png` (có) ở trạng thái chờ guardian | `fingerprint`, `checkCircle`, banner icons (family → Lucide) | Enter: 1 primary async loading; review: primary async loading + ghost disabled khi busy; unconfirmed: 1 primary navigation; không double-submit | “Vẫn chưa có kết quả. Mở Lịch sử sau ít phút để xem tiền đã đi chưa — đừng gửi lại cho tới khi chắc chắn.” / “The connection dropped right as we were sending. Your money MAY have gone through — we are checking with the network now. Do not send again.” | ~760 px |
| `/wallet/receive` | Không ảnh; ô 128×128 chỉ dùng `qrCode` placeholder | `qrCode`, `copy`/`checkCircle`, `users`/banner state (family → Lucide) | 1 primary clipboard action; không mạng | “Địa chỉ này không bao giờ đổi — kể cả sau khi khôi phục. Chia sẻ một lần rồi dùng mãi.” / “This address never changes — even after a recovery. Share it once and reuse it.” | ~640 px |
| `/wallet/history` | Không ảnh | `history`, `users`, banner icons (family → Lucide) | 0 button; danh sách chỉ đọc | “Chưa có hoạt động nào. Mọi việc xảy ra với ví sẽ hiện ở đây.” / “Nothing has happened yet. Activity on your wallet will appear here.” | ~600 px + danh sách scroll |
| `/guardians` | `public/assets/avatars/{mom,brother,aunt,uncle,sister,grandfather}-104.webp` (đều có) | `users`/banner state (family → Lucide) | 0 Button; mỗi card là link có vùng chạm ≥64 px | “Chưa có người thân nào. Mời người thân để ví có thể khôi phục nếu bạn mất máy.” / “No trusted contacts yet. Invite family so your wallet can be recovered if you ever lose this device.” | ~600 px + danh sách scroll |
| `/guardians/$guardianId` | `public/assets/avatars/mom-160.webp` (có nhưng sai mapping đối tượng) | `users`/banner state (family → Lucide) | 1 secondary navigation-only | “Lịch sử kết nối và tùy chọn cho người này.” / “Connection history and options for this person.” | ~650 px |

### Inventory chi tiết — màn 24–29

| Route | Ảnh (đường dẫn thật) | Icon (nguồn) | Button | Text VI dài nhất / EN dài nhất | Cao ước lượng |
|---|---|---|---|---|---:|
| `/night-watch` | Không ảnh | `moon`, `clock`, banner/state icons (family → Lucide) | Theo dữ liệu: danger `/block`, danger reconnect, outline guardians; destructive block dùng danger đúng, reconnect dùng danger sai | “Đã có {approvals} người thân xác nhận, cần {threshold}. Nếu không phải người thân đang giúp bạn, hãy chặn ngay.” / “{approvals, plural, one {# family confirmation} other {# family confirmations}} so far, {threshold} needed. If this is not your family helping you, block it now.” | ~900 px + card động |
| `/night-watch/log` | Không ảnh | `shieldCheck`, `users`/banner state (family → Lucide) | 0 button; danh sách chỉ đọc | “Chưa có sự kiện an toàn nào. Nếu có chuyện gì với ví, bạn sẽ thấy ở đây.” / “No safety events yet. If anything ever happens to your wallet, you'll see it here.” | ~600 px + danh sách scroll |
| `/night-watch/alert` | `public/assets/avatars/{aunt,uncle}-104.webp` (đều có) | `refresh`, state icons (family → Lucide) | 1 danger navigation-only; sai vì reconnect không phá hoại | “Những người này im ắng ở lần kiểm tra hằng ngày. Hãy giúp họ kết nối lại, hoặc thay người khác để bạn luôn đủ người.” / “These people went quiet on our daily check. Help them reconnect, or replace them so you always have enough.” | ~700 px + danh sách scroll |
| `/night-watch/resolve` | Không ảnh | `refresh`, `userPlus` (family → Lucide) | 3: primary + outline + ghost; navigation-only | “Nhắn họ mở ứng dụng này một lần — như vậy là kết nối lại tự động.” / “Message them and ask them to open this app once — that reconnects them automatically.” | ~650 px |
| `/night-watch/waiting` | `public/assets/mascot/mascot-wait.png` (có, 189.380 B) | `loader`, state icons (family → Lucide) | 1 secondary navigation-only | “Cứ để họ tự nhiên — khoảnh khắc họ mở ứng dụng, mục này tự hết.” / “Leave this with them — the moment they open the app, this clears on its own.” | ~760 px + danh sách scroll |
| `/night-watch/guardian-view` | `public/assets/people/banker-tablet.png` (có, 528.191 B) | Không icon trực tiếp; `StatusPill` dùng text+màu | 1 primary navigation-only | “Chỉ cần giữ ứng dụng trong máy — hầu hết thời gian bạn không phải làm gì cả.” / “Only the wallet owner can see this status — never other people.” | ~700 px |

### Inventory chi tiết — màn 30–35

| Route | Ảnh (đường dẫn thật) | Icon (nguồn) | Button | Text VI dài nhất / EN dài nhất | Cao ước lượng |
|---|---|---|---|---|---:|
| `/guardian` | `public/assets/avatars/brother-104.webp` (có) | `userPlus`, `users`/state icons (family → Lucide) | 1 primary trên mỗi card; có thể 2+ primary khi inbox có nhiều mục | “Có người nói họ mất quyền truy cập ví {address} và đã cài thiết bị mới. Hãy xác minh đúng là họ trước khi bắt đầu.” / “Someone says they lost access to wallet {address} and set up a new device. Verify it is really them before starting anything.” | ~600 px + danh sách scroll |
| `/guardian/approve` | `public/assets/avatars/brother-104.webp` (có) | `fingerprint`, banner/state icons (family → Lucide) | 2: primary async loading+disable + ghost disabled khi pending; empty có outline | “Đã có {approvals, plural, other {# phiếu}} trên {threshold}. Phiếu của bạn có thể là phiếu quyết định.” / “Call the person who asked for this and read the key ID to each other. If it does not match, do not agree.” | ~760 px |
| `/guardian/approve-warning` | Không ảnh | `alertTriangle`, state icons (family → Lucide) | 2: secondary quay lại + danger tiếp tục; không action mạng | “Yêu cầu này khác thường so với người đó. Nếu không đúng là họ, việc bạn đồng ý sẽ trao ví của họ cho kẻ khác. Hãy tự gọi cho họ trước — chỉ đồng ý sau khi nghe được giọng họ.” / “This request looks unusual for this person. If it isn't really them, approving hands over their wallet. Call them yourself first — approve only after you hear their voice.” | ~780 px |
| `/guardian/approved` | Không ảnh | `checkCircle` (family → Lucide) | 1 primary navigation-only | “Nếu đủ người thân đồng ý, vẫn còn một khoảng chờ để chủ ví kịp chặn lại.” / “If enough family members agree, there is still a waiting period during which the wallet owner can stop it.” | ~560 px |
| `/guardian/accept` | `mascot/mascot-wave.png`, `people/banker-open-left.png` (đều có) | `checkCircle`, `fingerprint`, state icons (family → Lucide) | Bad token: 1 secondary; accept: 1 primary async loading; success: 0 button (thiếu lối ra) | “Có thể nó đã hết hạn hoặc đã dùng rồi. Bạn nhờ họ gửi lại đường dẫn mới nhé.” / “{label} asked you to be one of the people who can help them get back into their wallet.” | ~900 px |
| `/guardian/initiate` | Không ảnh | `fingerprint`, state/banner icons (family → Lucide) | 2: primary async loading+disable + ghost disabled khi pending; empty có outline | “Gọi cho chủ ví. Nhờ họ đọc mã chìa khoá trên thiết bị mới của họ — phải TRÙNG KHỚP từng ký tự với mã này. Không khớp thì dừng lại.” / “This begins the family recovery process. Other trusted contacts still have to agree, and the wallet owner can stop it during the waiting period.” | ~740 px |

### Inventory chi tiết — màn 36–41

| Route | Ảnh (đường dẫn thật) | Icon (nguồn) | Button | Text VI dài nhất / EN dài nhất | Cao ước lượng |
|---|---|---|---|---|---:|
| `/block` | Không ảnh | `alertTriangle`, `clock`, `users`/state/banner icons (family → Lucide) | Theo trạng thái: outline retry async thiếu loading, outline back, hoặc 1 danger CTA | “Chưa kết nối được tới mạng nên chưa thể nói cho bạn biết có yêu cầu khôi phục nào đang mở hay không. Bạn thử lại giúp nhé — nếu vẫn vậy, hãy kiểm tra từ một thiết bị khác.” / “{approvals, plural, one {# family member has} other {# family members have}} agreed (needs {threshold}). When the waiting period ends, a new key takes over this wallet.” | ~800 px |
| `/block/confirm` | Không ảnh | `ban`, `fingerprint`, state/banner icons (family → Lucide) | 2: danger async loading+disable + ghost disabled khi pending | “Vân tay hoặc khuôn mặt xác nhận đúng là bạn — trước đó chưa có gì được gửi đi.” / “Your fingerprint or face confirms it is really you — nothing is sent before that.” | ~680 px |
| `/block/done` | Không ảnh | `shieldCheck` (family → Lucide) | 1 primary navigation-only | “Yêu cầu đã bị dừng. Ví của bạn vẫn an toàn.” / “Your family members have been notified automatically.” | ~540 px |
| `/inheritance` | `people/banker-seated.png` (có, 540.966 B), `avatars/{sister,brother}-104.webp` (có) | `heart`, `users`/state icons (family → Lucide) | 2: primary heartbeat + outline claim; navigation-only | “Chọn ai sẽ nhận tài sản của bạn, và mỗi người nhận bao nhiêu.” / “No one is set to receive this wallet yet. You'll be able to choose your family here.” | ~850 px + danh sách scroll |
| `/inheritance/heartbeat` | Không ảnh | `heart`, state/banner icons (family → Lucide) | 1 large primary async có loading+disable | “Thỉnh thoảng xác nhận một lần, để không có gì được trao đi khi bạn vẫn còn ở đây.” / “Confirm now and then, so nothing is passed on while you're still here.” | ~520 px |
| `/inheritance/claim` | Không ảnh | `heart`, `users`/state icons (family → Lucide) | 1 primary async có loading+disable nếu có thể reset + 1 ghost back | “Sau khi họ xin, có một cửa sổ cuối {days, plural, other {# ngày}}. Trong thời gian đó bạn vẫn huỷ được nếu là nhầm lẫn.” / “After they ask, there is a final {days, plural, one {# day} other {# days}} window. You can still cancel during that time if it was a mistake.” | ~900 px |

## Chốt Pha 1 — kiểm kê độc lập

- Router: đúng 41/41 màn trong phạm vi, tất cả đều có file và được mount; file `wallet/-send-screens.tsx`
  bị router bỏ qua có chủ ý và chỉ chứa các state con của `/wallet/send`.
- Asset trên disk: 35 file, tổng 11.974.325 B.
- Asset runtime có tham chiếu: 17 file. Không có đường dẫn raster tĩnh nào trỏ tới file không tồn tại.
- Asset không ai gọi: 18 file, 7.639.858 B:
  - 6 avatar `*-52.webp`;
  - 3 avatar `grandfather|sister|uncle-160.webp`;
  - `mascot-comfort.png`, `mascot-fingerprint.png`;
  - `banker-half-arms.png`, `banker-point-up.png`, `banker-portrait.png`, `banker-walk.png`;
  - 3 source sheet trong `public/assets/source/`.
- Có 16 thẻ `<img>` trong route/family component; 16/16 thiếu thuộc tính HTML `width`/`height`.
- 41 route có 0 import `@repo/ui`; tuy nhiên gate toàn `apps/web/src` còn fail với 25 file
  dùng `@repo/ui` (shell/auth/admin/template).
- Route có 0 inline `<svg>` và family/routes có 0 `style={{...}}`.
- Có 20 dòng khớp `<svg|<img|background-image|url(`; trong đó 16 là `<img>`, một
  `background-image` là radial-gradient, các hit `url(` còn lại thuộc Zod URL validation.
- Có 0 `dangerouslySetInnerHTML`, `eval(`, `new Function`, và 0 `100vh` trong family/routes.
- Hệ icon route tập trung qua `family/icon.tsx`, nhưng `icon.tsx` và spinner trong `ui.tsx`
  vẫn import Lucide. Có 25 tên icon family cần chuyển thành SVG nội bộ.
- Button:
  - 3 màn thiếu `loading` thật cho action mạng: `/setup/choose-guardians`,
    `/setup/invite`, `/block` (retry);
  - 0 màn thiếu `danger` cho action phá hoại hiện có;
  - 4 màn có thể có 2+ primary: `/setup/invite`, `/setup/threshold`,
    `/setup/timelock`, `/guardian`;
  - 2 màn lạm dụng danger cho action reconnect không phá hoại: `/night-watch`,
    `/night-watch/alert`;
  - trạng thái success của `/guardian/accept` không có CTA thoát.

### Nhân vật/ảnh người đang dùng

| Nhân vật | File nguồn (kích thước thật) | Màn | Kích thước render hiện tại |
|---|---|---|---|
| Banker mở tay trái | `people/banker-open-left.png` (960×1280) | `/welcome`, `/guardian/accept` | `/welcome`: 256×320 px (304×352 từ breakpoint 768); accept: cao 192 px |
| Banker trình bày | `people/banker-present-right.png` (960×1280) | `/setup` | cao 208 px |
| Banker cầm tablet | `people/banker-tablet.png` (960×1280) | `/night-watch/guardian-view` | cao 192 px |
| Banker ngồi | `people/banker-seated.png` (960×1280) | `/inheritance` | cao 192 px |
| Mascot vẫy | `mascot/mascot-wave.png` (640×640) | `/setup/done`, `/guardian/accept` success | 176×176 / 160×160 px |
| Mascot chờ | `mascot/mascot-wait.png` (640×640) | `/wallet/send` guardian wait, `/night-watch/waiting` | 176×176 / 160×160 px |
| 6 guardian avatars | `avatars/{name}-104.webp` (104×104) và 3 file `*-160.webp` (160×160) | passkey, setup done, guardian/guardians/night-watch/inheritance | 48–112 px tùy màn |

## Việc tiếp theo chính xác

1. Chuyển 25 icon family và spinner sang SVG nội bộ, xóa phụ thuộc Lucide khỏi luồng sản phẩm.
2. Bổ sung kích thước nội tại cho 16/16 thẻ ảnh và tạo biến thể WebP/AVIF phù hợp.
3. Xóa 18 asset không dùng sau khi đối chiếu lại hai chiều, sửa QR thật và mapping avatar guardian.
4. Loại `@repo/ui` khỏi toàn bộ `apps/web/src`, rồi đo lại bundle production trước/sau.

## Quyết định đã chốt (đừng quyết lại)

- Chỉ sửa mã sản phẩm trong `fe/`; không sửa nội dung `be/` hoặc `contracts/`.
- Mọi WIP có sẵn được bảo toàn riêng, không đưa vào commit UI.
- Không dùng `--no-verify`.
- HEAD đầu phiên: `0db71cd304af261736e5660df41c41f43829443d`.
- Nhánh đầu phiên thực tế: `sec/be-audit-2026-07-25` (khác `main` trong yêu cầu).
- Nhánh thực thi UI: `feat/fe-ui-assets`, tạo từ `origin/main@0db71cd`.
- 37 thay đổi `be/` đã nằm trong stash có nhãn `be-wip-2026-07-25`.
- Ba WIP root `BLOCKERS.md`, `lefthook.yml`, `pnpm-lock.yaml` đã nằm trong stash có nhãn
  `root-wip-from-be-audit-2026-07-25`.
- Gitleaks 8.30.1 sạch trên toàn lịch sử của `0db71cd`, quét bù ngày 2026-07-25:
  134 commit, khoảng 7,89 MB, 0 leak.
- Hook root dùng `node scripts/run-gitleaks.mjs protect --staged`; script tải bản chính thức
  8.30.1, kiểm SHA-256 và cache trong `.git/tools/`.
- Test hook: stage fixture seed giả rồi chạy commit thật; commit bị chặn với exit code 1.
- Router sinh đúng 41 màn trong phạm vi: 39 màn sản phẩm + `/guardian/accept` +
  `/guardian/initiate`; không có route thiếu file trong phạm vi.
- Máy dò runtime Pha 2 gắn listener trước lần `goto` đầu, không dùng `networkidle`, quét đủ
  41/41 route production build: 23 lượt ảnh decode, 68 lượt SVG, 0 response ≥400, 0 lỗi console
  cùng origin, 0 ảnh vỡ/1×1, 0 SVG rỗng và 0 lỗi font. Báo cáo ở `docs/UI-ASSET-REPORT.md`.

## Chỗ đang nghi ngờ

- `main` cục bộ ở `17f6334`, không cùng HEAD với `origin/main`; không được ghi đè nhánh cục bộ đó.
- Khi kết thúc phải khôi phục BE stash; root stash có thay đổi `lefthook.yml` trùng với hook mới nên
  cần khôi phục chọn lọc `BLOCKERS.md` và `pnpm-lock.yaml`, không ghi đè hàng rào mới.

## Nhật ký checkpoint

- 2026-07-25: Khởi tạo checkpoint trước khi thay đổi mã.
- 2026-07-25: Pha 0 hoàn tất; BE/root WIP đã cô lập, gitleaks full-history sạch, hook giả-secret
  đã chặn commit như yêu cầu.
- 2026-07-25: Đã đọc 9/41 màn (onboarding + recovery), chưa sửa UI.
- 2026-07-25: Đã đọc 17/41 màn (thêm toàn bộ setup), chưa sửa UI.
- 2026-07-25: Đã đọc 23/41 màn (thêm wallet + guardians), chưa sửa UI.
- 2026-07-25: Đã đọc 29/41 màn (thêm toàn bộ night-watch), chưa sửa UI.
- 2026-07-25: Đã đọc 35/41 màn (thêm toàn bộ guardian kể cả accept/initiate), chưa sửa UI.
- 2026-07-25: Đã đọc đủ 41/41 màn (thêm block + inheritance), chưa sửa UI.
- 2026-07-25: Pha 1 hoàn tất; kiểm kê 41 màn + 35 asset + button/icon/CSP đầy đủ, chưa sửa UI.
- 2026-07-25: Gate Pha 1 `corepack pnpm validate` xanh 11/11. Lần gọi `pnpm` 11.9.0
  của runtime trước đó fail-env vì `postcss@8.5.23` chưa đủ minimum release age; đã khôi phục
  dependency bằng đúng pnpm 9.15.9 pin trong repo, không đổi lockfile.
- 2026-07-25: Pha 2 hoàn tất; `corepack pnpm test:assets` xanh 41/41 trên Chromium production
  build. Baseline runtime sạch; các thiếu sót tĩnh (Lucide, kích thước nội tại, asset thừa,
  QR placeholder) được giữ làm đầu vào Pha 3.
- 2026-07-25: Gate Pha 2 `corepack pnpm validate` xanh 11/11; dùng Corepack shim cục bộ trong
  `.git/tools/` để Turbo gọi đúng pnpm 9.15.9 thay vì fallback pnpm 11 của runtime.
