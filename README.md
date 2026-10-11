# Meal Planner

A meal planner for busy families. You enter your own meals once, and the app arranges them into:

- a **two-week rotation** with separate charts for meals at home, take-along lunches and breakfasts, printable for the fridge
- a **nightly "prep for tomorrow"** checklist (what to defrost, which lunches to pack)
- a **pantry check and shopping list** for the two-week shop, with quantities in adult and child servings
- **"Rescue me"** suggestions from your own no-prep meals when the plan falls apart

It respects meat/dairy waiting times per eater, keeps cook-fresh dishes to the day you're home, and never invents meals: it only schedules what you entered.

## Layout

| Path | What |
|---|---|
| `core/` | Rust crate with all planning logic, compiled to WebAssembly. Pure functions, no I/O. |
| `web/` | Vue 3 + Vuetify app (installable PWA). Data is stored in the browser through `web/src/storage`. |

## Development

Requirements: Rust with the `wasm32-unknown-unknown` target, [`wasm-pack`](https://github.com/rustwasm/wasm-pack), Node 22.18+ or 24.

```sh
# Build the core (re-run after changing core/)
cd core && wasm-pack build --release --target bundler --out-dir pkg --out-name meal_core

# Run the app
cd ../web && npm install && npm run dev
```

Tests: `cargo test` in `core/`, `npx vitest run` in `web/`.

## Deploying

Pushes to `main` build and deploy to GitHub Pages through `.github/workflows/ci.yml`. In the repository settings, set **Pages > Source** to **GitHub Actions** once.

See `CLAUDE.md` for the house rules.
