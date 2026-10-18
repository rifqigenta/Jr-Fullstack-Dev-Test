<script setup>
definePageMeta({
  title: "Data Pegawai",
  layout: false,
});

useSeoMeta({ title: "Data Pegawai" });

const { request } = useApi();
const { user, fetchMe } = useAuth();
const { downloadFile } = useDownload();

const employees = ref([]);
const positions = ref([]);
const pagination = ref({
  total: 0,
  totalPages: 0,
});

const page = ref(1);
const limit = 10;
const sortBy = ref("id");
const sortOrder = ref("desc");

const loading = ref(false);
const processing = ref(false);
const downloading = ref(false);

const error = ref("");
const message = ref("");

const selectedIds = ref([]);
const bulkStatus = ref("");

const filters = reactive({
  search: "",
  positionIds: [],
  minTenure: "",
  maxTenure: "",
  contract: "",
});

const appliedFilters = ref({});

let loadVersion = 0;

const canManage = computed(
  () =>
    String(user.value?.nama_role || "")
      .trim()
      .toLowerCase() === "admin hrd",
);

const busy = computed(() => loading.value || processing.value || downloading.value);

const allSelected = computed(() => employees.value.length > 0 && employees.value.every((employee) => selectedIds.value.includes(employee.id)));

const partiallySelected = computed(() => selectedIds.value.length > 0 && !allSelected.value);

const columns = [
  { key: "nip", label: "NIP" },
  { key: "nama_pegawai", label: "Nama" },
  { key: "nama_jabatan", label: "Jabatan" },
  { key: "tanggal_masuk", label: "Tanggal Masuk" },
  { key: "masa_kerja", label: "Masa Kerja" },
];

function exportQuery() {
  return {
    ...appliedFilters.value,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  };
}

function formatDate(value) {
  if (!value) return "-";

  const [year, month, day] = String(value).slice(0, 10).split("-");

  return `${day}/${month}/${year}`;
}

function errorMessage(value, fallback) {
  const data = value?.data;

  const fieldErrors = data?.errors?.fieldErrors;

  const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat().find(Boolean) : null;

  return firstFieldError || data?.message || value?.message || fallback;
}

function clearSelection() {
  selectedIds.value = [];
  bulkStatus.value = "";
}

function toggleAll(event) {
  selectedIds.value = event.target.checked ? employees.value.map((employee) => employee.id) : [];
}

async function loadEmployees() {
  const version = ++loadVersion;

  loading.value = true;
  clearSelection();

  try {
    const response = await request("/employees", {
      query: {
        ...exportQuery(),
        page: page.value,
        limit,
      },
    });

    if (version !== loadVersion) return;

    const resultPagination = response.pagination || {};
    const totalPages = Number(resultPagination.totalPages || 0);

    if (page.value > Math.max(1, totalPages)) {
      page.value = Math.max(1, totalPages);
      await loadEmployees();
      return;
    }

    employees.value = response.data || [];
    pagination.value = resultPagination;
  } catch (value) {
    if (version !== loadVersion) return;

    employees.value = [];
    pagination.value = { total: 0, totalPages: 0 };

    error.value = errorMessage(value, "Gagal mengambil data pegawai.");
  } finally {
    if (version === loadVersion) {
      loading.value = false;
    }
  }
}

async function applyFilters() {
  error.value = "";
  message.value = "";

  const min = filters.minTenure === "" ? undefined : Number(filters.minTenure);

  const max = filters.maxTenure === "" ? undefined : Number(filters.maxTenure);

  if ([min, max].some((value) => value !== undefined && (!Number.isInteger(value) || value < 0 || value > 200))) {
    error.value = "Masa kerja harus bilangan bulat antara 0–200.";
    return;
  }

  if (min !== undefined && max !== undefined && min > max) {
    error.value = "Masa kerja maksimum harus minimal sebesar minimum.";
    return;
  }

  appliedFilters.value = {
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),

    ...(filters.positionIds.length ? { id_jabatan_in: filters.positionIds.join(",") } : {}),

    ...(min !== undefined ? { masa_kerja_min: min } : {}),
    ...(max !== undefined ? { masa_kerja_max: max } : {}),

    ...(filters.contract ? { status_kontrak: filters.contract } : {}),
  };

  page.value = 1;
  await loadEmployees();
}

async function resetFilters() {
  filters.search = "";
  filters.positionIds = [];
  filters.minTenure = "";
  filters.maxTenure = "";
  filters.contract = "";

  await applyFilters();
}

async function changeSort(key) {
  if (busy.value) return;

  error.value = "";
  message.value = "";

  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = key;
    sortOrder.value = "asc";
  }

  page.value = 1;
  await loadEmployees();
}

