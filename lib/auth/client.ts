export const AUTH_STATE_CHANGED_EVENT = 'citify-auth-changed'

export type AuthStateChangedDetail = {
  status: 'login' | 'logout' | 'refresh'
}

export function dispatchAuthStateChanged(detail: AuthStateChangedDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AuthStateChangedDetail>(AUTH_STATE_CHANGED_EVENT, { detail }))
}
