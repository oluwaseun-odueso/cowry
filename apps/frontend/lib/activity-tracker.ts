// Activity tracker: listens for user events and triggers proactive token refresh
// when the token is close to expiry, keeping the session alive for active users.

import { refreshAccessToken } from "./api";

const EVENTS: (keyof WindowEventMap)[] = [
  "mousemove", "keydown", "click", "scroll", "touchstart",
];
const THROTTLE_MS = 5 * 60 * 1000; // fire at most once per 5 minutes
const EARLY_REFRESH_THRESHOLD_SECONDS = 10 * 60; // refresh if < 10 min remaining

let lastFired = 0;
let listening = false;

function getTokenRemainingSeconds(): number {
  if (typeof window === "undefined") return Infinity;
  const token = localStorage.getItem("accessToken");
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp - Date.now() / 1000;
  } catch {
    return 0;
  }
}

function onActivity() {
  const now = Date.now();
  if (now - lastFired < THROTTLE_MS) return;
  lastFired = now;
  if (getTokenRemainingSeconds() < EARLY_REFRESH_THRESHOLD_SECONDS) {
    refreshAccessToken().catch(() => {});
  }
}

export function startActivityTracker() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  EVENTS.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
}

export function stopActivityTracker() {
  if (!listening || typeof window === "undefined") return;
  listening = false;
  EVENTS.forEach(evt => window.removeEventListener(evt, onActivity));
}
