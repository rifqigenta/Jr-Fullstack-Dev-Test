<script setup>
definePageMeta({ title: "Tunjangan Transport" });

const { request } = useApi();
const now = new Date();

const tahun = ref(now.getFullYear());
const bulan = ref(now.getMonth() + 1);
const page = ref(1);
const search = ref("");
const keyword = ref("");

const rows = ref([]);
const pagination = ref({});
const myAllowance = ref(null);
const loading = ref(false);
const processing = ref(false);
const error = ref("");
const message = ref("");
const adminMode = ref(false);

const attendance = reactive({
  id_pegawai: "",
  jumlah_hari_masuk: 20,
});

const employees = ref([]);

const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

async function loadData() {
  loading.value = true;
  error.value = "";

  const query = {
    tahun: Number(tahun.value),
    bulan: Number(bulan.value),
  };

  try {
    const res = await request("/transport/history", {
      query: {
        ...query,
        page: page.value,
        limit: 10,
        search: keyword.value,
      },
    });

    adminMode.value = true;
    rows.value = res.data || [];
    pagination.value = res.pagination || {};
    myAllowance.value = null;
  } catch (e) {
    const status = e?.statusCode || e?.status;

    if (status === 403) {
      adminMode.value = false;
      rows.value = [];
      pagination.value = {};

      try {
        const res = await request("/transport/me", { query });
        myAllowance.value = res.data;
      } catch (myError) {
        error.value = myError?.data?.message || "Gagal mengambil tunjangan.";
      }
    } else {
      error.value = e?.data?.message || "Gagal mengambil riwayat transport.";
    }
  } finally {
    loading.value = false;
  }
}

async function loadEmployees() {
  try {
    const res = await request("/employees", {
      query: { page: 1, limit: 100 },
    });
    employees.value = res.data || [];
  } catch {
    employees.value = [];
  }
}

async function saveAttendance() {
  if (!attendance.id_pegawai) {
    error.value = "Pilih pegawai terlebih dahulu.";
    return;
  }

  processing.value = true;
  error.value = "";
  message.value = "";

  try {
    const res = await request("/transport/attendance", {
      method: "PUT",
      body: {
        id_pegawai: Number(attendance.id_pegawai),
        tahun: Number(tahun.value),
        bulan: Number(bulan.value),
        jumlah_hari_masuk: Number(attendance.jumlah_hari_masuk),
      },
    });

    message.value = res.message || "Kehadiran berhasil disimpan.";
  } catch (e) {
    error.value = e?.data?.message || "Gagal menyimpan kehadiran.";
  } finally {
    processing.value = false;
  }
}

async function calculate() {
  if (!confirm(`Hitung ulang tunjangan ${months[bulan.value - 1]} ${tahun.value}?`)) return;

  processing.value = true;
  error.value = "";
  message.value = "";

  try {
    const res = await request("/transport/calculate", {
      method: "POST",
      body: {
        tahun: Number(tahun.value),
        bulan: Number(bulan.value),
      },
    });

    message.value = `${res.data?.calculated_count ?? 0} pegawai dihitung. ` + `Total: ${rupiah(res.data?.total_nominal)}`;

    await loadData();
  } catch (e) {
    error.value = e?.data?.message || "Perhitungan gagal.";
  } finally {
    processing.value = false;
  }
}

function applyFilter() {
  page.value = 1;
  keyword.value = search.value.trim();
  loadData();
}

function changePage(next) {
  if (next < 1 || next > (pagination.value.totalPages || 1)) return;
  page.value = next;
  loadData();
}

