# Family Wallet asset manifest

Updated: 2026-07-29

All production assets are local. The app makes no runtime image request. People
photography and cropped photo avatars were removed from production UI and replaced
with an original illustration plus repo-owned inline SVG portraits.

## Production assets

| File / source | Dimensions | Usage | Provenance |
|---|---:|---|---|
| `assets/illustrations/family-together.png` | 1122×1402 | Welcome, invitation, setup, inheritance, and family-safety moments | P6 |
| `assets/mascot/mascot-wave.{avif,webp,png}` | 640×640 | Friendly completion states | Existing P3 |
| `assets/mascot/mascot-fingerprint.{avif,webp,png}` | 640×640 | Biometric education | Existing P3 |
| `assets/mascot/mascot-wait.{avif,webp,png}` | 640×640 | Waiting states | Existing P3 |
| `components/family/guardian-portrait.tsx` | Inline SVG | Guardian clusters, lists, and identities | Hand-authored repo asset |
| `components/family/illustrations.tsx` | Inline SVG | QR and product state diagrams | Hand-authored repo asset |
| `components/family/icons.tsx` | Inline SVG | Product icons | Hand-authored repo asset |
| `og.png` | 1731×909 | Existing social preview | Existing P5 |

## P6 — original family scene

Generator: OpenAI ImageGen
Generated: 2026-07-29
Source artifact:
`C:\Users\huyng\.codex\generated_images\019fae5e-5c4e-7d61-9c63-3287ec508f1b\call_ks6DzbE2lhYatoj5FkEkC4Lp.png`

Final prompt:

> Create an original hero illustration for a family wallet product, using the
> attached mascot only as a style reference for warm ink outlines and gentle
> gouache texture. Show a multigenerational Vietnamese family of four — grandmother,
> mother, young adult woman, and adult brother — standing close together around one
> small warm-yellow wallet, with relaxed, trusting expressions and ordinary modern
> clothing. Portrait 4:5 composition with generous ivory-paper negative space.
> Charcoal ink, family yellow, muted sage, and soft clay accents. Hand-drawn,
> editorial storybook finish; approachable and premium, never childish. No text,
> logo, watermark, banker suit, office, coin, crypto symbol, chart, national flag,
> stock-photo lighting, or extra people.

## Removed production assets

The following tracked files were removed after the source scan confirmed there were
no remaining runtime references:

- `assets/people/banker-open-left.*`
- `assets/people/banker-present-right.*`
- `assets/people/banker-seated.*`
- `assets/people/banker-tablet.*`
- `assets/avatars/{aunt,brother,grandfather,mom,sister,uncle}-*.*`

They remain recoverable from Git history. Older source/contact-sheet files outside
the production paths are retained only for audit history and are not shipped or
referenced by the app.
