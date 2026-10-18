<script setup>
import UserForm from "~/features/users/components/UserForm.vue";

definePageMeta({ title: "Manajemen User" });

const { request } = useApi();
const { user: currentUser, fetchMe } = useAuth();

const users = ref([]);
const page = ref(1);
const pagination = ref({});

const search = ref("");
const keyword = ref("");
const sortBy = ref("id");
const sortOrder = ref("desc");

const loading = ref(false);
const processing = ref(false);
const formBusy = ref(false);

const error = ref("");
const success = ref("");

const showForm = ref(false);
const editingId = ref(null);
const formVersion = ref(0);

const credentials = ref(null);

const allowed = computed(
  () =>
    String(currentUser.value?.nama_role || "")
      .trim()
      .toLowerCase() === "superadmin",
);

const busy = computed(() => loading.value || processing.value || formBusy.value);

const sortColumns = [
  { key: "nama", label: "Nama" },
  { key: "username", label: "Username" },
  { key: "status", label: "Status" },
];

let version = 0;

function getError(value) {
  return value?.data?.message || value?.message || "Terjadi kesalahan.";
}

async function loadUsers() {
  const requestVersion = ++version;
  loading.value = true;

  try {
    const response = await request("/users", {
      query: {
        page: page.value,
        limit: 10,
        search: keyword.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
      },
    });

    if (requestVersion !== version) return;

    const totalPages = Number(response.pagination?.totalPages || 0);

    if (page.value > Math.max(1, totalPages)) {
      page.value = Math.max(1, totalPages);
      await loadUsers();
      return;
    }

    users.value = response.data || [];
    pagination.value = response.pagination || {};
  } catch (value) {
    if (requestVersion !== version) return;

    users.value = [];
    error.value = getError(value);
  } finally {
    if (requestVersion === version) {
      loading.value = false;
    }
  }
}

function openForm(id = null) {
  if (busy.value) return;

  editingId.value = id;
  credentials.value = null;
  error.value = "";
  success.value = "";

  formVersion.value++;
  showForm.value = true;
}

async function saved(result) {
  credentials.value = result.password ? result : null;
  showForm.value = false;
  success.value = "Data user berhasil disimpan.";

  await loadUsers();
}

async function copyCredentials() {
  if (!credentials.value) return;

  try {
    await navigator.clipboard.writeText(`Username: ${credentials.value.username}\n` + `Password: ${credentials.value.password}`);

    success.value = "Kredensial berhasil disalin.";
  } catch {
    error.value = "Tidak dapat menyalin otomatis. Salin kredensial secara manual.";
  }
}

async function applySearch() {
  if (busy.value) return;

  error.value = "";
  keyword.value = search.value.trim();
  page.value = 1;

  await loadUsers();
}

async function sort(key) {
  if (busy.value) return;

  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = key;
    sortOrder.value = "asc";
  }

  page.value = 1;
  await loadUsers();
}

async function changePage(next) {
  if (busy.value || next < 1 || next > Number(pagination.value.totalPages || 0)) {
    return;
  }

  page.value = next;
  await loadUsers();
}

async function changeStatus(item) {
  if (busy.value) return;

  if (!window.confirm(`${item.disabled ? "Aktifkan" : "Nonaktifkan"} ${item.username}?`)) return;

  processing.value = true;
  error.value = "";

  try {
    await request(`/users/${item.id}/status`, {
      method: "PATCH",
      body: { disabled: !item.disabled },
    });

    success.value = "Status user berhasil diperbarui.";
    await loadUsers();
  } catch (value) {
    error.value = getError(value);
  } finally {
    processing.value = false;
  }
}

async function removeUser(item) {
  if (busy.value) return;

  if (!window.confirm(`Hapus user ${item.username}?`)) return;

  processing.value = true;
  error.value = "";

  try {
    await request(`/users/${item.id}`, {
      method: "DELETE",
    });

    success.value = "User berhasil dihapus.";
    await loadUsers();
  } catch (value) {
    error.value = getError(value);
  } finally {
    processing.value = false;
  }
}