async function changePage(nextPage) {
  const totalPages = Number(pagination.value.totalPages || 0);

  if (busy.value || nextPage < 1 || nextPage > totalPages) {
    return;
  }

  error.value = "";
  message.value = "";
  page.value = nextPage;

  await loadEmployees();
}

async function updateSelectedStatus() {
  if (!canManage.value || !selectedIds.value.length || !bulkStatus.value || busy.value) {
    return;
  }

  processing.value = true;
  error.value = "";
  message.value = "";

  try {
    const response = await request("/employees/bulk/status", {
      method: "PATCH",
      body: {
        ids: [...selectedIds.value],
        status: bulkStatus.value,
      },
    });

    message.value = response.message || "Status pegawai berhasil diperbarui.";

    await loadEmployees();
  } catch (value) {
    error.value = errorMessage(value, "Gagal memperbarui status pegawai.");
  } finally {
    processing.value = false;
  }
}

async function deleteSelected() {
  if (!canManage.value || !selectedIds.value.length || busy.value) {
    return;
  }

  if (!window.confirm(`Hapus ${selectedIds.value.length} pegawai yang dipilih?`)) {
    return;
  }

  processing.value = true;
  error.value = "";
  message.value = "";

  try {
    const response = await request("/employees/bulk/delete", {
      method: "POST",
      body: {
        ids: [...selectedIds.value],
      },
    });

    message.value = response.message || "Pegawai berhasil dihapus.";

    await loadEmployees();
  } catch (value) {
    error.value = errorMessage(value, "Gagal menghapus pegawai.");
  } finally {
    processing.value = false;
  }
}

async function exportList(format) {
  if (busy.value) return;

  downloading.value = true;
  error.value = "";
  message.value = "";

  try {
    await downloadFile(`/employees/export/${format}`, format === "excel" ? "data-pegawai.xlsx" : "data-pegawai.pdf", exportQuery());

    message.value = "File berhasil disiapkan untuk diunduh.";
  } catch (value) {
    error.value = errorMessage(value, "Gagal mengunduh daftar pegawai.");
  } finally {
    downloading.value = false;
  }
}

async function exportDetail(employee) {
  if (busy.value) return;

  downloading.value = true;
  error.value = "";
  message.value = "";

  try {
    await downloadFile(`/employees/${employee.id}/pdf`, `pegawai-${employee.id}.pdf`);

    message.value = "PDF detail berhasil disiapkan untuk diunduh.";
  } catch (value) {
    error.value = errorMessage(value, "Gagal mengunduh detail pegawai.");
  } finally {
    downloading.value = false;
  }
}

