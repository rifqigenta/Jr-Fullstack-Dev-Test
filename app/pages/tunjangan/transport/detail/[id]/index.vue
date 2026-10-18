<script setup>
import AttendanceForm from "~/features/Tunjangan/components/AttendanceForm.vue";

import { formatRupiah } from "~/utils/formatRupiah.js";

definePageMeta({ title: "Detail Tunjangan Transport" });

const route = useRoute();
const { request } = useApi();
const { user } = useAuth();

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const tahun = computed(() => Number(route.query.tahun));
const bulan = computed(() => Number(route.params.id));

const validPeriod = computed(() => Number.isInteger(tahun.value) && tahun.value >= 2000 && tahun.value <= 2100 && Number.isInteger(bulan.value) && bulan.value >= 1 && bulan.value <= 12);

const title = computed(() => (validPeriod.value ? `${monthNames[bulan.value - 1]} ${tahun.value}` : "Periode tidak valid"));

const isAdmin = computed(
  () =>
    String(user.value?.nama_role || "")
      .trim()
      .toLowerCase() === "admin hrd",
);

const rows = ref([]);
const ownAllowance = ref(null);
const pagination = ref({});
const page = ref(1);

const search = ref("");
const keyword = ref("");
const sortBy = ref("nama");
const sortOrder = ref("asc");

const loading = ref(false);
const calculating = ref(false);
const attendanceBusy = ref(false);

const error = ref("");
const message = ref("");
const attendanceChanged = ref(false);

let version = 0;
let mounted = false;

const busy = computed(() => loading.value || calculating.value || attendanceBusy.value);

const columns = [
  { key: "nama", label: "Nama Penerima" },
  { key: "km", label: "Km" },
  { key: "hari", label: "Hari" },
  { key: "nominal", label: "Nominal" },
];

function getError(value) {
  const fields = value?.data?.errors?.fieldErrors;

  return (fields ? Object.values(fields).flat().filter(Boolean).join(" ") : "") || value?.data?.message || value?.message || "Terjadi kesalahan.";
}

async function load() {
  const requestVersion = ++version;

  error.value = "";

  if (!validPeriod.value) {
    rows.value = [];
    ownAllowance.value = null;
    error.value = "Bulan atau tahun pada URL tidak valid.";
    return;
  }

  loading.value = true;

  try {
    const period = {
      tahun: tahun.value,
      bulan: bulan.value,
    };

    const [historyResponse, ownResponse] = await Promise.all([
      request("/transport/history", {
        query: {
          ...period,
          page: page.value,
          limit: 10,
          search: keyword.value,
          sortBy: sortBy.value,
          sortOrder: sortOrder.value,
        },
      }),
      request("/transport/me", { query: period }),
    ]);

    if (requestVersion !== version) return;

    rows.value = historyResponse.data || [];
    pagination.value = historyResponse.pagination || {};
    ownAllowance.value = ownResponse.data;
  } catch (value) {
    if (requestVersion !== version) return;

    rows.value = [];
    ownAllowance.value = null;
    error.value = getError(value);
  } finally {
    if (requestVersion === version) {
      loading.value = false;
    }
  }
}

async function calculate() {
  if (!isAdmin.value || busy.value || !validPeriod.value) return;

  if (!window.confirm(`Hitung ulang tunjangan ${title.value} untuk seluruh pegawai?`)) return;

  calculating.value = true;
  error.value = "";
  message.value = "";

  try {
    const response = await request("/transport/calculate", {
      method: "POST",
      body: {
        tahun: tahun.value,
        bulan: bulan.value,
      },
    });

    attendanceChanged.value = false;
    message.value = `${response.message} ` + `${response.data.calculated_count} pegawai diperiksa.`;

    page.value = 1;
    await load();
  } catch (value) {
    error.value = getError(value);
  } finally {
    calculating.value = false;
  }
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
  await load();
}

async function applySearch() {
  if (busy.value) return;

  keyword.value = search.value.trim();
  page.value = 1;
  await load();
}

async function changePage(next) {
  if (busy.value || next < 1 || next > Number(pagination.value.totalPages || 0)) return;

  page.value = next;
  await load();
}

watch(
  () => [route.params.id, route.query.tahun],
  async () => {
    if (!mounted) return;

    page.value = 1;
    message.value = "";
    attendanceChanged.value = false;

    await load();
  },
);

