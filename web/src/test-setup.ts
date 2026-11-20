// Global test setup, loaded through `setupFiles` in vitest.config.ts.
import '@testing-library/jest-dom/vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import type confetti from 'canvas-confetti'
import { afterEach, vi } from 'vitest'

// jsdom lacks a few browser APIs that Vuetify uses.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// Vuetify overlays (dialogs, snackbars) position against the visual viewport.
// Sized like jsdom's window (1024x768).
globalThis.visualViewport ??= Object.assign(new EventTarget(), {
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
  onresize: null,
  onscroll: null,
  onscrollend: null,
}) as VisualViewport

// Nobody is signed in during tests: the app keeps its data on the phone (in memory).
vi.mock('@/account', () => ({
  watchAccount: (onChange: (account: null) => void) => {
    onChange(null)
    return () => {}
  },
  signInWithGoogle: vi.fn<() => Promise<void>>(),
  signOutOfAccount: vi.fn<() => Promise<void>>(),
}))

// canvas-confetti draws on a canvas, which jsdom can't render; tests check its calls instead.
vi.mock('canvas-confetti', () => ({ default: vi.fn<typeof confetti>() }))

// Unmount whatever a test mounted, then drop what Vuetify left in the body
// (the overlay container that dialogs teleport into).
enableAutoUnmount(afterEach)
afterEach(() => {
  // Tests in the node environment (the storage driver's) have no document.
  if (typeof document !== 'undefined') document.body.innerHTML = ''
})
