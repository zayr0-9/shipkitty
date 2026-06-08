# AGENT_DESIGN.md

## ShipKitty Website Aesthetic Lock

ShipKitty is warm, playful, trustworthy, and mascot-forward. Keep the UI feeling like a polished indie developer tool for GitHub releases: friendly enough for pets, precise enough for engineering workflows.

## Visual Direction

- Overall mood: cozy, sunny, optimistic, lightweight, and practical.
- Avoid sterile SaaS blue/gray defaults unless paired with the existing warm palette.
- Prefer soft rounded geometry, gentle depth, and confident typography.
- Mascots/pets should feel celebratory, not childish or cluttered.

## Color Palette

Use the existing warm theme as the source of truth:

- Page background: `#fffaf2` / warm cream.
- Primary text: slate near-black (`text-slate-950`).
- Body text: muted slate (`text-slate-600`, `text-slate-700`).
- Accent: amber/gold (`amber-50`, `amber-100`, `amber-200`, `amber-500`, `amber-700`, `amber-950`).
- Primary action: slate near-black button with white text.
- Success: emerald for complete/done states.
- Error: red for blocking errors only.

Do not introduce a competing primary color without a strong product reason.

## Components

### Cards

- Rounded corners: large and soft (`rounded-[1.5rem]`, `rounded-3xl`).
- Border: subtle amber border (`border-amber-200`).
- Surface: translucent/warm white (`bg-white/85`) with optional backdrop blur.
- Shadow: warm, low-opacity amber/slate shadow.

### Buttons

- Primary buttons are pill-shaped, near-black, bold, and high contrast.
- Secondary buttons use amber fills and amber/slate text.
- Hover motion should be subtle: small lift (`hover:-translate-y-0.5`).
- Disabled state should clearly reduce opacity and remove pointer intent.

### Inputs

- Inputs are rounded, warm white, amber bordered, and use amber focus rings.
- Keep large tap targets (`min-h-12` or comparable padding).
- Labels are bold slate.

### Custom Dropdowns

- Use custom menu styling for prominent selectors instead of native browser selects.
- Trigger should match inputs: rounded, amber border, white-to-amber gradient, amber focus ring.
- Options should include emoji/avatar circles, bold pet name, and muted title.
- Selected item should use amber highlight and subtle ring.
- Menus should have warm white translucent surfaces, amber borders, rounded corners, and warm shadow.

## Typography

- Headlines: very bold/black, tight tracking, compact line-height.
- Section titles: black/bold slate.
- Labels and controls: bold for scannability.
- Helper text: muted slate, concise.

## Layout

- Preserve spacious responsive grids.
- Keep the generator form and preview as the main workflow.
- On wider screens, controls can align in rows; on mobile they should stack cleanly.
- Keep content inside the `max-w-6xl` centered shell.

## Copy Tone

- Friendly, direct, and developer-aware.
- Pet language is welcome when it supports the release-notes workflow.
- Avoid over-explaining or adding noisy marketing copy.

## Guardrails

- Do not add OAuth/GitHub App flows unless the product flow calls for it.
- Keep anonymous copy-paste Markdown flow.
- Preserve the warm amber/slate/cream identity.
- Avoid broad visual rewrites; evolve the existing aesthetic consistently.
