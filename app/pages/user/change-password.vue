<script setup>
definePageMeta({ title: "Change Password" });
useSeoMeta({ title: "Change Password" });

const { request } = useApi();
const { user } = useAuth();

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

const showPassword = ref(false);
const saving = ref(false);
const error = ref("");

const rules = computed(() => [
  { label: "Minimal 8 karakter", valid: newPassword.value.length >= 8 },
  { label: "Tanpa spasi", valid: newPassword.value.length > 0 && !/\s/.test(newPassword.value) },
  { label: "Huruf besar", valid: /[A-Z]/.test(newPassword.value) },
  { label: "Huruf kecil", valid: /[a-z]/.test(newPassword.value) },
  { label: "Angka", valid: /[0-9]/.test(newPassword.value) },
  { label: "Karakter khusus", valid: /[^A-Za-z0-9\s]/.test(newPassword.value) },
]);

const validPassword = computed(() => rules.value.every((r) => r.valid) && newPassword.value.length <= 128);

const canSubmit = computed(
  () => currentPassword.value.length > 0 && validPassword.value && newPassword.value !== currentPassword.value && newPassword.value === confirmPassword.value && !saving.value,
);

async function savePassword() {
  if (!canSubmit.value) return;

  saving.value = true;
  error.value = "";

  try {
    await request("/profile/password", {
      method: "PATCH",
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      },
    });

    // Backend mencabut semua sesi setelah password diubah.
    user.value = null;

    sessionStorage.removeItem("jmc-remember-me");
    sessionStorage.removeItem("jmc-last-activity");

    await navigateTo("/auth/login", { replace: true });
  } catch (e) {
    const fields = e?.data?.errors?.fieldErrors;

    error.value = fields ? Object.values(fields).flat().join("; ") : e?.data?.message || "Gagal mengganti password.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <p class="text-secondary">Ganti password akun Anda. Setelah berhasil, silakan login kembali.</p>

    <div v-if="error" class="alert alert-danger">
      {{ error }}
    </div>

    <div class="card">
      <form @submit.prevent="savePassword">
        <div class="card-header">
          <h3 class="card-title">Keamanan Akun</h3>
        </div>

        <div class="card-body">
          <div class="mb-3">
            <label class="form-label required">Password Lama</label>

            <input v-model="currentPassword" :type="showPassword ? 'text' : 'password'" class="form-control" autocomplete="current-password" required />
          </div>

          <div class="mb-3">
            <label class="form-label required">Password Baru</label>

            <input v-model="newPassword" :type="showPassword ? 'text' : 'password'" class="form-control" autocomplete="new-password" required minlength="8" maxlength="128" />
          </div>

          <div class="mb-3">
            <label class="form-label required">Konfirmasi Password Baru</label>

            <input v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" class="form-control" autocomplete="new-password" required />

            <small v-if="confirmPassword" :class="newPassword === confirmPassword ? 'text-success' : 'text-danger'">
              {{ newPassword === confirmPassword ? "Password cocok" : "Password tidak cocok" }}
            </small>
          </div>

          <label class="form-check mb-3">
            <input v-model="showPassword" type="checkbox" class="form-check-input" />
            <span class="form-check-label">Tampilkan password</span>
          </label>

          <div class="border rounded p-3">
            <h4>Persyaratan Password</h4>

            <div v-for="rule in rules" :key="rule.label" class="mb-1" :class="rule.valid ? 'text-success' : 'text-secondary'">
              {{ rule.valid ? "✓" : "○" }}
              {{ rule.label }}
            </div>
          </div>
        </div>

        <div class="card-footer d-flex justify-content-end gap-2">
          <NuxtLink to="/user/profile" class="btn"> Batal </NuxtLink>

          <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
            {{ saving ? "Menyimpan..." : "Ganti Password" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
