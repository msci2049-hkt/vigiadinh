# FamilyWallet generated asset manifest

All assets below were generated specifically for FamilyWallet with OpenAI ImageGen on
2026-07-25. They are stored locally in `fe/apps/web/public/`; no runtime image request is
made. Production UI uses the cropped derivatives, while `assets/source/` keeps the original
contact sheets so the crop can be reproduced with `scripts/prepare-ui-assets.py`.

## Production assets

| Files | Dimensions | Usage | Prompt |
|---|---:|---|---|
| `assets/people/banker-portrait.png` | 1254×1254 | Passkey identity portrait | P2 |
| `assets/people/banker-open-left.png` | 960×1280 | Guardian invite acceptance | P2 |
| `assets/people/banker-present-right.png` | 960×1280 | Wallet setup introduction | P2 |
| `assets/people/banker-half-arms.png` | 960×1280 | Reserved editorial pose | P2 |
| `assets/people/banker-point-up.png` | 960×1280 | Reserved instructional pose | P2 |
| `assets/people/banker-seated.png` | 960×1280 | Inheritance overview | P2 |
| `assets/people/banker-walk.png` | 960×1280 | Reserved transition pose | P2 |
| `assets/people/banker-tablet.png` | 960×1280 | Guardian connection view | P2 |
| `assets/mascot/mascot-wave.png` | 640×640 | Success / welcome | P3 |
| `assets/mascot/mascot-fingerprint.png` | 640×640 | Biometric education | P3 |
| `assets/mascot/mascot-wait.png` | 640×640 | Pending / reconnecting | P3 |
| `assets/mascot/mascot-comfort.png` | 640×640 | Recovery reassurance | P3 |
| `assets/avatars/{mom,brother,aunt,uncle,sister,grandfather}-{52,104,160}.webp` | 52² / 104² / 160² | Guardian clusters, lists and details | P4 |
| `og.png` | 1731×909 | Open Graph and large social card | P5 |

## Reproducible source assets

| File | Dimensions | Derivatives |
|---|---:|---|
| `assets/source/banker-pose-sheet.png` | 1536×1024 | Seven editorial banker poses |
| `assets/source/mascot-pose-sheet.png` | 1923×818 | Four mascot states |
| `assets/source/guardian-sheet.png` | 1536×1024 | Six guardian portrait families |

## Full English prompts

### P1 — canonical banker portrait

> Create a premium editorial studio portrait for a warm family-finance product. A trustworthy
> Vietnamese woman banker in her late 30s to early 40s, shoulder-length dark hair, calm direct
> eye contact and a gentle confident smile. She wears the same elegant black tailored suit and
> ivory silk blouse in every future image. Chest-up, centered, soft natural studio light, realistic
> skin texture, refined but approachable. Plain uniform warm ivory background #FDFCF7, no office,
> no bokeh, no gradient, no props, no text, no logo, no watermark. High-resolution photorealistic
> editorial photography with clean edges suitable for a circular crop.

### P2 — locked banker pose sheet

> Create one consistent character pose sheet for FamilyWallet using the exact same Vietnamese
> woman banker: late 30s to early 40s, shoulder-length dark hair, elegant black tailored suit,
> ivory silk blouse, calm warm expression, realistic editorial photography. Eight clearly
> separated cells in a 4 by 2 grid on a single flat warm ivory #FDFCF7 background. Poses: open
> left-hand welcome, present to the right, half-body arms relaxed, point upward, friendly frontal
> portrait, seated with hands relaxed, walking with purpose, and holding a slim tablet. Keep face,
> hair, clothing, lighting and proportions identical in every cell. Full subject visible within
> each cell with generous clean margins for cropping. Soft natural studio light, premium but human.
> No text, captions, borders, office, furniture except the simple seat where required, bokeh,
> gradients, logos, watermarks, coins or crypto imagery.

### P3 — FamilyWallet mascot pose sheet

> Design a friendly flat 2D mascot pose sheet for FamilyWallet. The mascot is a small rounded
> warm-yellow guardian character with a simple black outline, tiny black eyes, subtle fingerprint
> motif on its chest and a compact shield-like silhouette. Four clearly separated poses in one
> horizontal row: waving hello, pointing to a fingerprint, waiting patiently, and offering comfort.
> Uniform 1.5 px visual stroke weight, restrained #FDDA24 yellow, #0A0A0A ink and #FDFCF7 paper
> only. Plain warm ivory background, generous space around every pose, consistent proportions and
> face. Clean vector-like product illustration, no 3D, no shadow, no gradient, no text, no logo,
> no watermark and no extra objects.

### P4 — multigenerational guardian portrait sheet

> Create a consistent contact sheet of six warm Vietnamese family guardian portraits for a secure
> family wallet app. A 3 by 2 grid with: mother in her late 50s, adult brother in his early 30s,
> aunt in her early 50s, uncle in his late 50s, adult sister in her late 20s, and grandfather in
> his early 70s. Friendly natural expressions, direct or slightly off-camera gaze, neutral cream
> clothing, realistic diverse facial features, soft natural studio light. Every subject is
> shoulders-up, centered with identical scale and enough margin for a circular crop. Flat uniform
> warm ivory #FDFCF7 background in every cell. Premium human editorial photography; no text,
> labels, borders, office, bokeh, gradients, logos, watermarks, uniforms or crypto imagery.

### P5 — social preview

> Create a polished 1200x630 social sharing hero image for “FamilyWallet”, a warm non-custodial
> family wallet product. Editorial luxury fintech art direction on warm ivory paper (#FDFCF7),
> high contrast black ink, restrained sunflower yellow (#FDDA24), subtle halftone dot clusters in
> the upper left and lower right. Show a trustworthy Vietnamese woman banker in her late 30s to
> early 40s, elegant black tailored suit and ivory blouse, warm calm expression, standing at the
> left and presenting an abstract secure wallet symbol made from a simple yellow circle and black
> fingerprint-like lines. On the right, include a close cluster of three warm multigenerational
> Vietnamese family portrait medallions (mother, adult brother, aunt), with a small yellow shield
> badge. Plenty of clean negative space, refined editorial photography mixed with minimal graphic
> design, premium but human, soft natural studio light, no crypto clichés, no coins, no gradients,
> no blue or purple, no readable text, no logos, no watermarks. Landscape composition optimized
> for Open Graph preview, safe focal content centered within margins.
