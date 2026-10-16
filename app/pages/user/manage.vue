<script setup>
definePageMeta({ title: "Manajemen User" });

const { request } = useApi();

const users = ref([]);
const roles = ref([]);
const employees = ref([]);
const page = ref(1);
const pagination = ref({});
const search = ref("");
const keyword = ref("");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const success = ref("");
const editingId = ref(null);
const showForm = ref(false);
const generatedPassword = ref("");
const generatedUsername = ref("");

const form = reactive({
  id_pegawai: "",
  id_role: "",
  username: "",
  nama: "",
  email: "",
});

function getError(e) {
  const fields = e?.data?.errors?.fieldErrors;
  const details = fields
    ? Object.entries(fields)
        .flatMap(([key, messages]) => (messages || []).map((msg) => `${key}: ${msg}`))
        .join("; ")
    : "";

  return details || e?.data?.message || "Terjadi kesalahan.";
}

async function loadUsers() {
  loading.value = true;
  error.value = "";

  try {
    const res = await request("/users", {
      query: {
        page: page.value,
        limit: 10,
        search: keyword.value,
      },
    });

    users.value = res.data || [];
    pagination.value = res.pagination || {};
  } catch (e) {
    error.value = getError(e);
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  try {
    const [roleRes, employeeRes] = await Promise.all([
      request("/roles"),
      request("/users/employee-options", {
        query: { limit: 50 },
      }),
    ]);

    roles.value = roleRes.data || [];
    employees.value = employeeRes.data || [];
  } catch (e) {
    error.value = getError(e);
  }
}

function resetForm() {
  editingId.value = null;
  showForm.value = false;
  Object.assign(form, {
    id_pegawai: "",
    id_role: "",
    username: "",
    nama: "",
    email: "",
  });
}

function openCreate() {
  resetForm();
  showForm.value = true;
  loadOptions();
  generatedPassword.value = "";
  generatedUsername.value = "";
}

async function copyCredentials() {
  if (!generatedPassword.value) return;

  await navigator.clipboard.writeText(`Username: ${generatedUsername.value}\nPassword: ${generatedPassword.value}`);
}

async function openEdit(user) {
  error.value = "";

  try {
    const res = await request(`/users/${user.id}`);
    const detail = res.data;

    editingId.value = detail.id;
    Object.assign(form, {
      id_pegawai: detail.id_pegawai ?? "",
      id_role: detail.id_role,
      username: detail.username,
      nama: detail.nama,
      email: detail.email || "",
    });

    showForm.value = true;
    await loadOptions();
  } catch (e) {
    error.value = getError(e);
  }
}

async function saveUser() {
  saving.value = true;
  error.value = "";
  success.value = "";

  try {
    const payload = {
      username: form.username.trim(),
      nama: form.nama.trim(),
      email: form.email.trim(),
      id_role: Number(form.id_role),
      id_pegawai: form.id_pegawai ? Number(form.id_pegawai) : null,
    };

    if (!editingId.value && !payload.id_pegawai) {
      throw new Error("Pilih pegawai terlebih dahulu.");
    }

    const res = await request(editingId.value ? `/users/${editingId.value}` : "/users", {
      method: editingId.value ? "PATCH" : "POST",
      body: payload,
    });

    if (!editingId.value) {
      generatedPassword.value = res.data?.generatedPassword || "";
      generatedUsername.value = res.data?.username || payload.username;
    }

    success.value = res.message || "User berhasil disimpan.";
    resetForm();
    await loadUsers();
  } catch (e) {
    error.value = getError(e);
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(user) {
  const action = user.disabled ? "aktifkan" : "nonaktifkan";
  if (!confirm(`Yakin ingin ${action} ${user.username}?`)) return;

  error.value = "";
  success.value = "";

  try {
    await request(`/users/${user.id}/status`, {
      method: "PATCH",
      body: { disabled: !user.disabled },
    });

    success.value = "Status user berhasil diperbarui.";
    await loadUsers();
  } catch (e) {
    error.value = getError(e);
  }
}

async function deleteUser(user) {
  if (!confirm(`Hapus user ${user.username}?`)) return;

  error.value = "";
  success.value = "";

  try {
    await request(`/users/${user.id}`, {
      method: "DELETE",
    });

    success.value = "User berhasil dihapus.";
    await loadUsers();
  } catch (e) {
    error.value = getError(e);
  }
}

function applySearch() {
  page.value = 1;
  keyword.value = search.value.trim();
  loadUsers();
}

function changePage(next) {
  if (next < 1 || next > (pagination.value.totalPages || 1)) return;
  page.value = next;
  loadUsers();
}

onMounted(loadUsers);
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0">Manajemen User</h2>
      <button class="btn btn-primary" @click="openCreate">+ Tambah User</button>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="generatedPassword" class="alert alert-warning">
      <h4 class="alert-title">Akun baru berhasil dibuat!</h4>

      <p class="mb-2">Simpan kredensial berikut. Password hanya ditampilkan sekali dan tidak dapat dilihat kembali.</p>

      <div class="mb-2">
        <strong>Username:</strong>
        <code>{{ generatedUsername }}</code>
      </div>

      <div class="mb-3">
        <strong>Password sementara:</strong>
        <code>{{ generatedPassword }}</code>
      </div>

      <div class="d-flex gap-2">
        <button type="button" class="btn btn-sm btn-primary" @click="copyCredentials">Salin Kredensial</button>

        <button
          type="button"
          class="btn btn-sm"
          @click="
            generatedPassword = '';
            generatedUsername = '';
          "
        >
          Tutup
        </button>
      </div>
    </div>

    <div v-if="showForm" class="card mb-3">
      <div class="card-header">
        <h3 class="card-title">
          {{ editingId ? "Edit User" : "Tambah User" }}
        </h3>
      </div>

      <form @submit.prevent="saveUser">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Pegawai</label>
              <select v-model="form.id_pegawai" class="form-select" :required="!editingId">
                <option value="">Pilih Pegawai</option>
                <option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.nip }} - {{ employee.nama_pegawai }}</option>
                <option v-if="editingId && form.id_pegawai && !employees.some((e) => e.id === Number(form.id_pegawai))" :value="Number(form.id_pegawai)">
                  Pegawai tersimpan (ID {{ form.id_pegawai }})
                </option>
              </select>
            </div>

            <div class="col-md-6">
              <label class="form-label">Role</label>
              <select v-model="form.id_role" class="form-select" required>
                <option value="">Pilih Role</option>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.nama_role }}
                </option>
              </select>
            </div>

            <div class="col-md-6">
              <label class="form-label">Username</label>
              <input v-model="form.username" class="form-control" minlength="6" maxlength="50" pattern="[a-z0-9]+" required />
              <small class="text-secondary"> Minimal 6 karakter, huruf kecil dan angka. </small>
            </div>

            <div class="col-md-6">
              <label class="form-label">Nama</label>
              <input v-model="form.nama" class="form-control" minlength="2" required />
            </div>

            <div class="col-12">
              <label class="form-label">Email</label>
              <input v-model="form.email" type="email" class="form-control" required />
            </div>
          </div>
        </div>

        <div class="card-footer d-flex justify-content-end gap-2">
          <button type="button" class="btn" @click="resetForm">Batal</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? "Menyimpan..." : "Simpan User" }}
          </button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card-header">
        <form class="input-group ms-auto" style="max-width: 300px" @submit.prevent="applySearch">
          <input v-model="search" class="form-control" placeholder="Cari user..." />
          <button class="btn btn-primary" type="submit">Cari</button>
        </form>
      </div>

      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Username</th>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Pegawai</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="text-center py-4">Memuat...</td>
            </tr>

            <tr v-for="(item, i) in users" :key="item.id">
              <td>{{ (page - 1) * 10 + i + 1 }}</td>
              <td>{{ item.username }}</td>
              <td>{{ item.nama }}</td>
              <td>{{ item.email }}</td>
              <td>{{ item.nama_role }}</td>
              <td>{{ item.nama_pegawai || "-" }}</td>
              <td>
                <span class="badge" :class="item.disabled ? 'bg-danger-lt' : 'bg-success-lt'">
                  {{ item.disabled ? "Nonaktif" : "Aktif" }}
                </span>
              </td>
              <td>
                <div class="d-flex flex-wrap gap-1">
                  <button class="btn btn-sm btn-outline-primary" @click="openEdit(item)">Edit</button>
                  <button class="btn btn-sm btn-outline-warning" @click="toggleStatus(item)">
                    {{ item.disabled ? "Aktifkan" : "Nonaktifkan" }}
                  </button>
                  <button class="btn btn-sm btn-outline-danger" @click="deleteUser(item)">Hapus</button>
                </div>
              </td>
            </tr>

            <tr v-if="!loading && users.length === 0">
              <td colspan="8" class="text-center py-4">Tidak ada user.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card-footer d-flex justify-content-between">
        <span>{{ pagination.total || 0 }} user</span>
        <div class="btn-list">
          <button class="btn btn-sm" :disabled="page <= 1" @click="changePage(page - 1)">Sebelumnya</button>
          <span class="align-self-center">{{ page }}</span>
          <button class="btn btn-sm" :disabled="page >= (pagination.totalPages || 1)" @click="changePage(page + 1)">Berikutnya</button>
        </div>
      </div>
    </div>
  </div>
</template>
