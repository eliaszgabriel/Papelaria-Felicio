export const AUTH_STATE_CHANGED_EVENT = "pf:auth-state-changed";

export function emitAuthStateChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
}
