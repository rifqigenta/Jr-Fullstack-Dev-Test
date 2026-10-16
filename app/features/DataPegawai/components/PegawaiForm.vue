<script setup>
const route = useRoute();
const { request } = useApi();

const employeeId = computed(() => route.params.id);
const isEdit = computed(() => Boolean(employeeId.value));

const loading = ref(false);
const saving = ref(false);
const error = ref("");

const positions = ref([]);
const departments = ref([]);
const regions = ref([]);
const regionSearch = ref("");

const form = reactive({
  nip: "",
  nama_pegawai: "",
  email: "",
  nomor_hp: "",
  tempat_lahir: "",
  tanggal_lahir: "",
  jenis_kelamin: null,
  id_kecamatan: "",
  alamat_lengkap: "",
  jarak_rumah_kantor: 0,
  status_kawin: "tidak kawin",
  jumlah_anak: 0,
  tanggal_masuk: "",
  id_jabatan: "",
  id_departemen: "",
  status: "Aktif",
  status_kontrak: "PKWTT",
  pendidikan: [],
});

const fields = [
  { key: "nip", label: "NIP", type: "text", required: true },
  { key: "nama_pegawai", label: "Nama Lengkap", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "nomor_hp", label: "Nomor HP (+62...)", type: "tel", required: true },
  { key: "tempat_lahir", label: "Tempat Lahir", type: "text", required: true },
  { key: "tanggal_lahir", label: "Tanggal Lahir", type: "date", required: true },
  { key: "tanggal_masuk", label: "Tanggal Masuk", type: "date", required: true },
  { key: "jarak_rumah_kantor", label: "Jarak Rumah-Kantor (km)", type: "number", required: true },
  { key: "jumlah_anak", label: "Jumlah Anak", type: "number", required: true },
];

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

async function loadMasterData() {
  const [positionRes, departmentRes] = await Promise.all([request("/master-data/positions"), request("/master-data/departments")]);

  positions.value = positionRes.data || [];
  departments.value = departmentRes.data || [];
}

async function searchRegions() {
  const response = await request("/master-data/regions", {
    query: {
      search: regionSearch.value,
      limit: 50,
    },
  });

  regions.value = response.data || [];
}

async function loadEmployee() {
  if (!isEdit.value) return;

  const response = await request(`/employees/${employeeId.value}`);
  const employee = response.data;

  Object.keys(form).forEach((key) => {
    if (employee[key] !== undefined && employee[key] !== null) {
      form[key] = employee[key];
    }
  });

  form.tanggal_lahir = normalizeDate(employee.tanggal_lahir);
  form.tanggal_masuk = normalizeDate(employee.tanggal_masuk);

  form.pendidikan = (employee.pendidikan || []).map((item) => ({
    tingkat_pendidikan: item.tingkat_pendidikan,
    nama_sekolah: item.nama_sekolah,
    tahun_lulus: Number(item.tahun_lulus),
  }));

  if (employee.id_kecamatan) {
    const responseRegion = await request("/master-data/regions", {
      query: {
        search: employee.nama_kecamatan || "",
        limit: 50,
      },
    });

    regions.value = responseRegion.data || [];
  }
}

function addEducation() {
  form.pendidikan.push({
    tingkat_pendidikan: "",
    nama_sekolah: "",
    tahun_lulus: new Date().getFullYear(),
  });
}

function removeEducation(index) {
  form.pendidikan.splice(index, 1);
}

