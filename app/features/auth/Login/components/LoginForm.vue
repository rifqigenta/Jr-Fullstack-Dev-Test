<script setup>
const { login } = useAuth();
const { request } = useApi();

const identifier = ref("");
const password = ref("");
const rememberMe = ref(false);

const captchaId = ref("");
const captchaImage = ref("");
const captchaAnswer = ref("");
const captchaExpiresAt = ref(0);

const loading = ref(false);
const captchaLoading = ref(false);

const error = ref("");
const captchaError = ref("");

async function refreshCaptcha() {
  if (captchaLoading.value) return;

  captchaLoading.value = true;
  captchaError.value = "";
  captchaId.value = "";
  captchaImage.value = "";
  captchaAnswer.value = "";

  try {
    const response = await request("/auth/captcha");

    captchaId.value = response.data.id;
    captchaImage.value = response.data.image;

    captchaExpiresAt.value = Date.now() + Number(response.data.expiresInSeconds) * 1000;
  } catch (value) {
    captchaError.value = value?.data?.message || "Gagal memuat CAPTCHA.";
  } finally {
    captchaLoading.value = false;
  }
}

async function submit() {
  if (loading.value || captchaLoading.value) return;

  error.value = "";

  if (!captchaId.value || !/^\d{6}$/.test(captchaAnswer.value)) {
    error.value = "Masukkan 6 digit kode CAPTCHA.";
    return;
  }

  if (Date.now() >= captchaExpiresAt.value) {
    error.value = "CAPTCHA kedaluwarsa. Masukkan kode baru.";
    await refreshCaptcha();
    return;
  }

  loading.value = true;

  try {
    await login({
      identifier: identifier.value.trim(),
      password: password.value,
      rememberMe: rememberMe.value,
      captchaId: captchaId.value,
      captchaAnswer: captchaAnswer.value,
    });

    await navigateTo("/");
  } catch (value) {
    error.value = value?.data?.message || "Login gagal. Silakan coba lagi.";

    // CAPTCHA hanya dapat dicoba satu kali.
    await refreshCaptcha();
  } finally {
    loading.value = false;
  }
}

onMounted(refreshCaptcha);
</script>

<template>
  <form @submit.prevent="submit">
    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <fieldset :disabled="loading">
      <div class="mb-3">
        <label for="login-identifier" class="form-label"> Username, Email, atau Nomor HP </label>

        <input id="login-identifier" v-model="identifier" type="text" maxlength="255" class="form-control py-3" autocomplete="username" autocapitalize="none" spellcheck="false" required />
      </div>

      <div class="mb-3">
        <label for="login-password" class="form-label"> Password </label>

        <input id="login-password" v-model="password" type="password" maxlength="256" class="form-control py-3" autocomplete="current-password" required />
      </div>

      <label class="form-check mb-3">
        <input v-model="rememberMe" type="checkbox" class="form-check-input" />

        <span class="form-check-label"> Remember me </span>
      </label>

      <div class="mb-3">
        <label for="login-captcha" class="form-label"> Kode CAPTCHA </label>

        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
          <img v-if="captchaImage" :src="captchaImage" width="200" height="64" alt="Gambar CAPTCHA berisi enam digit angka" class="rounded border" />

          <span v-if="captchaLoading" role="status"> Memuat CAPTCHA... </span>

          <button type="button" class="btn btn-sm" :disabled="captchaLoading" @click="refreshCaptcha">Ganti Kode</button>
        </div>

        <div v-if="captchaError" class="text-danger small mb-2" role="alert">
          {{ captchaError }}
        </div>

        <input
          id="login-captcha"
          v-model="captchaAnswer"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          maxlength="6"
          pattern="[0-9]{6}"
          class="form-control py-3"
          placeholder="Masukkan 6 digit pada gambar"
          :disabled="captchaLoading || !captchaId"
          required
        />

        <div class="form-hint">Kode berlaku 2 menit dan satu kali percobaan.</div>
      </div>

      <button type="submit" class="btn btn-primary w-100 py-3" :disabled="loading || captchaLoading || !captchaId">
        {{ loading ? "Memproses..." : "MASUK" }}
      </button>
    </fieldset>
  </form>
</template>
