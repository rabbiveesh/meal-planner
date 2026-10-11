// Global test setup, loaded through `setupFiles` in vitest.config.ts.
import '@testing-library/jest-dom/vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach } from 'vitest'

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

// Unmount whatever a test mounted, then drop what Vuetify left in the body
// (the overlay container that dialogs teleport into).
enableAutoUnmount(afterEach)
afterEach(() => {
  document.body.innerHTML = ''
})
