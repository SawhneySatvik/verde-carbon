// jsdom test setup for the App-Router component suite (the "ui" project).
// Adds jest-dom matchers and a few jsdom shims the design system relies on
// (matchMedia for prefers-reduced-motion, scrollIntoView for focus management).
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia; components query prefers-reduced-motion
// and prefers-color-scheme. Default every query to "no match" (motion on).
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

// jsdom does not implement scrollIntoView; focus-management code calls it.
if (typeof window !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom does not implement PointerEvent. Motion's keyboard-activation path
// (which makes `whileTap` press feedback fire for keyboard users on m.* buttons)
// dispatches a synthetic PointerEvent; without this polyfill that surfaces as an
// unhandled error in tests. Map it onto MouseEvent — enough for dispatch.
if (
  typeof window !== "undefined" &&
  typeof window.PointerEvent === "undefined"
) {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "";
      this.isPrimary = params.isPrimary ?? false;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  globalThis.PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
}
