---
name: vi-i18n-en-vi-zh
description: >
  i18n cho ví 3 thứ tiếng (EN chính thức, VI/ZH phụ) chạy trên 3 vỏ (web/APK/extension) + backend:
  react-i18next + i18next-icu, key ngữ nghĩa, en trong bundle chính + vi/zh lazy, luật vàng định dạng
  TIỀN (3 trục độc lập, cấm parse chuỗi đã format), font CJK, layout co giãn, metadata riêng từng vỏ
  (_locales, strings.xml, hreflang), và thông báo backend theo locale người nhận. Dùng khi: setup i18n,
  thêm ngôn ngữ, dịch chuỗi, hiển thị số tiền/ngày giờ đa locale, sửa vỡ layout tiếng Việt, hay
  localize store listing. Trigger: i18n, dịch, đa ngôn ngữ, locale, tiếng Trung, tiếng Việt, ICU,
  react-i18next, Intl.NumberFormat, currency, translation, l10n.
---

# i18n 3 thứ tiếng — EN chính thức, VI/ZH phụ, 3 vỏ + backend

Chốt: **react-i18next + i18next-icu**. Lý do thắng: một thư viện chạy web + extension + APK + **Bun/Hono
backend** (thông báo cho guardian phải render theo locale NGƯỜI NHẬN), không build step, và EN-bị-biên-tập-liên-tục
không làm rụng bản dịch. KHÔNG Lingui: macro transform phải giống hệt ở 3 build target, SWC plugin
experimental khoá version @swc/core, và mặc định lấy câu EN làm ID → sửa câu EN là vi/zh rụng.

## 1 · Luật nền — vi phạm là trả giá về sau

| # | Luật | Vì sao |
|---|---|---|
| N1 | **Key ngữ nghĩa** (`send.review.title`), cấm lấy câu EN làm key | EN là ngôn ngữ chính → bị sửa nhiều nhất; key ngữ nghĩa thì sửa EN thoải mái, vi/zh không đụng |
| N2 | `i18next` thuần nằm ở `packages/core` (BE dùng chung), `react-i18next` chỉ ở `packages/ui` | Lõi không dính React → BE render template thông báo bằng đúng catalog |
| N3 | `en` nhét bundle chính; `vi`/`zh` `import()` động khi chọn | Phần lớn người dùng không bao giờ tải 2 file kia |
| N4 | `fallbackLng: 'en'`; EN bắt buộc 100%, vi/zh 80% vẫn ship được | Thiếu key → rơi về EN, không vỡ |
| N5 | `parseMissingKeyHandler` trả EN hoặc chuỗi rỗng — **cấm để `send.review.title` hiện ra màn hình**; `saveMissing: false` ở prod | Lộ key = trông như hàng lỗi |
| N6 | Tag tiếng Trung = **`zh-Hans`** (không phải `zh-CN`) | Sau này thêm `zh-Hant` (Đài/HK) không phải đổi tên catalog |
| N7 | Bản EN là bản **có hiệu lực**: ghi rõ trong app "vi/zh là bản dịch tham khảo, lệch nhau theo bản EN" | Sản phẩm có di chúc + khuyến cáo pháp lý + policy 2 store — câu này chuẩn ngành, không phải hình thức |

Setup rút gọn:
```ts
// packages/core/i18n.ts — dùng được cả BE
import i18next from 'i18next'; import ICU from 'i18next-icu';
export const i18n = i18next.createInstance();
await i18n.use(ICU).init({
  lng: 'en', fallbackLng: 'en', supportedLngs: ['en','vi','zh-Hans'],
  resources: { en: { translation: (await import('./locales/en.json')).default } },
  interpolation: { escapeValue: false }, saveMissing: false,
  parseMissingKeyHandler: () => '',
});
export async function loadLocale(lng: 'vi'|'zh-Hans') {
  i18n.addResourceBundle(lng, 'translation', (await import(`./locales/${lng}.json`)).default);
  await i18n.changeLanguage(lng);
}
```
ICU plural: EN có `one/other`; VI và ZH chỉ có `other` — viết message ICU đủ nhánh cho EN, đừng
copy máy móc sang vi/zh rồi thắc mắc sao "1 items".

## 2 · TIỀN — luật vàng, sai là mất tiền thật chứ không xấu chữ

