<script setup>
definePageMeta({ title: "Tunjangan Transport" });
useSeoMeta({ title: "Tunjangan Transport" });

const { request } = useApi();

const currentYear = Number(
  new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date()),
);

const tahun = ref(currentYear);
const appliedYear = ref(currentYear);

const rows = ref([]);
const loading = ref(false);
const error = ref("");

let version = 0;

const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

async function loadMonths() {
  if (!Number.isInteger(Number(tahun.value)) || Number(tahun.value) < 2000 || Number(tahun.value) > 2100) {
    error.value = "Tahun harus antara 2000–2100.";
    return;
  }

  const requestVersion = ++version;
  const requestedYear = Number(tahun.value);

  loading.value = true;
  error.value = "";

  try {
    const response = await request("/transport/months", {
      query: { tahun: requestedYear },
    });

    if (requestVersion !== version) return;

    rows.value = response.data || [];
    appliedYear.value = requestedYear;
  } catch (value) {
    if (requestVersion !== version) return;

    rows.value = [];
    error.value = value?.data?.message || "Gagal memuat rekap tunjangan.";
  } finally {
    if (requestVersion === version) {
      loading.value = false;
    }
  }
}

onMounted(loadMonths);

onBeforeUnmount(() => {
  version++;
});
</script>

<template>
  <div class="card">
    <div class="card-header d-flex flex-wrap gap-3">
      <h3 class="card-title me-auto">Tunjangan Transport Tahun {{ appliedYear }}</h3>

      <form class="d-flex gap-2 align-items-center" @submit.prevent="loadMonths">
        <label for="transport-year" class="mb-0">Tahun</label>

        <input id="transport-year" v-model="tahun" type="number" min="2000" max="2100" step="1" class="form-control" style="width: 110px" :disabled="loading" required />

        <button type="submit" class="btn btn-primary" :disabled="loading">Tampilkan</button>
      </form>
    </div>

    <div v-if="error" class="alert alert-danger m-3" role="alert">
      {{ error }}
    </div>

    <div class="table-responsive">
      <table class="table table-vcenter card-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Bulan</th>
            <th>Total Penerima</th>
            <th>Total Tunjangan Transport</th>
            <th>Aksi</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="text-center py-4">Memuat rekap...</td>
          </tr>

          <template v-else>
            <tr v-for="(row, index) in rows" :key="row.bulan">
              <td>{{ index + 1 }}</td>
              <td>{{ row.nama_bulan }}</td>
              <td>{{ row.total_penerima }}</td>
              <td>{{ rupiah(row.total_nominal) }}</td>

              <td>
                <NuxtLink
                  :to="{
                    path: `/tunjangan/transport/detail/${row.bulan}`,
                    query: { tahun: appliedYear },
                  }"
                  class="btn btn-sm btn-primary"
                >
                  Detail
                </NuxtLink>
              </td>
            </tr>

            <tr v-if="!rows.length">
              <td colspan="5" class="text-center py-4">Tidak ada rekap yang dapat ditampilkan.</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
