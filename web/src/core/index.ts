// The app's only entry point into the Rust planning core (../../core).
// Components and stores import from here, never from 'meal-core' directly,
// so the core can be wrapped, mocked or moved behind a server without touching callers.
export * from 'meal-core'
