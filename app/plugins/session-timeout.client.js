export default defineNuxtPlugin((nuxtApp) => {
  const { user, rememberMe, lastActivityAt, fetchMe, reportActivity, clearSession, logout } = useAuth();

  const TIMEOUT = 3 * 60 * 1000;
  const REPORT_INTERVAL = 10 * 1000;
  const VERIFY_INTERVAL = 60 * 1000;

  let localActivityAt = 0;
  let lastReportAt = 0;
  let lastVerifyAt = 0;

  let pendingActivity = false;
  let reporting = false;
  let checking = false;
  let endingSession = false;

  async function goToLogin() {
    clearSession();
    await navigateTo("/Login");
  }

  async function handleUnauthorized(error) {
    const status = error?.statusCode || error?.status;

    if (status === 401) {
      await goToLogin();
      return true;
    }

    return false;
  }

  async function flushActivity() {
    if (!user.value || rememberMe.value || !pendingActivity || reporting || endingSession) {
      return;
    }

    reporting = true;
    pendingActivity = false;

    try {
      await reportActivity();
      lastReportAt = Date.now();
    } catch (error) {
      if (!(await handleUnauthorized(error))) {
        pendingActivity = true;
      }
    } finally {
      reporting = false;
    }
  }

  function markActivity(event) {
    if (!event.isTrusted || !user.value || rememberMe.value || endingSession) {
      return;
    }

    const now = Date.now();
    const last = localActivityAt || lastActivityAt.value;

    if (last && now - last >= TIMEOUT) {
      return;
    }

    localActivityAt = now;
    pendingActivity = true;

    if (now - lastReportAt >= REPORT_INTERVAL) {
      void flushActivity();
    }
  }

  async function verifySession() {
    if (!user.value || checking || endingSession) return;

    checking = true;
    lastVerifyAt = Date.now();

    try {
      await fetchMe();
    } catch (error) {
      await handleUnauthorized(error);
    } finally {
      checking = false;
    }
  }

  async function tick() {
    if (!user.value || endingSession) return;

    const now = Date.now();

    if (!rememberMe.value) {
      const last = localActivityAt || lastActivityAt.value;

      if (last && now - last >= TIMEOUT) {
        endingSession = true;

        try {
          await logout();
        } catch (error) {
          console.warn("Logout idle belum terkonfirmasi:", error);
          await goToLogin();
        } finally {
          endingSession = false;
        }

        return;
      }

      if (pendingActivity && now - lastReportAt >= REPORT_INTERVAL) {
        void flushActivity();
      }
    }

    if (now - lastVerifyAt >= VERIFY_INTERVAL) {
      void verifySession();
    }
  }

  const stopWatch = watch(
    () => user.value?.id,
    (id) => {
      localActivityAt = id ? lastActivityAt.value : 0;
      lastReportAt = 0;
      lastVerifyAt = Date.now();
      pendingActivity = false;
    },
    { immediate: true },
  );

  const events = ["pointerdown", "keydown", "scroll", "touchstart", "input"];

  events.forEach((event) => {
    window.addEventListener(event, markActivity, {
      passive: true,
      capture: true,
    });
  });

  function onVisibilityChange() {
    if (document.visibilityState === "visible") {
      void tick();
      void verifySession();
    }
  }

  function onFocus() {
    void tick();
    void verifySession();
  }

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibilityChange);

  const interval = window.setInterval(() => {
    void tick();
  }, 1000);

  nuxtApp.hook("app:beforeUnmount", () => {
    stopWatch();
    window.clearInterval(interval);

    events.forEach((event) => {
      window.removeEventListener(event, markActivity, true);
    });

    window.removeEventListener("focus", onFocus);

    document.removeEventListener("visibilitychange", onVisibilityChange);
  });
});
