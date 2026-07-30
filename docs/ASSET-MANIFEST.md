# Family Wallet asset manifest

Updated: 2026-07-30

All production images are local and make no runtime request to a third-party image
host. The character system uses one multigenerational European family rendered as
semi-realistic virtual humans. Flat cartoon mascots, the former illustrated family,
the former Asian social preview, and the inline cartoon guardian portraits were
removed from the production UI.

## Production assets

| File / source | Dimensions | Usage |
|---|---:|---|
| `assets/characters/european-family-hero.{webp,png}` | 1122×1402 | Welcome, invitation, setup, inheritance, and family-safety moments |
| `assets/characters/family-guide-wave.{webp,png}` | 640×640 | Completion and welcome states |
| `assets/characters/family-guide-wait.{webp,png}` | 640×640 | Waiting and guardian-approval states |
| `assets/characters/guardians/guardian-{1..6}.webp` | 256×256 | Guardian clusters, lists, and identity cards |
| `icons/icon-192.png` | 192×192 | PWA icon |
| `icons/icon-512.png` | 512×512 | PWA icon |
| `icons/apple-touch-icon.png` | 180×180 | iOS home-screen icon |
| `icons/icon-maskable-512.png` | 512×512 | Android maskable icon with a central safe-zone composition |
| `extension/icons/icon-{16,48,128}.png` | 16×16, 48×48, 128×128 | Browser-extension icons derived from the standard family app icon |
| `og.jpg` | 1920×1080 | Open Graph and Twitter preview |
| `favicon.svg` | 32×32 vector | Non-character product mark; intentionally retained |
| `components/family/illustrations.tsx` | Inline SVG | QR/product diagrams; not character art |
| `components/family/icons.tsx` | Inline SVG | UI controls; not character art |

Generator: built-in OpenAI ImageGen.

Generated source directory:
`C:\Users\huyng\.codex\generated_images\019fae5e-5c4e-7d61-9c63-3287ec508f1b`

The checked-in files were losslessly resized where required and encoded as PNG,
WebP, or JPEG with FFmpeg. The six guardian portraits were cropped from the
generated 3×2 atlas without generative alteration.

## Exact generation prompts

### Family hero

Source: `call_BIciIXHMPasZKorBXZs47mj5.png`

> Create a premium vertical 4:5 hero illustration for an international family wallet web app. Show a warm, multigenerational European family of four: a kind grandmother around 68 with silver hair, a confident mother around 45 with chestnut hair, a young adult daughter around 25 with dark-blonde hair, and a young adult son around 28 with brown hair. They stand close together with natural affectionate body language and gently hold a small elegant warm-yellow leather wallet together at the center; the wallet has one subtle embossed shield mark but absolutely no text or brand logo. Visual style: semi-realistic virtual human characters, polished high-end 3D/digital portrait rendering, believable anatomy and skin texture, expressive but restrained faces, warm and trustworthy, clearly not a flat cartoon and not a photorealistic stock photo. Wardrobe: contemporary European smart-casual clothing in cream, oatmeal, muted olive, terracotta, and soft charcoal, no patterns or logos. Background: clean warm ivory studio gradient with a very subtle paper-grain texture, soft natural shadows, ample breathing room and safe margins around all figures. Lighting: soft diffused daylight with gentle golden rim light, calm premium fintech aesthetic. Composition must remain clear when displayed in a rounded card. No words, no letters, no numbers, no charts, no coins, no cryptocurrency symbols, no extra people, no duplicate limbs, no cropped heads or feet.

### Guardian portrait atlas

Source: `call_jSkUzkvpnvvsjR58KziItIRS.png`

> Create a single square 1:1 production asset that is a perfectly aligned 3-column by 2-row portrait atlas for a premium international family wallet app. Exactly six separate European family members, one person centered in each equal rectangular cell, with no overlap between cells: top-left kind grandmother age 68 with silver bob; top-center kind grandfather age 70 with short silver hair; top-right confident mother age 45 with chestnut shoulder-length hair; bottom-left calm father age 48 with brown hair and light stubble; bottom-center friendly young adult woman age 25 with dark-blonde hair; bottom-right friendly young adult man age 28 with wavy brown hair. Every cell must use the same camera distance: front-facing head-and-shoulders avatar, eyes at the same height, full head visible with safe space above, shoulders visible, neutral warm expression, looking toward camera. Visual style: semi-realistic virtual human characters, polished high-end 3D/digital portrait rendering, believable anatomy and skin texture, clearly not a flat cartoon and not a photorealistic stock photo. Contemporary smart-casual solid-color tops in cream, warm yellow, muted olive, terracotta, navy and soft charcoal. Background in every cell is the same flat warm ivory color #F7F2E8 with soft studio lighting and gentle shadow. The grid itself has precise equal cell dimensions and clean invisible seams so CSS background-position cropping can isolate each face. Absolutely no frames, circles, borders, divider lines, text, letters, numbers, logos, jewelry logos, extra people, duplicate faces, cropped heads, hands or props.

### Welcome guide

Source: `call_ykj3LskGW2VPTZz4KMTPALSl.png`

