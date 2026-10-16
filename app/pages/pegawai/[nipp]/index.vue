<script setup>
definePageMeta({
  title: "Detail Pegawai",
});

const route = useRoute();
const { request } = useApi();

const employee = ref(null);
const loading = ref(true);
const error = ref("");

const employeeId = computed(() => route.params.nipp);

const fields = [
  ["NIP", "nip"],
  ["Nama Lengkap", "nama_pegawai"],
  ["Email", "email"],
  ["Nomor HP", "nomor_hp"],
  ["Tempat Lahir", "tempat_lahir"],
  ["Tanggal Lahir", "tanggal_lahir"],
  ["Jenis Kelamin", "jenis_kelamin"],
  ["Alamat", "alamat_lengkap"],
  ["Jarak Rumah-Kantor", "jarak_rumah_kantor"],
  ["Status Perkawinan", "status_kawin"],
  ["Jumlah Anak", "jumlah_anak"],
  ["Tanggal Masuk", "tanggal_masuk"],
  ["Jabatan", "nama_jabatan"],
  ["Departemen", "nama_departemen"],
  ["Status", "status"],
  ["Status Kontrak", "status_kontrak"],
];

function displayValue(key) {
  const value = employee.value?.[key];

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (key.startsWith("tanggal_")) {
    return String(value).slice(0, 10);
  }

  return value;
}

onMounted(async () => {
  try {
    const response = await request(`/employees/${employeeId.value}`);

    employee.value = response.data;
  } catch (e) {
    error.value = e?.data?.message || "Gagal memuat detail.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">Detail Pegawai</h3>

      <div class="ms-auto d-flex gap-2">
        <NuxtLink to="/pegawai" class="btn"> Kembali </NuxtLink>

        <NuxtLink v-if="employee" :to="`/pegawai/form/${employee.id}`" class="btn btn-primary"> Edit </NuxtLink>
      </div>
    </div>

    <div class="card-body">
      <div v-if="loading">Memuat data...</div>

      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <template v-else-if="employee">
        <div class="row g-3">
          <div v-for="[label, key] in fields" :key="key" class="col-md-6">
            <div class="text-secondary small">{{ label }}</div>
            <div class="fw-semibold">
              {{ displayValue(key) }}
            </div>
          </div>
        </div>

        <hr />

        <h3>Riwayat Pendidikan</h3>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Jenjang</th>
                <th>Sekolah</th>
                <th>Tahun Lulus</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(item, index) in employee.pendidikan || []" :key="index">
                <td>{{ item.tingkat_pendidikan }}</td>
                <td>{{ item.nama_sekolah }}</td>
                <td>{{ item.tahun_lulus }}</td>
              </tr>

              <tr v-if="!employee.pendidikan?.length">
                <td colspan="3" class="text-center">Belum ada data pendidikan.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