async function saveEmployee() {
  saving.value = true;
  error.value = "";

  try {
    const payload = {
      ...form,
      nip: String(form.nip),
      id_kecamatan: Number(form.id_kecamatan),
      id_jabatan: Number(form.id_jabatan),
      id_departemen: Number(form.id_departemen),
      jarak_rumah_kantor: Number(form.jarak_rumah_kantor),
      jumlah_anak: Number(form.jumlah_anak),
      pendidikan: form.pendidikan.map((item) => ({
        tingkat_pendidikan: item.tingkat_pendidikan,
        nama_sekolah: item.nama_sekolah,
        tahun_lulus: Number(item.tahun_lulus),
      })),
    };

    await request(isEdit.value ? `/employees/${employeeId.value}` : "/employees", {
      method: isEdit.value ? "PATCH" : "POST",
      body: payload,
    });

    await navigateTo("/pegawai");
  } catch (e) {
    error.value = e?.data?.message || "Gagal menyimpan pegawai.";
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;

  try {
    await loadMasterData();
    await searchRegions();
    await loadEmployee();
  } catch (e) {
    error.value = e?.data?.message || "Gagal memuat data form.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">
        {{ isEdit ? "Edit Pegawai" : "Tambah Pegawai" }}
      </h3>
    </div>

    <div class="card-body">
      <div v-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <div v-if="loading" class="text-center py-5">Memuat data...</div>

      <form v-else @submit.prevent="saveEmployee">
        <h3>Data Diri</h3>

        <div class="row g-3 mb-4">
          <div v-for="field in fields" :key="field.key" class="col-md-6">
            <label class="form-label">{{ field.label }}</label>

            <input v-model="form[field.key]" :type="field.type" :required="field.required" class="form-control" :min="field.type === 'number' ? 0 : undefined" />
          </div>

          <div class="col-md-6">
            <label class="form-label">Jenis Kelamin</label>
            <select v-model="form.jenis_kelamin" class="form-select">
              <option :value="null">Tidak ditentukan</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Status Perkawinan</label>
            <select v-model="form.status_kawin" class="form-select">
              <option value="tidak kawin">Tidak Kawin</option>
              <option value="kawin">Kawin</option>
            </select>
          </div>

          <div class="col-12">
            <label class="form-label">Alamat Lengkap</label>
            <textarea v-model="form.alamat_lengkap" class="form-control" rows="3" required />
          </div>

          <div class="col-md-6">
            <label class="form-label">Cari Kecamatan</label>
            <div class="input-group">
              <input v-model="regionSearch" class="form-control" placeholder="Nama kecamatan/kabupaten" />
              <button type="button" class="btn" @click="searchRegions">Cari</button>
            </div>
          </div>

          <div class="col-md-6">
            <label class="form-label">Kecamatan</label>
            <select v-model="form.id_kecamatan" class="form-select" required>
              <option value="">Pilih Kecamatan</option>
              <option v-for="region in regions" :key="region.id" :value="region.id">
                {{ region.kecamatan }}, {{ region.kabupaten }},
                {{ region.provinsi }}
              </option>
              <option v-if="isEdit && form.id_kecamatan && !regions.some((r) => r.id === Number(form.id_kecamatan))" :value="Number(form.id_kecamatan)">
                Kecamatan tersimpan (ID {{ form.id_kecamatan }})
              </option>
            </select>
          </div>
        </div>

        <h3>Data Kepegawaian</h3>

        <div class="row g-3 mb-4">
          <div class="col-md-6">
            <label class="form-label">Jabatan</label>
            <select v-model="form.id_jabatan" class="form-select" required>
              <option value="">Pilih Jabatan</option>
              <option v-for="item in positions" :key="item.id" :value="item.id">
                {{ item.nama }}
              </option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Departemen</label>
            <select v-model="form.id_departemen" class="form-select" required>
              <option value="">Pilih Departemen</option>
              <option v-for="item in departments" :key="item.id" :value="item.id">
                {{ item.nama }}
              </option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Status Pegawai</label>
            <select v-model="form.status" class="form-select">
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label">Status Kontrak</label>
            <select v-model="form.status_kontrak" class="form-select">
              <option value="PKWTT">PKWTT</option>
              <option value="PKWT">PKWT</option>
              <option value="Magang">Magang</option>
            </select>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3">
          <h3 class="mb-0">Riwayat Pendidikan</h3>
          <button type="button" class="btn btn-outline-primary" @click="addEducation">+ Tambah Pendidikan</button>
        </div>

        <div v-for="(item, index) in form.pendidikan" :key="index" class="row g-2 mb-3">
          <div class="col-md-3">
            <input v-model="item.tingkat_pendidikan" class="form-control" placeholder="Jenjang" required />
          </div>

          <div class="col-md-5">
            <input v-model="item.nama_sekolah" class="form-control" placeholder="Nama Sekolah" required />
          </div>

          <div class="col-md-2">
            <input v-model.number="item.tahun_lulus" type="number" min="1900" max="2100" class="form-control" required />
          </div>

          <div class="col-md-2">
            <button type="button" class="btn btn-danger w-100" @click="removeEducation(index)">Hapus</button>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 mt-4">
          <NuxtLink to="/pegawai" class="btn"> Batal </NuxtLink>

          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? "Menyimpan..." : "Simpan Pegawai" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
