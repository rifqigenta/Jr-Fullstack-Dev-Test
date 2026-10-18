export function useAuth() {
  const user = useState("auth-user", () => null);
  const rememberMe = useState("auth-remember-me", () => false);
  const lastActivityAt = useState("auth-last-activity", () => 0);

  const { request, csrf } = useApi();

  function syncSession(data) {
    user.value = data.user;
    rememberMe.value = Boolean(data.rememberMe);
    lastActivityAt.value = Number(data.lastActivityAt || Date.now());

    if (import.meta.client) {
      sessionStorage.setItem("jmc-remember-me", String(rememberMe.value));

      sessionStorage.setItem("jmc-last-activity", String(lastActivityAt.value));
    }
  }

  function clearSession() {
    user.value = null;
    rememberMe.value = false;
    lastActivityAt.value = 0;
    csrf.value = null;

    if (import.meta.client) {
      sessionStorage.removeItem("jmc-remember-me");
      sessionStorage.removeItem("jmc-last-activity");
    }
  }

  async function login(payload) {
    const response = await request("/auth/login", {
      method: "POST",
      body: payload,
    });

    csrf.value = null;
    syncSession(response.data);

    return response;
  }

  async function fetchMe() {
    try {
      const response = await request("/auth/me");

      syncSession(response.data);
      return user.value;
    } catch (error) {
      const status = error?.statusCode || error?.status;

      if (status === 401) {
        clearSession();
      }

      throw error;
    }
  }

  async function reportActivity() {
    const response = await request("/auth/activity", {
      method: "POST",
    });

    lastActivityAt.value = Number(response.data.lastActivityAt);

    return response;
  }

  async function logout() {
    try {
      await request("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      const status = error?.statusCode || error?.status;

      if (status !== 401) {
        throw error;
      }
    }

    clearSession();
    await navigateTo("/Login");
  }

  return {
    user,
    rememberMe,
    lastActivityAt,
    login,
    fetchMe,
    reportActivity,
    clearSession,
    logout,
  };
}
