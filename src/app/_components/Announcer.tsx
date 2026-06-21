"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Global aria-live announcer. Parse results, save
 * confirmations, errors, and unit/factor-set changes are announced via an
 * aria-live region. Components call `announce(message)` and the shared
 * polite/assertive live regions in the app shell read it.
 *
 * Screens that are tested in isolation (without the shell provider) fall back to
 * a no-op announce so they never crash; the live region is still always present
 * in the running app via <AnnouncerProvider> in AppShell.
 */

type Politeness = "polite" | "assertive";

interface AnnouncerApi {
  announce: (message: string, politeness?: Politeness) => void;
}

const AnnouncerContext = createContext<AnnouncerApi>({
  announce: () => {},
});

export function useAnnouncer(): AnnouncerApi {
  return useContext(AnnouncerContext);
}

export function AnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const toggle = useRef(false);

  const announce = useCallback(
    (message: string, politeness: Politeness = "polite") => {
      // Toggle a zero-width space so re-announcing the identical string still
      // fires the live region (some SRs ignore unchanged text content).
      toggle.current = !toggle.current;
      const payload = toggle.current ? message : `${message}​`;
      if (politeness === "assertive") {
        setAssertive(payload);
      } else {
        setPolite(payload);
      }
    },
    [],
  );

  const api = useMemo<AnnouncerApi>(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-region-polite"
      >
        {polite}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
        data-testid="live-region-assertive"
      >
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}
