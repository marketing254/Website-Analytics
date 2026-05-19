const TTL_MS = 10 * 60 * 1000;

const globalKey = "__ga4_oauth_states__";
type StateMap = Map<string, number>;

function getStore(): StateMap {
  const g = globalThis as unknown as Record<string, StateMap>;
  if (!g[globalKey]) g[globalKey] = new Map<string, number>();
  return g[globalKey];
}

export function rememberOauthState(state: string) {
  const store = getStore();
  store.set(state, Date.now() + TTL_MS);
  for (const [key, expiresAt] of store) {
    if (expiresAt < Date.now()) store.delete(key);
  }
}

export function consumeOauthState(state: string): boolean {
  const store = getStore();
  const expiresAt = store.get(state);
  if (!expiresAt) return false;
  store.delete(state);
  return expiresAt >= Date.now();
}
