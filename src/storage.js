// localStorage 추상화 — 추후 Capacitor Preferences 등으로 교체할 때 이 모듈만 바꾼다.
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // file:// 미리보기 등 저장 불가 환경에서는 조용히 무시
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