onMounted(async () => {
  try {
    if (!currentUser.value) await fetchMe();

    if (!allowed.value) {
      error.value = "Halaman ini hanya dapat diakses Superadmin.";
      return;
    }

    await loadUsers();
  } catch (value) {
    error.value = getError(value);
  }
});

onBeforeUnmount(() => {
  version++;
});
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <div v-if="success" class="alert alert-success" role="status">
      {{ success }}
    </div>

    <template v-if="allowed">
      <div class="d-flex justify-content-end mb-3">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="openForm()">+ Tambah User</button>
      </div>

      <div v-if="credentials" class="card mb-3">
        <div class="card-body">
          <p>Simpan kredensial akun baru sebelum menutup tampilan ini.</p>

          <p class="mb-1">
            Username: <code>{{ credentials.username }}</code>
          </p>

          <p>
            Password: <code>{{ credentials.password }}</code>
          </p>

          <div class="d-flex gap-2">
            <button type="button" class="btn" @click="copyCredentials">Salin Kredensial</button>

            <button type="button" class="btn" @click="credentials = null">Tutup</button>
          </div>
        </div>
      </div>

      <UserForm v-if="showForm" :key="formVersion" :user-id="editingId" @saved="saved" @cancel="showForm = false" @busy="formBusy = $event" />

      <div class="card">
        <div class="card-header">
          <form class="input-group ms-auto" style="max-width: 360px" @submit.prevent="applySearch">
            <input v-model="search" class="form-control" maxlength="100" aria-label="Cari user" placeholder="Cari nama atau username..." :disabled="busy" />

            <button class="btn" type="submit" :disabled="busy">Cari</button>
          </form>
        </div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>No</th>

                <th v-for="column in sortColumns" :key="column.key" :aria-sort="sortBy === column.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'">
                  <button type="button" class="btn btn-link p-0 text-reset" :disabled="busy" @click="sort(column.key)">
                    {{ column.label }}
                    <span v-if="sortBy === column.key" aria-hidden="true">
                      {{ sortOrder === "asc" ? "↑" : "↓" }}
                    </span>
                  </button>
                </th>

                <th>Role</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="text-center py-4">Memuat user...</td>
              </tr>

              <template v-else>
                <tr v-for="(item, index) in users" :key="item.id">
                  <td>{{ (page - 1) * 10 + index + 1 }}</td>
                  <td>{{ item.nama }}</td>
                  <td>{{ item.username }}</td>

                  <td>
                    <span :class="item.disabled ? 'text-danger' : 'text-success'" :aria-label="item.disabled ? 'Nonaktif' : 'Aktif'">
                      {{ item.disabled ? "✕ Nonaktif" : "✓ Aktif" }}
                    </span>
                  </td>

                  <td>{{ item.nama_role }}</td>

                  <td>
                    <div class="d-flex flex-wrap gap-2">
                      <button type="button" class="btn btn-sm" :disabled="busy" @click="openForm(item.id)">Edit</button>

                      <button type="button" class="btn btn-sm" :disabled="busy || Number(item.id) === Number(currentUser?.id)" @click="changeStatus(item)">
                        {{ item.disabled ? "Aktifkan" : "Nonaktifkan" }}
                      </button>

                      <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy || Number(item.id) === Number(currentUser?.id)" @click="removeUser(item)">Hapus</button>
                    </div>
                  </td>
                </tr>

                <tr v-if="!users.length">
                  <td colspan="6" class="text-center py-4">Tidak ada user.</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="card-footer d-flex justify-content-between align-items-center">
          <span>{{ pagination.total || 0 }} user</span>

          <div class="d-flex gap-2 align-items-center">
            <button type="button" class="btn" :disabled="busy || page <= 1" @click="changePage(page - 1)">Sebelumnya</button>

            <span>{{ page }}</span>

            <button type="button" class="btn" :disabled="busy || page >= Number(pagination.totalPages || 0)" @click="changePage(page + 1)">Berikutnya</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
