<script setup>
import { IconUser, IconDeviceFloppy, IconRefresh, IconCheck, IconAlertCircle } from "@tabler/icons-vue";

definePageMeta({
  title: "My Profile",
});

useSeoMeta({
  title: "My Profile",
});

const { request } = useApi();
const { user, fetchMe } = useAuth();

const profile = ref(null);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const success = ref("");

const form = reactive({
  nama: "",
  email: "",
});

const fieldErrors = reactive({
  nama: "",
  email: "",
});

const displayName = computed(() => profile.value?.nama || "Pengguna");

const initials = computed(() => {
  return (
    displayName.value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "US"
  );
});

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function resetErrors() {
  error.value = "";
  fieldErrors.nama = "";
  fieldErrors.email = "";
}

function applyProfile(data) {
  profile.value = data;

  form.nama = data.nama || "";
  form.email = data.email || "";
}

async function loadProfile() {
  loading.value = true;
  resetErrors();

  try {
    const response = await request("/profile");
    applyProfile(response.data);
  } catch (e) {
    error.value = e?.data?.message || "Gagal mengambil profil.";
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  resetErrors();
  success.value = "";

  const nama = form.nama.trim();
  const email = form.email.trim();

  if (nama.length < 2 || nama.length > 150) {
    fieldErrors.nama = "Nama harus terdiri dari 2 sampai 150 karakter.";
  }

  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Masukkan email yang valid.";
  }

  if (fieldErrors.nama || fieldErrors.email) return;

  const unchanged = nama === profile.value?.nama && email === profile.value?.email;

  if (unchanged) {
    success.value = "Tidak ada perubahan pada profil.";
    return;
  }

  saving.value = true;

  try {
    const response = await request("/profile", {
      method: "PATCH",
      body: { nama, email },
    });

    applyProfile(response.data);

    // Sinkronkan user global supaya nama di header ikut berubah.
    try {
      await fetchMe();
    } catch {
      if (user.value) {
        user.value = {
          ...user.value,
          nama: response.data.nama,
          email: response.data.email,
        };
      }
    }

    success.value = response.message || "Profil berhasil diperbarui.";
  } catch (e) {
    const errors = e?.data?.errors?.fieldErrors;

    if (errors) {
      fieldErrors.nama = errors.nama?.[0] || "";
      fieldErrors.email = errors.email?.[0] || "";
    }

    error.value = e?.data?.message || "Gagal memperbarui profil.";
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  if (!profile.value) return;

  form.nama = profile.value.nama || "";
  form.email = profile.value.email || "";

  resetErrors();
  success.value = "";
}

onMounted(loadProfile);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <p class="text-secondary mb-0">Lihat dan perbarui informasi akun Anda.</p>
      </div>

      <button type="button" class="btn btn-outline-primary" :disabled="loading || saving" @click="loadProfile">
        <IconRefresh :size="18" class="me-1" />
        Refresh
      </button>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">
      <IconAlertCircle :size="18" class="me-1" />
      {{ error }}
    </div>

    <div v-if="success" class="alert alert-success" role="status">
      <IconCheck :size="18" class="me-1" />
      {{ success }}
    </div>

    <div v-if="loading" class="card">
      <div class="card-body text-center py-5">
        <div class="spinner-border text-primary" />
        <p class="text-secondary mt-3 mb-0">Memuat profil...</p>
      </div>
    </div>

    <div v-else-if="profile" class="row g-3">
      <!-- Ringkasan akun -->
      <div class="col-lg-4">
        <div class="card h-100">
          <div class="card-body text-center py-4">
            <div class="avatar avatar-xl rounded-circle bg-primary text-white mx-auto mb-3" style="font-size: 1.5rem">
              {{ initials }}
            </div>

            <h3 class="mb-1">
              {{ profile.nama }}
            </h3>

            <p class="text-secondary mb-3">
              {{ profile.email }}
            </p>

            <span class="badge bg-blue-lt">
              {{ profile.nama_role }}
            </span>

            <div class="hr my-4"></div>

            <div class="text-start">
              <div class="mb-3">
                <div class="text-secondary small">Username</div>
                <div class="fw-semibold">
                  {{ profile.username }}
                </div>
              </div>

              <div class="mb-3">
                <div class="text-secondary small">Pegawai Terhubung</div>
                <div class="fw-semibold">
                  {{ profile.nama_pegawai || "Tidak terhubung" }}
                </div>
              </div>

              <div class="mb-3">
                <div class="text-secondary small">Tanggal Akun Dibuat</div>
                <div>
                  {{ formatDate(profile.created_at) }}
                </div>
              </div>

              <div>
                <div class="text-secondary small">Login Terakhir</div>
                <div>
                  {{ formatDate(profile.last_login) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form edit profil -->
      <div class="col-lg-8">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <IconUser :size="20" class="me-2" />
              Informasi Profil
            </h3>
          </div>

          <form @submit.prevent="saveProfile">
            <div class="card-body">
              <p class="text-secondary mb-4">Anda hanya dapat mengubah nama dan email. Username serta role dikelola oleh administrator.</p>

              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label"> Username </label>

                  <input :value="profile.username" type="text" class="form-control" readonly disabled />
                </div>

                <div class="col-md-6">
                  <label class="form-label"> Role </label>

                  <input :value="profile.nama_role" type="text" class="form-control" readonly disabled />
                </div>

                <div class="col-12">
                  <label class="form-label required"> Nama Lengkap </label>

                  <input v-model="form.nama" type="text" class="form-control" :class="{ 'is-invalid': fieldErrors.nama }" minlength="2" maxlength="150" required :disabled="saving" />

                  <div v-if="fieldErrors.nama" class="invalid-feedback">
                    {{ fieldErrors.nama }}
                  </div>
                </div>

                <div class="col-12">
                  <label class="form-label required"> Email </label>

                  <input v-model="form.email" type="email" class="form-control" :class="{ 'is-invalid': fieldErrors.email }" maxlength="255" required :disabled="saving" />

                  <div v-if="fieldErrors.email" class="invalid-feedback">
                    {{ fieldErrors.email }}
                  </div>
                </div>
              </div>
            </div>

            <div class="card-footer d-flex justify-content-end gap-2">
              <button type="button" class="btn" :disabled="saving" @click="resetForm">Batal</button>

              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner-border spinner-border-sm me-2" />

                <IconDeviceFloppy v-else :size="18" class="me-1" />

                {{ saving ? "Menyimpan..." : "Simpan Perubahan" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
