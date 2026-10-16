export default defineNuxtPlugin(() => {
  const { user, logout } = useAuth();

  const TIMEOUT = 3 * 60 * 1000;
  const CHECK_INTERVAL = 1000;

  let loggingOut = false;
  let lastEventAt = 0;

  function isRemembered() {
    return sessionStorage.getItem("jmc-remember-me") === "true";
  }

  function getLastActivity() {
    return Number(sessionStorage.getItem("jmc-last-activity") || 0);
  }

  function updateActivity() {
    if (!user.value || isRemembered() || loggingOut) return;

    const now = Date.now();

    // Hindari menulis storage terus-menerus.
    if (now - lastEventAt < 1000) return;

    lastEventAt = now;

    // Jangan hidupkan kembali sesi yang sudah melewati timeout.
    const last = getLastActivity();
    if (last && now - last >= TIMEOUT) return;

    sessionStorage.setItem("jmc-last-activity", String(now));
  }

  async function checkSession() {
    if (!user.value || isRemembered() || loggingOut) return;

    let last = getLastActivity();

    if (!last) {
      last = Date.now();
      sessionStorage.setItem("jmc-last-activity", String(last));
    }

    if (Date.now() - last >= TIMEOUT) {
      loggingOut = true;

      try {
        await logout();
      } finally {
        loggingOut = false;
      }
    }
  }

  const events = ["pointerdown", "keydown", "scroll", "touchstart"];

  events.forEach((event) => {
    window.addEventListener(event, updateActivity, {
      passive: true,
    });
  });

  window.addEventListener("focus", checkSession);
  document.addEventListener("visibilitychange", checkSession);

  setInterval(checkSession, CHECK_INTERVAL);
});
