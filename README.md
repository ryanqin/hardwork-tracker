# hardwork-tracker

> **苦功夫，每一分钟都算数.** The minimal, single-page version of the Mini Habits hardwork tracker — kept alive as the seed.

A small Next.js page that lets you log daily focused-work minutes across a few categories, watch the streak counter, and check the 30-day heatmap. No backend, no auth, no SaaS — opens in a browser tab and stores everything in `localStorage`.

## What this is, and what it isn't

This is the **v0** of what eventually became [the `/hardwork` module in `dashboard-me`](https://github.com/ryanqin/dashboard-me) — same Mini Habits idea (set the daily floor absurdly low, show up every day, let consistency compound), pared down to a single page.

- Want the full thing — multi-tracker timers, daily target rings, jobs pipeline, coding log, optional Oura sync, markdown reader — go look at `dashboard-me`.
- Want the seed — one page, one idea, opens-in-five-seconds, runs anywhere a browser does — that's this repo.

The seed stayed alive on purpose. The point of Mini Habits is the floor, not the dashboard. Once the floor was held, scope grew sideways into `dashboard-me`. This repo is what it looked like before that.

## What's on the page

- **Daily log** — pick a category, enter minutes, optional note
- **Today's totals** — split by category
- **Streak** — current run + all-time best
- **30-day heatmap** — calendar grid colored by daily minutes

Categories: 💻 编程 · 📚 学习 · 💪 健身 · ✍️ 写作 · ⚡ 其他.

## Tech

- Next.js 14 + TypeScript + Tailwind
- `localStorage` only — no DB, no API, no auth
- Single `app/page.tsx` (~13KB) + tracker logic in `tracker-lib.ts`

```bash
npm install
npm run dev    # http://localhost:3000
```
