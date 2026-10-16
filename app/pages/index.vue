<script setup>
import { IconUsers, IconHourglassEmpty, IconFileDescription, IconBackpack, IconRefresh } from "@tabler/icons-vue";

definePageMeta({
  title: "Dashboard",
});

useSeoMeta({
  title: "Dashboard",
});

const { request } = useApi();
const { user } = useAuth();

const dashboard = ref(null);
const loading = ref(false);
const error = ref("");

const greetingName = computed(() => {
  return user.value?.nama_lengkap || user.value?.nama || user.value?.username || "Pengguna";
});

const roleName = computed(() =>
  String(user.value?.nama_role || "")
    .trim()
    .toLowerCase(),
);

const isManagerHRD = computed(() => roleName.value === "manager hrd");

const displayRole = computed(() => user.value?.nama_role || "Pengguna");

const statistics = computed(() => {
  const data = dashboard.value;

  return [
    {
      title: "Total Pegawai",
      value: data?.total_pegawai ?? 0,
      icon: IconUsers,
      background: "linear-gradient(180deg, #549CE3 0%, #4A7BB2 100%)",
    },
    {
      title: "Pegawai Kontrak (PKWT)",
      value: data?.berdasarkan_kontrak?.PKWT ?? 0,
      icon: IconHourglassEmpty,
      background: "linear-gradient(180deg, #EACE5C 0%, #D4A94D 100%)",
    },
    {
      title: "Pegawai Tetap (PKWTT)",
      value: data?.berdasarkan_kontrak?.PKWTT ?? 0,
      icon: IconFileDescription,
      background: "linear-gradient(180deg, #20BF91 0%, #1DA17D 100%)",
    },
    {
      title: "Peserta Magang",
      value: data?.berdasarkan_kontrak?.Magang ?? 0,
      icon: IconBackpack,
      background: "linear-gradient(180deg, #F48968 0%, #CD795D 100%)",
    },
  ];
});

const contractSeries = computed(() => {
  const data = dashboard.value?.berdasarkan_kontrak;

  return [Number(data?.PKWT || 0), Number(data?.PKWTT || 0), Number(data?.Magang || 0), Number(data?.belum_diisi || 0)];
});

const genderSeries = computed(() => {
  const data = dashboard.value?.berdasarkan_gender;

  return [Number(data?.laki_laki || 0), Number(data?.perempuan || 0), Number(data?.belum_diisi || 0)];
});

const contractOptions = {
  chart: { type: "donut", height: 220 },
  labels: ["PKWT", "PKWTT", "Magang", "Belum Diisi"],
  colors: ["#5480C7", "#2B508E", "#FE7E00", "#A0A0A0"],
  legend: { position: "bottom" },
  dataLabels: { enabled: true },
  noData: { text: "Belum ada data" },
};

const genderOptions = {
  chart: { type: "donut", height: 220 },
  labels: ["Laki-laki", "Perempuan", "Belum Diisi"],
  colors: ["#2B508E", "#FE7E00", "#A0A0A0"],
  legend: { position: "bottom" },
  dataLabels: { enabled: true },
  noData: { text: "Belum ada data" },
};

const recentEmployees = computed(() => {
  return dashboard.value?.pegawai_terbaru || [];
});

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function loadDashboard() {
  if (!isManagerHRD.value) {
    dashboard.value = null;
    error.value = "";
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const response = await request("/dashboard/hrd");
    dashboard.value = response.data;
  } catch (e) {
    error.value = e?.data?.message || "Gagal memuat dashboard.";
  } finally {
    loading.value = false;
  }
}

watch(
  () => [user.value?.id, user.value?.nama_role],
  ([id]) => {
    if (!id) return;
    loadDashboard();
  },
  { immediate: true },
);

onMounted(loadDashboard);
</script>