onMounted(async () => {
  await loadData();
  if (adminMode.value) await loadEmployees();
});
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0">Tunjangan Transport</h2>

      <NuxtLink v-if="adminMode" to="/tunjangan/transport/settings" class="btn btn-primary"> Pengaturan Tarif </NuxtLink>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="message" class="alert alert-success">{{ message }}</div>

    <div class="card mb-3">
      <div class="card-body">
        <form class="row g-2 align-items-end" @submit.prevent="applyFilter">
          <div class="col-md-3">
            <label class="form-label">Tahun</label>
            <input v-model.number="tahun" type="number" min="2000" max="2100" class="form-control" required />
          </div>

          <div class="col-md-3">
            <label class="form-label">Bulan</label>
            <select v-model.number="bulan" class="form-select">
              <option v-for="(name, index) in months" :key="index" :value="index + 1">
                {{ name }}
              </option>
            </select>
          </div>

          <div v-if="adminMode" class="col-md-4">
            <label class="form-label">Cari Pegawai</label>
            <input v-model="search" class="form-control" placeholder="Nama atau NIP" />
          </div>

          <div class="col-md-2">
            <button class="btn btn-primary w-100" type="submit">Tampilkan</button>
          </div>
        </form>
      </div>
    </div>

    <template v-if="adminMode">
      <div class="card mb-3">
        <div class="card-header">
          <h3 class="card-title">Input Kehadiran Bulanan</h3>
        </div>

        <form @submit.prevent="saveAttendance">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-8">
                <label class="form-label">Pegawai</label>
                <select v-model="attendance.id_pegawai" class="form-select" required>
                  <option value="">Pilih Pegawai</option>
                  <option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.nip }} - {{ employee.nama_pegawai }}</option>
                </select>
              </div>

              <div class="col-md-4">
                <label class="form-label">Jumlah Hari Masuk</label>
                <input v-model.number="attendance.jumlah_hari_masuk" type="number" min="0" max="31" class="form-control" required />
              </div>
            </div>
          </div>

          <div class="card-footer d-flex justify-content-end gap-2">
            <button class="btn btn-outline-primary" type="submit" :disabled="processing">Simpan Kehadiran</button>

            <button class="btn btn-success" type="button" :disabled="processing" @click="calculate">Hitung Tunjangan Bulan Ini</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Riwayat Tunjangan Pegawai</h3>
        </div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>No</th>
                <th>NIP</th>
                <th>Nama Pegawai</th>
                <th>Jarak Dihitung</th>
                <th>Hari Masuk</th>
                <th>Tarif</th>
                <th>Nominal</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="text-center">Memuat...</td>
              </tr>

              <tr v-for="(item, i) in rows" :key="item.id">
                <td>{{ (page - 1) * 10 + i + 1 }}</td>
                <td>{{ item.nip }}</td>
                <td>{{ item.nama_pegawai }}</td>
                <td>{{ item.jarak_dihitung_km }} km</td>
                <td>{{ item.jumlah_hari_masuk }}</td>
                <td>{{ rupiah(item.base_fare) }}</td>
                <td class="fw-semibold">{{ rupiah(item.nominal) }}</td>
              </tr>

              <tr v-if="!loading && rows.length === 0">
                <td colspan="7" class="text-center">Belum ada perhitungan untuk periode ini.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card-footer d-flex justify-content-between">
          <span>{{ pagination.total || 0 }} data</span>

          <div class="btn-list">
            <button class="btn btn-sm" :disabled="page <= 1" @click="changePage(page - 1)">Sebelumnya</button>

            <span class="align-self-center">{{ page }}</span>

            <button class="btn btn-sm" :disabled="page >= (pagination.totalPages || 1)" @click="changePage(page + 1)">Berikutnya</button>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="card">
      <div class="card-header">
        <h3 class="card-title">Tunjangan Transport Saya</h3>
      </div>

      <div class="card-body">
        <div v-if="loading">Memuat...</div>

        <div v-else-if="myAllowance">
          <div class="text-secondary">Nominal Tunjangan</div>
          <h1>{{ rupiah(myAllowance.nominal) }}</h1>

          <p>Hari masuk: {{ myAllowance.jumlah_hari_masuk }}</p>
          <p>Jarak dihitung: {{ myAllowance.jarak_dihitung_km }} km</p>
          <p>Tarif dasar: {{ rupiah(myAllowance.base_fare) }}</p>
        </div>

        <div v-else class="text-secondary">Belum ada tunjangan untuk periode ini.</div>
      </div>
    </div>
  </div>
</template>