onMounted(async () => {
  mounted = true;
  await load();
});

onBeforeUnmount(() => {
  mounted = false;
  version++;
});
</script>

<template>
  <div>
    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
      <h2 class="mb-0 me-auto">{{ title }}</h2>

      <NuxtLink v-if="!busy" to="/tunjangan/transport" class="btn"> Kembali </NuxtLink>

      <button v-if="isAdmin && validPeriod" type="button" class="btn btn-primary" :disabled="busy" @click="calculate">
        {{ calculating ? "Menghitung..." : "Hitung Tunjangan" }}
      </button>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <div v-if="message" class="alert alert-success" role="status">
      {{ message }}
    </div>

    <div v-if="attendanceChanged" class="alert alert-info" role="status">Kehadiran berubah. Klik Hitung Tunjangan untuk memperbarui hasil.</div>

    <AttendanceForm
      v-if="isAdmin && validPeriod"
      :key="`${tahun}-${bulan}`"
      :tahun="tahun"
      :bulan="bulan"
      :disabled="loading || calculating"
      @busy="attendanceBusy = $event"
      @saved="attendanceChanged = true"
    />

    <div v-if="validPeriod" class="card mb-3">
      <div class="card-body">
        <h3>Tunjangan Saya</h3>

        <p v-if="loading" class="mb-0">Memuat...</p>

        <template v-else-if="ownAllowance">
          <h2>{{ formatRupiah(ownAllowance.nominal) }}</h2>

          <p class="text-secondary mb-0">{{ ownAllowance.jarak_dihitung_km }} km × {{ ownAllowance.jumlah_hari_masuk }} hari × {{ formatRupiah(ownAllowance.base_fare) }}/km</p>

          <p v-if="Number(ownAllowance.nominal) === 0" class="mt-2 mb-0">Hasil perhitungan tidak memenuhi seluruh syarat penerima tunjangan.</p>
        </template>

        <p v-else class="mb-0">Belum ada hasil perhitungan untuk akun ini pada periode tersebut.</p>
      </div>
    </div>

    <div v-if="validPeriod" class="card">
      <div class="card-header d-flex flex-wrap gap-2">
        <h3 class="card-title me-auto">Hasil Perhitungan</h3>

        <form class="input-group" style="max-width: 300px" @submit.prevent="applySearch">
          <input v-model="search" class="form-control" maxlength="100" aria-label="Cari penerima" placeholder="Nama atau NIP" :disabled="busy" />

          <button type="submit" class="btn" :disabled="busy">Cari</button>
        </form>
      </div>

      <div class="card-body border-bottom">Data penerima mengikuti akses tunjangan milik akun login.</div>

      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead>
            <tr>
              <th>No</th>

              <th v-for="column in columns" :key="column.key" :aria-sort="sortBy === column.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="btn btn-link p-0 text-reset" :disabled="busy" @click="sort(column.key)">
                  {{ column.label }}
                  <span v-if="sortBy === column.key">
                    {{ sortOrder === "asc" ? "↑" : "↓" }}
                  </span>
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="text-center py-4">Memuat...</td>
            </tr>

            <template v-else>
              <tr v-for="(row, index) in rows" :key="row.id">
                <td>{{ (page - 1) * 10 + index + 1 }}</td>
                <td>{{ row.nama_pegawai }}</td>
                <td>{{ row.jarak_dihitung_km }}</td>
                <td>{{ row.jumlah_hari_masuk }}</td>
                <td>{{ formatRupiah(row.nominal) }}</td>
              </tr>

              <tr v-if="!rows.length">
                <td colspan="5" class="text-center py-4">Tidak ada penerima sesuai akses dan filter.</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="card-footer d-flex justify-content-between align-items-center">
        <span>{{ pagination.total || 0 }} penerima</span>

        <div class="d-flex gap-2">
          <button type="button" class="btn" :disabled="busy || page <= 1" @click="changePage(page - 1)">Sebelumnya</button>

          <button type="button" class="btn" :disabled="busy || page >= Number(pagination.totalPages || 0)" @click="changePage(page + 1)">Berikutnya</button>
        </div>
      </div>
    </div>
  </div>
</template>