<template>
  <div v-if="!isManagerHRD" class="card">
    <div class="card-body py-5 text-center">
      <h2 class="mb-0">Selamat Datang {{ greetingName }} - {{ displayRole }}</h2>
    </div>
  </div>
  <div>
    <div v-if="isManagerHRD && error" class="alert alert-danger">
      {{ error }}

      <button type="button" class="btn btn-sm btn-outline-danger ms-3" @click="loadDashboard">Coba Lagi</button>
    </div>

    <div v-if="isManagerHRD && loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status" />
      <p class="mt-2 text-secondary">Memuat dashboard...</p>
    </div>

    <div v-if="isManagerHRD && !loading && dashboard" class="row g-3">
      <!-- Greeting -->
      <div class="col-md-3">
        <div class="card bg-dark h-100">
          <div class="card-body">
            <div class="text-center">
              <img src="@/assets/images/greeting-img.svg" alt="Greeting" class="img-fluid mb-4" />
            </div>

            <h3 class="card-title text-white">
              Halo, selamat datang
              {{ greetingName }}
              di Aplikasi Kepegawaian
            </h3>

            <p class="text-white fw-lighter fst-italic">Kelola data kepegawaian dengan mudah dan efisien.</p>
          </div>
        </div>
      </div>

      <div class="col-md-9">
        <div class="row g-3">
          <!-- Statistics -->
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <div class="row g-3">
                  <div v-for="item in statistics" :key="item.title" class="col-md-6 col-lg-3">
                    <div class="row align-items-center">
                      <div class="col-auto">
                        <div
                          class="d-flex rounded-circle"
                          :style="{
                            width: '56px',
                            height: '56px',
                            background: item.background,
                          }"
                        >
                          <component :is="item.icon" :stroke="2" class="m-auto text-white" />
                        </div>
                      </div>

                      <div class="col">
                        <h3 class="fs-2 mb-1">
                          {{ item.value }}
                        </h3>

                        <p class="text-secondary fw-light mb-0">
                          {{ item.title }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Contract Chart -->
          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-body">
                <h3 class="card-title">Total Pegawai Berdasarkan Status Kontrak</h3>

                <ClientOnly>
                  <apexchart v-if="contractSeries.some((v) => v > 0)" type="donut" height="220" :options="contractOptions" :series="contractSeries" />

                  <div v-else class="text-center text-secondary py-5">Belum ada data</div>
                </ClientOnly>
              </div>
            </div>
          </div>

          <!-- Gender Chart -->
          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-body">
                <h3 class="card-title">Total Pegawai Berdasarkan Gender</h3>

                <ClientOnly>
                  <apexchart v-if="genderSeries.some((v) => v > 0)" type="donut" height="220" :options="genderOptions" :series="genderSeries" />

                  <div v-else class="text-center text-secondary py-5">Belum ada data</div>
                </ClientOnly>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Employees -->
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Data Pegawai Terbaru</h3>

            <button type="button" class="btn btn-outline-primary btn-sm ms-auto" :disabled="loading" @click="loadDashboard">
              <IconRefresh :size="16" />
              Refresh
            </button>
          </div>

          <div class="table-responsive card-body p-0">
            <table class="table table-vcenter table-striped card-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>NIP</th>
                  <th>Nama Lengkap</th>
                  <th>Tanggal Masuk</th>
                  <th>Status Kepegawaian</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="(item, index) in recentEmployees" :key="item.id">
                  <td>{{ index + 1 }}</td>

                  <td>{{ item.nip }}</td>

                  <td>
                    <div class="fw-semibold">
                      {{ item.nama_pegawai }}
                    </div>

                    <small class="text-secondary">
                      {{ item.nama_jabatan || "-" }}
                    </small>
                  </td>

                  <td>
                    {{ formatDate(item.tanggal_masuk) }}
                  </td>

                  <td>
                    <span class="badge bg-primary-lt">
                      {{ item.status_kontrak || "-" }}
                    </span>
                  </td>

                  <td>
                    <NuxtLink :to="`/pegawai/${item.id}`" class="btn btn-primary btn-sm"> Detail Pegawai </NuxtLink>
                  </td>
                </tr>

                <tr v-if="recentEmployees.length === 0">
                  <td colspan="6" class="text-center py-4 text-secondary">Belum ada data pegawai.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
