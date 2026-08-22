/**
 * `virtual:pwa-register/react` only exists while vite-plugin-pwa is running,
 * and it is not in the test config. Without this alias any test that reaches
 * <App /> fails on an unresolved import rather than on anything real.
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async () => {},
  };
}