onMounted(async () => {
  loading.value = true;

  try {
    if (!user.value) {
      await fetchMe();
    }

    const response = await request("/master-data/positions");
    positions.value = response.data || [];

    await loadEmployees();
  } catch (value) {
    error.value = errorMessage(value, "Gagal memuat halaman pegawai.");
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  loadVersion++;
});
</script>

<template>
  <NuxtLayout name="default">
    <template #actions>
      <NuxtLink v-if="canManage" to="/pegawai/form" class="btn btn-primary"> Tambah Pegawai </NuxtLink>
    </template>

    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <div v-if="message" class="alert alert-success" role="status">
      {{ message }}
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <form @submit.prevent="applyFilters">
          <fieldset :disabled="busy">
            <div class="row g-3">
              <div class="col-md-6">
                <label for="employee-search" class="form-label"> Cari Pegawai </label>

                <input id="employee-search" v-model="filters.search" class="form-control" maxlength="100" placeholder="Nama, NIP, atau jabatan" />
              </div>

              <div class="col-md-6">
                <label for="employee-contract" class="form-label"> Status Kontrak </label>

                <select id="employee-contract" v-model="filters.contract" class="form-select">
                  <option value="">Semua Kontrak</option>
                  <option value="PKWTT">PKWTT</option>
                  <option value="PKWT">PKWT</option>
                  <option value="Magang">Magang</option>
                </select>
              </div>

              <div class="col-md-6">
                <label for="employee-positions" class="form-label"> Jabatan </label>

                <select id="employee-positions" v-model="filters.positionIds" multiple size="3" class="form-select">
                  <option v-for="position in positions" :key="position.id" :value="position.id">
                    {{ position.nama }}
                  </option>
                </select>

                <div class="form-hint">Pilih beberapa jabatan dengan Ctrl/Cmd + klik. Kosong berarti semua jabatan.</div>
              </div>

              <div class="col-md-3">
                <label for="tenure-min" class="form-label"> Masa Kerja Min (Tahun) </label>

                <input id="tenure-min" v-model="filters.minTenure" type="number" min="0" max="200" step="1" class="form-control" placeholder="0" />
              </div>

              <div class="col-md-3">
                <label for="tenure-max" class="form-label"> Masa Kerja Max (Tahun) </label>

                <input id="tenure-max" v-model="filters.maxTenure" type="number" min="0" max="200" step="1" class="form-control" placeholder="5" />
              </div>
            </div>

            <div class="d-flex gap-2 mt-3">
              <button type="submit" class="btn btn-primary">Terapkan</button>

              <button type="button" class="btn" @click="resetFilters">Reset Filter</button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-header d-flex flex-wrap gap-2">
        <h3 class="card-title me-auto">Daftar Pegawai</h3>

        <button type="button" class="btn" :disabled="busy" @click="exportList('pdf')">Download PDF</button>

        <button type="button" class="btn" :disabled="busy" @click="exportList('excel')">Download Excel</button>
      </div>

      <div v-if="canManage && selectedIds.length" class="card-body border-bottom">
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <span>{{ selectedIds.length }} pegawai dipilih</span>

          <label for="bulk-status" class="visually-hidden"> Status pegawai terpilih </label>

          <select id="bulk-status" v-model="bulkStatus" class="form-select" style="width: 180px" :disabled="busy">
            <option value="">Pilih status</option>
            <option value="Aktif">Aktif</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>

          <button type="button" class="btn btn-primary" :disabled="busy || !bulkStatus" @click="updateSelectedStatus">Terapkan Status</button>

          <button type="button" class="btn btn-danger" :disabled="busy" @click="deleteSelected">Hapus Terpilih</button>

          <button type="button" class="btn" :disabled="busy" @click="clearSelection">Batal Pilih</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead>
            <tr>
              <th v-if="canManage">
                <input
                  type="checkbox"
                  class="form-check-input"
                  aria-label="Pilih semua pegawai di halaman ini"
                  :checked="allSelected"
                  :indeterminate="partiallySelected"
                  :disabled="busy || !employees.length"
                  @change="toggleAll"
                />
              </th>

              <th>No</th>

              <th v-for="column in columns" :key="column.key" :aria-sort="sortBy === column.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="btn btn-link p-0 text-reset" :disabled="busy" @click="changeSort(column.key)">
                  {{ column.label }}

                  <span v-if="sortBy === column.key" aria-hidden="true">
                    {{ sortOrder === "asc" ? "↑" : "↓" }}
                  </span>
                </button>
              </th>

              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td :colspan="canManage ? 9 : 8" class="text-center py-4">Memuat data...</td>
            </tr>

            <tr v-else-if="!employees.length">
              <td :colspan="canManage ? 9 : 8" class="text-center py-4">Tidak ada data pegawai.</td>
            </tr>

            <template v-else>
              <tr v-for="(employee, index) in employees" :key="employee.id">
                <td v-if="canManage">
                  <input v-model="selectedIds" type="checkbox" class="form-check-input" :value="employee.id" :aria-label="`Pilih ${employee.nama_pegawai}`" :disabled="busy" />
                </td>

                <td>{{ (page - 1) * limit + index + 1 }}</td>
                <td>{{ employee.nip }}</td>
                <td>{{ employee.nama_pegawai }}</td>
                <td>{{ employee.nama_jabatan || "-" }}</td>
                <td>{{ formatDate(employee.tanggal_masuk) }}</td>
                <td>{{ employee.masa_kerja }} tahun</td>

                <td>
                  <span class="badge" :class="employee.status === 'Aktif' ? 'bg-success-lt' : 'bg-secondary-lt'">
                    {{ employee.status }}
                  </span>
                </td>

                <td>
                  <div class="d-flex flex-wrap gap-2">
                    <NuxtLink :to="`/pegawai/${employee.id}`" class="btn btn-sm"> Detail </NuxtLink>

                    <NuxtLink v-if="canManage" :to="`/pegawai/form/${employee.id}`" class="btn btn-sm"> Edit </NuxtLink>

                    <button type="button" class="btn btn-sm" :disabled="busy" @click="exportDetail(employee)">PDF</button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="card-footer d-flex flex-wrap gap-2 align-items-center justify-content-between">
        <span class="text-secondary">
          Halaman {{ page }} dari
          {{ Math.max(1, Number(pagination.totalPages || 0)) }}
          · {{ pagination.total || 0 }} pegawai
        </span>

        <div class="d-flex gap-2">
          <button type="button" class="btn" :disabled="busy || page <= 1" @click="changePage(page - 1)">Sebelumnya</button>

          <button type="button" class="btn" :disabled="busy || page >= Number(pagination.totalPages || 0)" @click="changePage(page + 1)">Berikutnya</button>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>
