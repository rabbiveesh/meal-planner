# Meal Planner

A family meal planner: the user enters her own meals once, and the app arranges them into a two-week rotation, a nightly prep list, a pantry-checked shopping list, and "rescue me" suggestions. Product requirements live in the project's shared files (`requirements/requirements.md`).

## Golden rule: never reinvent wheels

Kittens die when you do that. Before writing any non-trivial utility, look for a well-maintained library that already does it and use that. Hand-rolled code is only for logic that is genuinely specific to this app (the planner rules).

## Do things the right way, not the short way

The short way leads to more dead kittens. Prefer the properly typed, tested, maintainable approach even when a shortcut would work today. For example, TypeScript types for the Rust core are generated from the Rust structs (tsify), not hand-copied. Values cross the wasm boundary as typed objects (tsify `Ts<T>`), not JSON strings. CI runs the tests and lints.

## Stack

- **Core logic: Rust** (`core/`), compiled to WebAssembly with `wasm-pack`. It is pure functions over JSON: plan generation, kashrut timing checks, prep lists, shopping quantities, rescue options. No I/O, so it can be lifted directly into a future backend.
- **Frontend: Vue 3 + TypeScript SPA** (`web/`), built with Vite.
  - Component framework: **Vuetify** (mobile-first, large touch targets).
  - State: **Pinia**. Routing: **vue-router**.
  - **vite-plugin-wasm** loads the Rust core. **vite-plugin-pwa** makes it installable and offline.
- **Storage: unstorage**, behind the app's own storage module. Today it uses the localStorage driver. Moving to a backend later (planned for Fly) means swapping the driver, not rewriting callers. Keep every read and write going through that module.
- **No backend yet.** Data lives in the browser. JSON export/import is the backup.
- **Hosting: GitHub Pages**, deployed by GitHub Actions.
- **AI (Claude API): keep it to a minimum**, since every call costs money. The app never invents meals. It only schedules from meals the user entered.

## Product principles

- The app is general: eaters, waiting times, daily slots and weekly rules are all settings, never hard-coded to one family.
- Ask, don't track: there is no running pantry inventory. The app asks quick yes/no questions when it needs to know.
- Big, clear views. Nothing should feel like the crowded paper chart.

## Assume you're wrong

When you confidently assume you're right, you kill kittens. Assume you're wrong about the requirements, about how users interact with the app, and about the data model. Shape the code so that being wrong has the smallest possible blast radius. A simple change that turns into a big one also kills kittens. In practice:

- Keep modules small, with narrow interfaces, so one wrong idea is fixed in one place.
- Version stored data and migrate it explicitly, because the data model will change.
- Keep the app's UI decoupled from the planner rules and from storage.
- Prefer configuration and data over hard-coded behaviour.
- Don't embed things in the wrong place. Planner rules live in the Rust core, never in Vue components. Persistence goes only through the storage module. Household-specific facts are user data, never code. Putting something where it's convenient instead of where it belongs is a shortcut, and shortcuts kill kittens.

## Abstractions follow the data, and compose cleanly

Abstractions that aren't about the data make programming harder, not easier, and they kill kittens. So do things that don't compose cleanly. Name and shape modules after the domain data (meals, slots, cells, answers), not after generic machinery. Prefer small pure functions that take data and return data, and combine them, over frameworks, managers, wrappers or class hierarchies. If a piece can't be reused without dragging its surroundings along, it's shaped wrong.

Interfaces must not lie. A name, type or function must do exactly what it claims, no more and no less. Jumping through interfaces that pretend to be something they aren't is the worst kitten killer of all.

## Kitten death toll

Finish every piece of work (each PR, each reply that reports finished work) with a **kitten death toll**: an honest count of the shortcuts taken and wheels reinvented, with each one named, why it happened, and what would fix it. Zero is the goal. Never round down.
