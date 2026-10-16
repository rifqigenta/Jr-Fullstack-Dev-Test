export function useApi() {
  const csrf = useState("csrf-token", () => null);

  async function request(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();

    const headers = {
      ...(options.headers || {}),
    };

    if (!["GET", "HEAD", "OPTIONS"].includes(method) && path !== "/auth/login") {
      if (!csrf.value) {
        const response = await $fetch("/api/auth/csrf", {
          credentials: "include",
        });

        csrf.value = response.data.csrfToken;
      }

      headers["X-CSRF-Token"] = csrf.value;
    }

    return $fetch(`/api${path}`, {
      credentials: "include",
      ...options,
      headers,
    });
  }

  return {
    request,
    csrf,
  };
}
