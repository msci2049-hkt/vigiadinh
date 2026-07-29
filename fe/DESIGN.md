# Family Wallet design system

Family Wallet should feel like a calm household tool: warm, capable, and
understandable without financial or blockchain vocabulary. The visual metaphor is a
shared family notebook, not a trading terminal.

## Principles

1. **People before machinery.** Show who is involved, what will happen, and when.
2. **One clear decision.** Every flow step has one primary action and visibly
   secondary escape/help actions.
3. **Safety without fear.** Risk states use direct language and strong contrast, not
   aggressive decoration.
4. **Illustration supports text.** Images never carry identity, status, or action
   meaning alone.
5. **Stable across languages.** Components expand vertically; labels are never fixed
   to English widths.

## Color

The system has eight base colors. All cards, hover states, soft backgrounds, rings,
and dividers are derived with alpha or `color-mix()`; they are not additional base
colors.

| Token | Value | Role | Contrast on paper |
|---|---|---|---:|
| Paper | `#F7F7F2` | App background | — |
| Ink | `#151816` | Primary text, text on yellow | 16.64:1 |
| Muted ink | `#5E665F` | Secondary text | 5.52:1 |
| Family yellow | `#F3C43B` | Primary action, selected focus | Ink on yellow: 10.88:1 |
| Safe green | `#1B7555` | Positive/protected status | 5.25:1 |
| Caution ochre | `#8A5A00` | Waiting/warning status | 5.52:1 |
| Alert red | `#B42318` | Destructive/error status | 6.12:1 |
| Line | `#D7DCD5` | Borders and separators | Non-text only |

Text contrast targets are WCAG AA: 4.5:1 for normal text and 3:1 for large text.
Focus rings use a two-layer ink/yellow treatment and do not rely on color alone.

## Typography

Fraunces is reserved for brand and screen-level headings. Inter handles actions,
body content, labels, and data. JetBrains Mono is limited to wallet addresses,
codes, and other copyable identifiers.

| Token | Size | Use |
|---|---|---|
| Display | `clamp(2.75rem, 7vw, 4.5rem)` | Public hero only |
| Title | `clamp(2rem, 5vw, 2.75rem)` | Screen title |
| Subtitle | `1.25rem` | Section title / emphasized value |
| Body | `1rem` | Default copy and controls |
| Caption | `0.875rem` | Labels and supporting copy |
| Micro | `0.75rem` | Badges and compact metadata only |

Body line height is 1.6. Titles use 1.05–1.15. No meaningful label may depend on a
micro size.

## Spacing

Spacing follows a 4 px base unit:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

Controls have a minimum 48 px touch target. Cards use 20–24 px padding on mobile
and 24–32 px on larger screens. Flow stacks use 16 px between related items and
32–40 px between sections.

## Shape and depth

Three radius tokens:

- `12px` — inputs, compact controls, inner items
- `20px` — cards, panels, sheets
- `999px` — pills, avatars, circular icon buttons

Three shadow tokens:

- `soft` — low-elevation cards
- `lift` — interactive/floating navigation
- `focus` — focused/selected controls

Depth always pairs with a visible border so high-contrast and reduced-transparency
users retain the structure.

## Layout

| Layout | Maximum width | Use |
|---|---:|---|
| Focused flow | 44rem | Auth, setup, send, approve, recovery |
| Product hub | 72rem | Wallet, guardians, safety, inheritance, settings |
| Operations | 80rem | Admin dashboards and tables |

Mobile uses one content column and a bottom app navigation on signed-in hubs.
Desktop uses the same route order in a horizontal navigation rail and allows hub
cards to form two columns. The primary action remains nearest to the relevant
content, not detached in a remote toolbar.

## Navigation model

Signed-in primary destinations:

1. Wallet
2. Guardians
3. Safety
4. Settings

The active destination is expressed through icon, label, weight, border, and
`aria-current`; color is supportive. Critical flows such as approval, blocking, and
setup hide persistent navigation to reduce accidental exits.

## Components

- **Button:** primary yellow, secondary paper, quiet text, and destructive variants.
  All retain 48 px minimum height and a visible focus ring.
- **Card:** one border, paper-derived surface, 20 px radius. Nested cards use tone,
  not extra shadows.
- **Field:** persistent label, visible border, optional help/error slot, full-width
  mobile layout.
- **Status pill:** icon + text; success, warning, error, and neutral never rely on
  color alone.
- **Person portrait:** repo-owned inline SVG with a text name beside it. Decorative
  portraits use empty alt text.
- **State panel:** illustration/icon, title, concise explanation, and one next action.
- **Hard rule:** stronger ink border and lock/shield cue; communicates protection
  that cannot be casually changed.
- **Flexible preference:** lighter derived surface and sliders/tune cue; communicates
  an adjustable choice.

## Screen states

Every remote-data region must support:

1. Loading — skeleton preserves final geometry; no layout jump.
2. Error — plain-language description, retry where the existing query allows it.
3. Empty — explains why the area is empty and offers the existing safe next action.
4. Ready/success — data or confirmation with clear hierarchy.

No new API calls or workflow transitions are introduced to create these states.

## Illustration language

Illustrations use hand-drawn charcoal outlines, warm gouache fills, subtle paper
texture, and the same yellow/green/ochre/red family as the UI. Subjects are
multigenerational Vietnamese families in ordinary clothing. Exclude banker suits,
trading imagery, coins, crypto symbols, charts, national flags, brand marks, and
embedded text.

The source prompt and provenance for every generated raster asset are recorded in
`docs/ASSET-MANIFEST.md`. Repeated person identities use deterministic inline SVG
portraits so they remain crisp, fast, and consistent.

## Accessibility and motion

- Semantic landmarks and native heading order are required.
- Every icon-only control has an accessible name.
- Keyboard focus is never removed and must remain visible at 375 px and desktop.
- Dialogs and menus keep focus trapping/return behavior through their existing
  accessible primitives.
- Motion is limited to opacity and small transforms and is disabled by
  `prefers-reduced-motion`.
- Targets are at least 48 × 48 px on touch layouts.

## Content rules

User-facing copy describes familiar actions: open, send, receive, ask family,
protect, wait, approve, and check in. Avoid exposing implementation vocabulary such
as smart contract, on-chain, registry, session, cap, RPC, policy engine, or payload.
Translation keys, interpolation variables, and route behavior remain unchanged.
