export function useAuth() {
  const user = useState("auth-user", () => null);

  const { request, csrf } = useApi();

  async function login(payload) {
    const response = await request("/auth/login", {
      method: "POST",
      body: payload,
    });

    user.value = response.data.user;
    csrf.value = null;

    return response;
  }

  async function fetchMe() {
    const response = await request("/auth/me");

    user.value = response.data.user;

    return user.value;
  }

  async function logout() {
    try {
      await request("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.warn("Logout request failed:", error);
    } finally {
      user.value = null;
      csrf.value = null;

      if (import.meta.client) {
        sessionStorage.removeItem("jmc-remember-me");
        sessionStorage.removeItem("jmc-last-activity");
      }

      await navigateTo("/Login");
    }
  }

  return {
    user,
    login,
    fetchMe,
    logout,
  };
}