> Using the referenced family hero only as an identity, wardrobe, lighting and visual-style reference, create a new square 1:1 standalone UI state illustration featuring only the same young adult European daughter: dark-blonde shoulder-length hair, muted olive knit top, cream trousers. She is shown from mid-thigh upward, centered, facing the viewer, giving a friendly natural wave with one hand and a calm welcoming smile. Keep believable hands and anatomy. Visual style must match the reference: semi-realistic virtual human character, polished high-end 3D/digital rendering, believable skin and fabric, clearly not a flat cartoon and not a stock-photo cutout. Background is a clean warm ivory studio gradient with subtle paper grain and one very soft golden halo, soft floor/contact shadow, generous safe margin on all sides for display inside a rounded card. No wallet, no other people, no props, no speech bubbles, no text, letters, numbers, logos, coins, charts, border or frame. Do not reproduce the whole family or the original composition; make this a clean single-character square asset.

### Waiting guide

Source: `call_JKfKBT0UYozSLaC6fpfrYSu3.png`

> Edit the referenced square character asset while preserving the exact same young European woman's identity, face, hair, muted olive knit top, cream trousers, semi-realistic virtual-human rendering, warm ivory background, lighting, camera distance and square composition. Change only her pose and expression for a calm waiting/approval state: lower the waving hand; place both hands loosely and naturally together at waist height, relaxed shoulders, small patient reassuring smile, looking toward the viewer. Add one extremely subtle soft warm-yellow circular glow behind her upper body to suggest time passing, but no clock, no icon and no prop. Keep believable hands and anatomy, clean generous safe margins, and the same high-end 3D/digital character style. Absolutely no text, letters, numbers, logos, wallet, phone, coins, charts, other people, speech bubbles, frame or border. Do not make it flat cartoon or stock-photo style.

### Standard app icon

Source: `call_FlwSamLWPXXccr4PGcQV6oa8.png`

> Using the referenced family hero as the identity and style reference, create a premium square 1:1 app icon artwork for the same international family wallet product. Show a close, compact group portrait of the same four European family members—silver-haired grandmother, chestnut-haired mother, dark-blonde young adult daughter, brown-haired young adult son—gently leaning together around a small warm-yellow leather wallet with a subtle embossed shield. Render them as polished semi-realistic virtual human characters with warm trustworthy expressions, consistent soft studio lighting, believable skin and anatomy, clearly not a flat cartoon and not a stock photograph. Icon composition: all heads, shoulders and the wallet must fit entirely inside the central 58% circular safe zone so it remains legible under Android maskable crops; generous empty padding around them. Background: rich warm-yellow to pale-gold radial gradient, with a thin soft ivory halo behind the family for separation, no hard border. Strong simple silhouette and balanced symmetry that remains recognizable at 192px. No text, letters, numbers, logos, coins, cryptocurrency symbols, charts, extra people, cropped heads, duplicate limbs or frame.

### Social preview

Source: `call_f02iasJiGEfV3nmfrWghmcgZ.png`

> Using the referenced family hero as the exact identity, wardrobe, lighting and visual-style reference, create a wide 16:9 social sharing image for the same premium international family wallet web app. Show the same four European family members—silver-haired grandmother, chestnut-haired mother, dark-blonde young adult daughter, brown-haired young adult son—grouped naturally on the right half, with the small warm-yellow leather wallet and subtle embossed shield clearly visible near the lower center-right. Render as polished semi-realistic virtual human characters with believable anatomy and warm restrained expressions, not a flat cartoon and not a stock-photo collage. Keep all heads and shoulders safely inside the frame. Leave the left 42% as clean warm ivory negative space with a subtle pale-gold radial glow and understated fine paper grain, suitable for metadata preview; do not put text there. Add only a very faint abstract shield-shaped light pattern in the far background, not a logo. Soft diffused daylight, gentle golden rim light, calm premium fintech aesthetic, balanced editorial composition. Absolutely no words, letters, numbers, brand logo, coins, cryptocurrency symbols, charts, fingerprint graphic, separate portrait bubbles, circles, borders, extra people, cropped heads or duplicate limbs.

### Maskable app icon

Source: `call_Ga6wzrE7F9qZ8U1GQxNgiuSL.png`

> Create a maskable-safe variant of the referenced square app icon while preserving the same four European family members, their identities, semi-realistic virtual-human rendering, wardrobe, expressions, warm-yellow wallet, lighting, and yellow-gold background. Recompose and scale the entire family group smaller so every head, shoulder, hand and the wallet fits completely inside the central 58% circular safe zone, with at least 22% uninterrupted warm-yellow gradient padding on every edge. The family should read as one compact centered emblem, balanced and recognizable under circular, squircle, rounded-square and teardrop Android masks. Keep the warm ivory halo directly behind the compact group, but maintain full-bleed gold background to all edges. No text, letters, numbers, logos, coins, charts, new props, extra people, cropped heads, duplicate limbs, hard border or frame. Maintain premium semi-realistic virtual character style, not flat cartoon and not stock photo.

## Removed production assets

The former `assets/illustrations/family-together.png`,
`assets/mascot/mascot-{wave,wait}.{avif,webp,png}`, and `og.png` were removed
after all runtime references were migrated. The retired files remain recoverable
from Git history.
