<script setup>
import SearchableSelect from "./SearchableSelect.vue";
import EmployeePicker from "./EmployeePicker.vue";

const props = defineProps({
  userId: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(["saved", "cancel", "busy"]);
const { request } = useApi();
const { user: currentUser } = useAuth();

const savedId = ref(props.userId);
const isEdit = computed(() => Boolean(savedId.value));

const loading = ref(true);
const saving = ref(false);
const generating = ref(false);
const error = ref("");

const roles = ref([]);
const positions = ref([]);
const departments = ref([]);
const employee = ref(null);

const initialDisabled = ref(false);

const form = reactive({
  username: "",
  password: "",
  id_role: "",
  id_jabatan: "",
  id_departemen: "",
  active: true,
});

const usernameState = ref("");
const usernameMessage = ref("");

let usernameTimer;
let usernameVersion = 0;

const isSelf = computed(() => Number(savedId.value) === Number(currentUser.value?.id));

const passwordRules = computed(() => [
  {
    label: "Minimal 8 karakter",
    valid: form.password.length >= 8,
  },
  {
    label: "Tanpa spasi",
    valid: Boolean(form.password) && !/\s/.test(form.password),
  },
  {
    label: "Memiliki huruf besar",
    valid: /[A-Z]/.test(form.password),
  },
  {
    label: "Memiliki huruf kecil",
    valid: /[a-z]/.test(form.password),
  },
  {
    label: "Memiliki karakter khusus",
    valid: /[^A-Za-z0-9\s]/.test(form.password),
  },
]);

function getError(value) {
  const fields = value?.data?.errors?.fieldErrors;

  const messages = fields ? Object.values(fields).flat().filter(Boolean) : [];

  return messages.join(" ") || value?.data?.message || value?.message || "Terjadi kesalahan.";
}

function chooseEmployee(value) {
  employee.value = value;

  form.id_jabatan = value?.id_jabatan || "";
  form.id_departemen = value?.id_departemen || "";
}

function validateUsernameFormat() {
  if (!/^[a-z0-9]{6,50}$/.test(form.username)) {
    usernameState.value = "invalid";
    usernameMessage.value = "Minimal 6 karakter, hanya huruf kecil dan angka.";

    return false;
  }

  return true;
}

async function checkUsername() {
  const requestVersion = ++usernameVersion;

  if (!validateUsernameFormat()) return false;

  const username = form.username;
  usernameState.value = "checking";
  usernameMessage.value = "Memeriksa username...";

  try {
    const response = await request("/users/username-availability", {
      query: {
        username,
        ...(savedId.value ? { excludeId: savedId.value } : {}),
      },
    });

    if (requestVersion !== usernameVersion || username !== form.username) {
      return false;
    }

    const available = Boolean(response.data.available);

    usernameState.value = available ? "valid" : "invalid";
    usernameMessage.value = available ? "Username tersedia." : "Username sudah digunakan.";

    return available;
  } catch (value) {
    if (requestVersion === usernameVersion) {
      usernameState.value = "error";
      usernameMessage.value = getError(value);
    }

    return false;
  }
}

function onUsernameInput() {
  clearTimeout(usernameTimer);
  usernameVersion++;

  if (!validateUsernameFormat()) return;

  usernameState.value = "checking";
  usernameMessage.value = "Memeriksa username...";

  usernameTimer = setTimeout(checkUsername, 350);
}

async function generatePassword() {
  generating.value = true;
  error.value = "";

  try {
    const response = await request("/users/generate-password", {
      method: "POST",
    });

    form.password = response.data.password;
  } catch (value) {
    error.value = getError(value);
  } finally {
    generating.value = false;
  }
}

async function save() {
  if (saving.value) return;

  error.value = "";

  if (!employee.value?.id) {
    error.value = "Pilih nama pengguna dari hasil pencarian pegawai.";
    return;
  }

  if (!form.id_role || !form.id_jabatan || !form.id_departemen) {
    error.value = "Pilih role, jabatan, dan departemen.";
    return;
  }

  if (!isEdit.value && !passwordRules.value.every((rule) => rule.valid)) {
    error.value = "Generate password yang memenuhi seluruh aturan.";
    return;
  }

  saving.value = true;
  emit("busy", true);

  clearTimeout(usernameTimer);

  let dataSaved = false;

  try {
    if (!(await checkUsername())) {
      error.value = "Username belum valid atau belum dapat diverifikasi.";
      return;
    }

    const payload = {
      id_pegawai: Number(employee.value.id),
      id_role: Number(form.id_role),
      id_jabatan: Number(form.id_jabatan),
      id_departemen: Number(form.id_departemen),
      username: form.username,
    };

    const creating = !savedId.value;

    const response = await request(creating ? "/users" : `/users/${savedId.value}`, {
      method: creating ? "POST" : "PATCH",
      body: {
        ...payload,
        ...(creating
          ? {
              password: form.password,
              disabled: !form.active,
            }
          : {}),
      },
    });

    savedId.value = Number(response.data.id);
    dataSaved = true;

    if (creating) {
      initialDisabled.value = !form.active;
    }

    if (initialDisabled.value !== !form.active) {
      await request(`/users/${savedId.value}/status`, {
        method: "PATCH",
        body: { disabled: !form.active },
      });

      initialDisabled.value = !form.active;
    }

    emit("saved", {
      username: form.username,
      password: creating ? form.password : "",
    });
  } catch (value) {
    error.value = dataSaved ? `Data user sudah tersimpan, tetapi perubahan status gagal. ${getError(value)}` : getError(value);
  } finally {
    saving.value = false;
    emit("busy", false);
  }
}

onMounted(async () => {
  try {
    const [roleResponse, positionResponse, departmentResponse] = await Promise.all([request("/roles"), request("/master-data/positions"), request("/master-data/departments")]);

    roles.value = roleResponse.data || [];
    positions.value = positionResponse.data || [];
    departments.value = departmentResponse.data || [];

    if (savedId.value) {
      const response = await request(`/users/${savedId.value}`);
      const detail = response.data;

      form.username = detail.username;
      form.id_role = detail.id_role;
      form.id_jabatan = detail.id_jabatan || "";
      form.id_departemen = detail.id_departemen || "";
      form.active = !detail.disabled;

      initialDisabled.value = Boolean(detail.disabled);

      employee.value = detail.id_pegawai
        ? {
            id: detail.id_pegawai,
            nama_pegawai: detail.nama_pegawai || detail.nama,
            nip: detail.nip || "",
            email: detail.email || "",
            id_jabatan: detail.id_jabatan,
            id_departemen: detail.id_departemen,
          }
        : null;

      await checkUsername();
    }
  } catch (value) {
    error.value = getError(value);
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  clearTimeout(usernameTimer);
  usernameVersion++;
});
</script>

<template>
  <div class="card mb-3">
    <div class="card-header">
      <h3 class="card-title">
        {{ isEdit ? "Edit User" : "Tambah User" }}
      </h3>
    </div>

    <div class="card-body">
      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-if="loading" class="text-center py-3">Memuat form...</div>

      <form v-else @submit.prevent="save">
        <fieldset :disabled="saving">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label required">Nama Pengguna</label>

              <EmployeePicker :model-value="employee" :disabled="saving || isSelf" @update:model-value="chooseEmployee" />
            </div>

            <div class="col-md-6">
              <label for="user-email" class="form-label"> Email Pegawai </label>

              <input id="user-email" :value="employee?.email || ''" class="form-control" disabled />
            </div>

            <div class="col-md-6">
              <label for="user-username" class="form-label required"> Username </label>

              <input
                id="user-username"
                v-model="form.username"
                minlength="6"
                maxlength="50"
                pattern="[a-z0-9]+"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                class="form-control"
                :class="{
                  'is-invalid': usernameState === 'invalid',
                  'is-valid': usernameState === 'valid',
                }"
                required
                @input="onUsernameInput"
              />

              <div class="small mt-1" :class="usernameState === 'valid' ? 'text-success' : 'text-secondary'" role="status">
                {{ usernameMessage }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="user-role" class="form-label required"> Role </label>

              <select id="user-role" v-model="form.id_role" class="form-select" :disabled="isSelf" required>
                <option value="">Pilih Role</option>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.nama_role }}
                </option>
              </select>
            </div>

            <div class="col-md-6">
              <label class="form-label required">Jabatan</label>

              <SearchableSelect v-model="form.id_jabatan" :options="positions" label="Jabatan" :disabled="saving" />
            </div>

            <div class="col-md-6">
              <label class="form-label required">Departemen</label>

              <SearchableSelect v-model="form.id_departemen" :options="departments" label="Departemen" :disabled="saving" />
            </div>

            <div v-if="!isEdit" class="col-12">
              <label for="user-password" class="form-label required"> Password Awal </label>

              <div class="input-group">
                <input id="user-password" v-model="form.password" class="form-control" readonly autocomplete="off" placeholder="Klik Generate Password" />

                <button type="button" class="btn" :disabled="generating" @click="generatePassword">
                  {{ generating ? "Memproses..." : "Generate Password" }}
                </button>
              </div>

              <ul class="small mt-2 mb-0">
                <li v-for="rule in passwordRules" :key="rule.label" :class="rule.valid ? 'text-success' : 'text-secondary'">{{ rule.valid ? "✓" : "○" }} {{ rule.label }}</li>
              </ul>
            </div>

            <div class="col-12">
              <label class="form-check">
                <input v-model="form.active" type="checkbox" class="form-check-input" :disabled="isSelf" />

                <span class="form-check-label">Aktif</span>
              </label>
            </div>
          </div>
        </fieldset>

        <div class="d-flex justify-content-end gap-2 mt-4">
          <button type="button" class="btn" :disabled="saving" @click="emit('cancel')">Batal</button>

          <button type="submit" class="btn btn-primary" :disabled="saving || generating">
            {{ saving ? "Menyimpan..." : "Simpan User" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