**Ba trục ĐỘC LẬP, cấm suy cái này từ cái kia:** ngôn ngữ UI ≠ locale định dạng số ≠ tài sản đang hiển thị.
(Người dùng UI tiếng Anh, đứng ở VN, xem số dư VND — chuyện thường.)

| Locale format | 180000000 hiển thị |
|---|---|
| `vi-VN` | `180.000.000 ₫` ← **chấm** ngăn nghìn |
| `en-US` | `₫180,000,000` |
| `zh-Hans` compact | `1.8亿` ← nhóm theo 万/亿 |

- **Cấm thư viện i18n format tiền.** Chỉ `Intl.NumberFormat(localeSốTườngMinh, {...})` ở lá cuối lúc render.
- Số on-chain giữ nguyên **BigInt string 7 chữ số thập phân** suốt pipeline; format là việc của view.
- **Cấm parse ngược chuỗi đã format.** `"180.000"` đọc bằng en-US ra 180 — và đó là lệnh chuyển tiền. Input số: ô nhập raw + hiển thị format cạnh bên, không dùng chung một chuỗi.
- Ngày giờ: `Intl.DateTimeFormat` + timezone người xem; timelock/deadline hiện **cả** đếm ngược lẫn mốc tuyệt đối.

## 3 · Chữ Hán & chữ Việt — phình font và vỡ layout

- Font CJK đầy đủ 5–15MB → **cấm webfont zh**. System stack: `"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif`.
- Co giãn: **VI dài hơn EN ~30–50%, ZH ngắn hơn ~40%.** Nút vừa khít EN sẽ vỡ ở VI. Test màn bằng chuỗi dài nhất của cả 3, không test bằng EN rồi tin.
- Dấu tiếng Việt (ế ộ ữ) **bị cắt ngọn** nếu `line-height` chặt — để ≥1.4 cho text VI, kiểm các heading font display.

## 4 · Backend — thông báo theo locale NGƯỜI NHẬN

"EN chính thức" nói về sản phẩm, không nói về bà mẹ 60 tuổi làm guardian chỉ đọc tiếng Việt.
- Bảng `users.locale` + `users.tech_level`; mọi template notify (push/email/SMS) render bằng ICU theo locale người nhận, không theo locale người gây ra sự kiện.
- AI explainer nhận `locale + tech_level` → cùng một sự kiện, mỗi guardian một bản giải thích — đây là giá trị AI tầm quốc tế của dự án, giữ nguyên.
- Không nhét secret/URL lạ vào notification (luật chung skill security).

## 5 · Metadata riêng từng vỏ — catalog JS không với tới

| Vỏ | Chỗ | Ai đọc |
|---|---|---|
| Extension | `_locales/en\|vi\|zh_CN/messages.json` + `default_locale` (⚠️ Chrome dùng `zh_CN`, khác tag `zh-Hans` trong app — map một chỗ, ghi chú rõ) | Chrome Web Store listing + tên/mô tả |
| APK | `values/`, `values-vi/`, `values-zh-rCN/strings.xml` | Tên app, text xin quyền, Play listing |
| Web | `<html lang>`, `hreflang`, `og:locale` | SEO, share preview |

Mỗi chỗ chỉ ~5 chuỗi nhưng quên là listing lên store toàn tiếng Anh. Cho vào checklist phát hành.

## 6 · Quy trình dịch

1. Key mới → viết EN trước (bắt buộc), vi/zh để trống → CI check EN 100%, in báo cáo % vi/zh.
2. Chuỗi pháp lý/di chúc/cảnh báo rủi ro: dịch người thật duyệt, không máy — đây là chuỗi có hậu quả.
3. Chuỗi nhạy: tên riêng giữ nguyên (`VíGiaĐình` không dịch), đơn vị tiền theo asset không theo UI.

## Cổng nghiệm thu cứng
1. Đổi ngôn ngữ runtime cả 3 vỏ không reload trắng. 2. Xoá 1 key vi → màn hiện EN, không hiện key. 3. Nhập "1.000" ở UI vi ra đúng một nghìn, mọi locale. 4. Màn dài nhất không vỡ ở cả 3 tiếng (chụp 3 ảnh). 5. `_locales` + `strings.xml` + `hreflang` đủ 3 tiếng. 6. Notify cho guardian locale vi tới bằng tiếng Việt dù chủ ví dùng EN.
