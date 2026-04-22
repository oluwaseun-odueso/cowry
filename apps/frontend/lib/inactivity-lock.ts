// Inactivity lock: dispatches a "lockSession" custom event after IDLE_MS of inactivity.
// The dashboard layout listens for this event and triggers the lock screen.

const EVENTS: (keyof WindowEventMap)[] = [
  "mousemove", "keydown", "click", "scroll", "touchstart",
];
const IDLE_MS = 5 * 60 * 1000; // 5 minutes

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function resetTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lockSession"));
    }
  }, IDLE_MS);
}

export function startInactivityLock() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  EVENTS.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
  resetTimer(); // start the clock immediately
}

export function stopInactivityLock() {
  if (!listening || typeof window === "undefined") return;
  listening = false;
  EVENTS.forEach(evt => window.removeEventListener(evt, resetTimer));
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}
