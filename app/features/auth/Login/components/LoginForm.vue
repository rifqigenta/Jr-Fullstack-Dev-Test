<script setup>
const { login } = useAuth();
const config = useRuntimeConfig();

const identifier = ref("");
const password = ref("");
const rememberMe = ref(false);
const captchaToken = ref("");

const loading = ref(false);
const error = ref("");

const widget = ref(null);

let widgetId = null;
let intervalId = null;

onMounted(() => {
  const render = () => {
    if (!window.turnstile || !widget.value || widgetId !== null || !config.public.turnstileSiteKey) {
      return false;
    }

    widgetId = window.turnstile.render(widget.value, {
      sitekey: config.public.turnstileSiteKey,

      callback: (token) => {
        captchaToken.value = token;
      },

      "expired-callback": () => {
        captchaToken.value = "";
      },

      "error-callback": () => {
        captchaToken.value = "";
      },
    });

    return true;
  };

  if (!render()) {
    intervalId = window.setInterval(() => {
      if (render()) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }, 150);
  }
});

onBeforeUnmount(() => {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
  }

  if (widgetId !== null && window.turnstile) {
    window.turnstile.remove(widgetId);
  }
});

async function submit() {
  error.value = "";

  if (!captchaToken.value) {
    error.value = "Selesaikan verifikasi CAPTCHA.";
    return;
  }

  loading.value = true;

  try {
    await login({
      identifier: identifier.value,
      password: password.value,
      rememberMe: rememberMe.value,
      captchaToken: captchaToken.value,
    });

    await navigateTo("/");
  } catch (e) {
    error.value = e?.data?.message || "Login gagal.";

    captchaToken.value = "";

    if (widgetId !== null) {
      window.turnstile?.reset(widgetId);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <div v-if="error" class="alert alert-danger">
      {{ error }}
    </div>

    <div class="mb-2">
      <input v-model="identifier" class="form-control py-3" placeholder="Username atau email" autocomplete="username" required />
    </div>

    <div class="mb-2">
      <input v-model="password" type="password" class="form-control py-3" placeholder="Password" autocomplete="current-password" required />
    </div>

    <label class="form-check mb-3">
      <input v-model="rememberMe" type="checkbox" class="form-check-input" />

      <span class="form-check-label"> Remember Me </span>
    </label>

    <div ref="widget" class="mb-3"></div>

    <button class="btn btn-primary w-100 py-3" type="submit" :disabled="loading">
      {{ loading ? "Memproses..." : "MASUK" }}
    </button>
  </form>
</template>
