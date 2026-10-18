<script setup>
import { IconUsers, IconHourglassEmpty, IconFileDescription, IconBackpack } from "@tabler/icons-vue";

import { displayDate } from "~/utils/employeeDate.js";

definePageMeta({ title: "Dashboard" });
useSeoMeta({ title: "Dashboard" });

const { request } = useApi();
const { user, fetchMe } = useAuth();

const dashboard = ref(null);
const loading = ref(false);
const error = ref("");

let version = 0;
let mounted = false;

const greetingName = computed(() => user.value?.nama || user.value?.username || "Pengguna");

const displayRole = computed(() => user.value?.nama_role || "Pengguna");

const isManagerHRD = computed(
  () =>
    String(user.value?.nama_role || "")
      .trim()
      .toLowerCase() === "manager hrd",
);

const statistics = computed(() => [
  {
    title: "Total Pegawai",
    value: dashboard.value?.total_pegawai || 0,
    icon: IconUsers,
    color: "#4A7BB2",
  },
  {
    title: "Pegawai Kontrak (PKWT)",
    value: dashboard.value?.berdasarkan_kontrak?.PKWT || 0,
    icon: IconHourglassEmpty,
    color: "#D4A94D",
  },
  {
    title: "Pegawai Tetap (PKWTT)",
    value: dashboard.value?.berdasarkan_kontrak?.PKWTT || 0,
    icon: IconFileDescription,
    color: "#1DA17D",
  },
  {
    title: "Peserta Magang",
    value: dashboard.value?.berdasarkan_kontrak?.Magang || 0,
    icon: IconBackpack,
    color: "#CD795D",
  },
]);

const contractSeries = computed(() => {
  const data = dashboard.value?.berdasarkan_kontrak;

  return [Number(data?.PKWT || 0), Number(data?.PKWTT || 0), Number(data?.Magang || 0), Number(data?.belum_diisi || 0)];
});

const genderSeries = computed(() => {
  const data = dashboard.value?.berdasarkan_gender;

  return [Number(data?.laki_laki || 0), Number(data?.perempuan || 0), Number(data?.belum_diisi || 0)];
});

const contractOptions = {
  chart: { type: "donut" },
  labels: ["PKWT", "PKWTT", "Magang", "Belum Diisi"],
  colors: ["#5480C7", "#2B508E", "#FE7E00", "#A0A0A0"],
  legend: { position: "bottom" },
  dataLabels: { enabled: true },
};

const genderOptions = {
  chart: { type: "donut" },
  labels: ["Laki-laki", "Perempuan", "Belum Diisi"],
  colors: ["#2B508E", "#FE7E00", "#A0A0A0"],
  legend: { position: "bottom" },
  dataLabels: { enabled: true },
};

async function loadDashboard() {
  const requestVersion = ++version;

  error.value = "";

  if (!isManagerHRD.value) {
    dashboard.value = null;
    loading.value = false;
    return;
  }

  loading.value = true;

  try {
    const response = await request("/dashboard/hrd");

    if (requestVersion !== version) return;
    dashboard.value = response.data;
  } catch (value) {
    if (requestVersion !== version) return;

    dashboard.value = null;
    error.value = value?.data?.message || "Gagal memuat dashboard.";
  } finally {
    if (requestVersion === version) {
      loading.value = false;
    }
  }
}

watch(
  () => [user.value?.id, user.value?.nama_role],
  () => {
    if (mounted) void loadDashboard();
  },
);

onMounted(async () => {
  try {
    if (!user.value) await fetchMe();

    mounted = true;
    await loadDashboard();
  } catch (value) {
    error.value = value?.data?.message || "Gagal memuat sesi pengguna.";
  }
});

onBeforeUnmount(() => {
  mounted = false;
  version++;
});
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}

      <button v-if="isManagerHRD" type="button" class="btn btn-sm ms-2" :disabled="loading" @click="loadDashboard">Coba Lagi</button>
    </div>

    <div v-if="!isManagerHRD" class="card">
      <div class="card-body py-5 text-center">
        <h2 class="mb-0">Selamat Datang {{ greetingName }} - {{ displayRole }}</h2>
      </div>
    </div>

    <div v-else-if="loading" class="text-center py-5" role="status">Memuat dashboard...</div>

    <div v-else-if="dashboard" class="row g-3">
      <div class="col-md-3">
        <div class="card bg-dark h-100">
          <div class="card-body text-center">
            <img src="~/assets/images/greeting-img.svg" alt="" class="img-fluid mb-4" />

            <h3 class="text-white">Halo, selamat datang {{ greetingName }}</h3>

            <p class="text-white mb-0">Kelola data kepegawaian dengan mudah dan efisien.</p>
          </div>
        </div>
      </div>

      <div class="col-md-9">
        <div class="row g-3">
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <div class="row g-3">
                  <div v-for="item in statistics" :key="item.title" class="col-md-6 col-xl-3">
                    <div class="d-flex gap-3 align-items-center">
                      <div
                        class="rounded-circle d-flex flex-shrink-0"
                        :style="{
                          width: '52px',
                          height: '52px',
                          background: item.color,
                        }"
                      >
                        <component :is="item.icon" class="m-auto text-white" aria-hidden="true" />
                      </div>

                      <div>
                        <h3 class="mb-1">{{ item.value }}</h3>
                        <p class="text-secondary mb-0">
                          {{ item.title }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-body">
                <h3 class="card-title">Status Kontrak Pegawai</h3>

                <ClientOnly>
                  <apexchart v-if="contractSeries.some((value) => value > 0)" type="donut" height="240" :options="contractOptions" :series="contractSeries" />

                  <p v-else class="text-secondary text-center py-4">Belum ada data.</p>
                </ClientOnly>
              </div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-body">
                <h3 class="card-title">Jenis Kelamin Pegawai</h3>

                <ClientOnly>
                  <apexchart v-if="genderSeries.some((value) => value > 0)" type="donut" height="240" :options="genderOptions" :series="genderSeries" />

                  <p v-else class="text-secondary text-center py-4">Belum ada data.</p>
                </ClientOnly>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">5 Pegawai Terbaru</h3>

            <button type="button" class="btn btn-sm ms-auto" :disabled="loading" @click="loadDashboard">Refresh</button>
          </div>

          <div class="table-responsive">
            <table class="table table-vcenter card-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Tanggal Masuk</th>
                  <th>Status Kontrak</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="(employee, index) in dashboard.pegawai_terbaru" :key="employee.id">
                  <td>{{ index + 1 }}</td>
                  <td>{{ employee.nip }}</td>

                  <td>
                    {{ employee.nama_pegawai }}
                    <small class="d-block text-secondary">
                      {{ employee.nama_jabatan || "-" }}
                    </small>
                  </td>

                  <td>
                    {{ displayDate(employee.tanggal_masuk) || "-" }}
                  </td>

                  <td>{{ employee.status_kontrak || "-" }}</td>

                  <td>
                    <NuxtLink :to="`/pegawai/${employee.id}`" class="btn btn-sm btn-primary"> Detail Pegawai </NuxtLink>
                  </td>
                </tr>

                <tr v-if="!dashboard.pegawai_terbaru?.length">
                  <td colspan="6" class="text-center py-4">Belum ada data pegawai.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
