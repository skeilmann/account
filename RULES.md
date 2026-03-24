# Project Rules

## Code Standards
- TypeScript strict mode — no `any`, no implicit returns
- ESLint + Prettier enforced on all files
- Atomic design: atoms → molecules → organisms → pages

## Internationalization
- ALL text strings via i18n keys — no hardcoded UI strings ever
- Translation files: `/public/locales/{ro,en,it}/{common,dashboard,accounts,legislation}.json`
- Accounting terms translated carefully (not literally) — see `accounts.json`

## Money
- ALL monetary values via `<Money />` component — never format inline
- Internal storage in RON
- EUR conversion via BNR rate only

## Commits
- Convention: `feat(dashboard): add currency toggle`
- After each milestone: commit → lint → type-check → DevTools audit

## Architecture
- Next.js App Router (no pages directory)
- `"use client"` only where needed
- Zustand for client state, TanStack Query for server state
- Supabase for persistence
