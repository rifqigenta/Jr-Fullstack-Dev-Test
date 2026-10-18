<script setup>
import EmployeeAvatar from "~/features/DataPegawai/components/EmployeeAvatar.vue";

import { displayDate } from "~/utils/employeeDate.js";

definePageMeta({
  title: "Detail Pegawai",
});

useSeoMeta({ title: "Detail Pegawai" });

const route = useRoute();
const { request } = useApi();
const { user } = useAuth();
const { downloadFile } = useDownload();

const employee = ref(null);
const loading = ref(true);
const downloading = ref(false);
const error = ref("");
const downloadError = ref("");

let version = 0;

const canManage = computed(
  () =>
    String(user.value?.nama_role || "")
      .trim()
      .toLowerCase() === "admin hrd",
);

const fields = [
  ["NIP", "nip"],
  ["Nama Pegawai", "nama_pegawai"],
  ["Email", "email"],
  ["Nomor HP", "nomor_hp"],
  ["Tempat Lahir", "tempat_lahir"],
  ["Tanggal Lahir", "tanggal_lahir"],
  ["Usia", "usia"],
  ["Jenis Kelamin", "jenis_kelamin"],
  ["Kecamatan", "kecamatan"],
  ["Kabupaten/Kota", "kabupaten"],
  ["Provinsi", "provinsi"],
  ["Alamat Lengkap", "alamat_lengkap"],
  ["Jarak Rumah–Kantor", "jarak_rumah_kantor"],
  ["Status Kawin", "status_kawin"],
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
    return displayDate(value) || "-";
  }

  if (key === "usia") return `${value} tahun`;
  if (key === "jarak_rumah_kantor") return `${value} km`;

  return value;
}

async function loadEmployee() {
  const requestVersion = ++version;

  loading.value = true;
  error.value = "";
  downloadError.value = "";
  employee.value = null;

  const id = String(route.params.nipp || "");

  if (!/^[1-9]\d*$/.test(id)) {
    error.value = "ID pegawai tidak valid.";
    loading.value = false;
    return;
  }

  try {
    const response = await request(`/employees/${id}`);

    if (requestVersion !== version) return;
    employee.value = response.data;
  } catch (value) {
    if (requestVersion !== version) return;

    error.value = value?.data?.message || "Gagal memuat detail pegawai.";
  } finally {
    if (requestVersion === version) {
      loading.value = false;
    }
  }
}

async function downloadPdf() {
  if (!employee.value || downloading.value) return;

  downloading.value = true;
  downloadError.value = "";

  try {
    await downloadFile(`/employees/${employee.value.id}/pdf`, `pegawai-${employee.value.id}.pdf`);
  } catch (value) {
    downloadError.value = value?.message || "Gagal mengunduh PDF.";
  } finally {
    downloading.value = false;
  }
}

onMounted(loadEmployee);

watch(() => route.params.nipp, loadEmployee);

onBeforeUnmount(() => {
  version++;
});
</script>

<template>
  <div class="card">
    <div class="card-header d-flex flex-wrap gap-2">
      <h3 class="card-title me-auto">Detail Pegawai</h3>

      <NuxtLink to="/pegawai" class="btn"> Kembali </NuxtLink>

      <button v-if="employee" type="button" class="btn" :disabled="downloading" @click="downloadPdf">
        {{ downloading ? "Menyiapkan PDF..." : "Download PDF" }}
      </button>

      <NuxtLink v-if="employee && canManage" :to="`/pegawai/form/${employee.id}`" class="btn btn-primary"> Edit </NuxtLink>
    </div>

    <div class="card-body">
      <div v-if="route.query.saved === '1' && employee" class="alert alert-success" role="status">Data pegawai berhasil disimpan.</div>

      <div v-if="downloadError" class="alert alert-danger" role="alert">
        {{ downloadError }}
      </div>

      <div v-if="loading" class="text-center py-4">Memuat detail pegawai...</div>

      <div v-else-if="error" class="alert alert-danger" role="alert">
        {{ error }}

        <button type="button" class="btn btn-sm mt-2" @click="loadEmployee">Coba Lagi</button>
      </div>

      <template v-else-if="employee">
        <div class="d-flex gap-3 align-items-center mb-4">
          <EmployeeAvatar :src="employee.foto_pegawai || ''" :name="employee.nama_pegawai" :size="112" />

          <div>
            <h2 class="mb-1">{{ employee.nama_pegawai }}</h2>
            <div class="text-secondary">
              {{ employee.nip }}
            </div>

            <span class="badge mt-2" :class="employee.status === 'Aktif' ? 'bg-success-lt' : 'bg-secondary-lt'">
              {{ employee.status }}
            </span>
          </div>
        </div>

        <dl class="row g-3">
          <div v-for="[label, key] in fields" :key="key" class="col-md-6">
            <dt class="text-secondary small fw-normal">
              {{ label }}
            </dt>

            <dd class="fw-semibold mb-0" style="white-space: pre-wrap; overflow-wrap: anywhere">
              {{ displayValue(key) }}
            </dd>
          </div>
        </dl>

        <hr />

        <h3>Riwayat Pendidikan</h3>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Jenjang</th>
                <th>Nama Sekolah</th>
                <th>Tahun Lulus</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(item, index) in employee.pendidikan || []" :key="item.id || index">
                <td>{{ index + 1 }}</td>
                <td>{{ item.tingkat_pendidikan }}</td>
                <td>{{ item.nama_sekolah }}</td>
                <td>{{ item.tahun_lulus }}</td>
              </tr>

              <tr v-if="!employee.pendidikan?.length">
                <td colspan="4" class="text-center">Belum ada data pendidikan.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
