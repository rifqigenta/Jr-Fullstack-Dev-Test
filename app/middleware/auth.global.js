export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  const { user, fetchMe } = useAuth();

  const isLogin = to.path.toLowerCase() === "/login";

  if (!user.value) {
    try {
      await fetchMe();
    } catch (error) {
      console.error("[AUTH] Session check failed:", {
        status: error?.statusCode || error?.status,
        message: error?.data?.message || error?.message,
      });

      user.value = null;

      // Redirect hanya jika backend benar-benar
      // menyatakan session tidak valid.
      const status = error?.statusCode || error?.status;

      if (status === 401) {
        if (!isLogin) {
          return navigateTo("/Login");
        }
        return;
      }

      // Untuk error jaringan, 404, atau 500,
      // jangan sembunyikan masalah sebagai logout.
      if (!isLogin) {
        return abortNavigation(
          createError({
            statusCode: status || 503,
            statusMessage: "Gagal memverifikasi sesi. Periksa koneksi backend/API.",
          }),
        );
      }

      return;
    }
  }

  if (user.value && isLogin) {
    return navigateTo("/");
  }

  if (!user.value && !isLogin) {
    return navigateTo("/Login");
  }
});
