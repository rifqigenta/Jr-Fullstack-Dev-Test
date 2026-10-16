<script setup>
import { IconSearch } from "@tabler/icons-vue";

definePageMeta({
  title: "Log Aktivitas",
});

useSeoMeta({
  title: "Log Aktivitas",
});

const { request } = useApi();

const logs = ref([]);
const loading = ref(false);
const error = ref("");

const searchInput = ref("");
const keyword = ref("");

const startDate = ref("");
const endDate = ref("");

const page = ref(1);
const limit = 10;

const pagination = ref({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
});

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getUsername(item) {
  return item.nama_pengguna || item.username || "Sistem";
}

async function loadLogs() {
  loading.value = true;
  error.value = "";

  try {
    const query = {
      page: page.value,
      limit,
      search: keyword.value,
    };

    if (startDate.value) {
      query.start_date = startDate.value;
    }

    if (endDate.value) {
      query.end_date = endDate.value;
    }

    const response = await request("/activities", {
      query,
    });

    logs.value = Array.isArray(response.data) ? response.data : [];

    pagination.value = response.pagination || {
      page: 1,
      limit,
      total: logs.value.length,
      totalPages: 1,
    };
  } catch (e) {
    error.value = e?.data?.message || "Gagal mengambil log aktivitas.";

    logs.value = [];
  } finally {
    loading.value = false;
  }
}

function applyFilter() {
  if (startDate.value && endDate.value && startDate.value > endDate.value) {
    error.value = "Tanggal akhir tidak boleh sebelum tanggal awal.";
    return;
  }

  page.value = 1;
  keyword.value = searchInput.value.trim();

  loadLogs();
}

function resetFilter() {
  searchInput.value = "";
  keyword.value = "";
  startDate.value = "";
  endDate.value = "";
  page.value = 1;

  loadLogs();
}

function changePage(nextPage) {
  if (nextPage < 1 || nextPage > pagination.value.totalPages) {
    return;
  }

  page.value = nextPage;
  loadLogs();
}

const visiblePages = computed(() => {
  const total = pagination.value.totalPages;

  const start = Math.max(1, page.value - 2);
  const end = Math.min(total, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
});

onMounted(loadLogs);
</script>

<template>
  <div class="card">
    <!-- Filter -->
    <div class="card-header">
      <form class="d-flex gap-2 flex-wrap ms-auto align-items-end" @submit.prevent="applyFilter">
        <div>
          <label class="form-label">Dari Tanggal</label>
          <input v-model="startDate" type="date" class="form-control" />
        </div>

        <div>
          <label class="form-label">Sampai Tanggal</label>
          <input v-model="endDate" type="date" class="form-control" />
        </div>

        <div>
          <label class="form-label">Cari Data</label>

          <div class="input-group">
            <input v-model="searchInput" type="text" class="form-control" placeholder="Cari aktivitas..." />

            <button class="btn btn-primary" type="submit" :disabled="loading">
              <IconSearch :size="18" />
            </button>
          </div>
        </div>

        <button type="button" class="btn" @click="resetFilter">Reset</button>
      </form>
    </div>

    <!-- Error -->
    <div v-if="error" class="alert alert-danger m-3">
      {{ error }}

      <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="loadLogs">Coba Lagi</button>
    </div>

    <!-- Table -->
    <div class="table-responsive card-body p-0">
      <table class="table table-vcenter">
        <thead>
          <tr>
            <th width="5">No</th>
            <th>Nama User</th>
            <th>Modul / Aktivitas</th>
            <th>Aksi / Detail</th>
            <th>Timestamp</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="text-center py-4">Memuat log aktivitas...</td>
          </tr>

          <tr v-for="(item, index) in logs" :key="item.id">
            <td class="text-center">
              {{ (page - 1) * limit + index + 1 }}
            </td>

            <td>
              <div class="fw-semibold">
                {{ getUsername(item) }}
              </div>

              <div v-if="item.nama_pengguna && item.username" class="text-secondary small">
                {{ item.username }}
              </div>
            </td>

            <td>
              {{ item.title || "-" }}
            </td>

            <td>
              <span class="text-secondary">
                {{ item.content || "-" }}
              </span>
            </td>

            <td>
              {{ formatDateTime(item.created_at) }}
            </td>
          </tr>

          <tr v-if="!loading && !error && logs.length === 0">
            <td colspan="5" class="text-center py-4 text-secondary">Belum ada log aktivitas.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="card-footer d-flex align-items-center flex-wrap gap-2">
      <span class="text-secondary"> Total {{ pagination.total }} aktivitas </span>

      <ul class="pagination ms-auto m-0">
        <li class="page-item" :class="{ disabled: page <= 1 }">
          <button type="button" class="page-link" :disabled="page <= 1 || loading" @click="changePage(page - 1)">Sebelumnya</button>
        </li>

        <li v-for="pageNumber in visiblePages" :key="pageNumber" class="page-item" :class="{ active: page === pageNumber }">
          <button type="button" class="page-link" :disabled="loading" @click="changePage(pageNumber)">
            {{ pageNumber }}
          </button>
        </li>

        <li
          class="page-item"
          :class="{
            disabled: page >= pagination.totalPages,
          }"
        >
          <button type="button" class="page-link" :disabled="page >= pagination.totalPages || loading" @click="changePage(page + 1)">Berikutnya</button>
        </li>
      </ul>
    </div>
  </div>
</template>
