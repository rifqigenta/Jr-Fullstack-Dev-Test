<script setup>
import EmployeeAvatar from "./EmployeeAvatar.vue";
import RegionAutocomplete from "./RegionAutocomplete.vue";

import { displayDate, parseDisplayDate, calculateAge, jakartaToday } from "~/utils/employeeDate.js";

const route = useRoute();
const { request } = useApi();
const { user, fetchMe } = useAuth();

const savedId = ref(route.params.id ? Number(route.params.id) : null);

const isEdit = computed(() => Boolean(savedId.value));

const canManage = computed(
  () =>
    String(user.value?.nama_role || "")
      .trim()
      .toLowerCase() === "admin hrd",
);

const loading = ref(true);
const saving = ref(false);
const error = ref("");
const message = ref("");
const fieldErrors = ref({});

const positions = ref([]);
const departments = ref([]);
const region = ref(null);

const photoFile = ref(null);
const photoUrl = ref("");
const previewUrl = ref("");
const photoInput = ref(null);

const birthDateText = ref("");
const joinDateText = ref("");

const form = reactive({
  nip: "",
  nama_pegawai: "",
  email: "",
  nomor_hp: "",
  tempat_lahir: "",
  jenis_kelamin: null,
  alamat_lengkap: "",
  jarak_rumah_kantor: "",
  status_kawin: "tidak kawin",
  jumlah_anak: 0,
  id_jabatan: "",
  id_departemen: "",
  status: "Aktif",
  status_kontrak: "PKWTT",
  pendidikan: [
    {
      tingkat_pendidikan: "",
      nama_sekolah: "",
      tahun_lulus: "",
    },
  ],
});

const age = computed(() => {
  const iso = parseDisplayDate(displayDate(birthDateText.value));

  return iso ? calculateAge(iso) : null;
});

const textFields = [
  { key: "nip", label: "NIP", type: "text", max: 100 },
  {
    key: "nama_pegawai",
    label: "Nama Pegawai",
    type: "text",
    max: 150,
  },
  { key: "email", label: "Email", type: "email", max: 255 },
  {
    key: "nomor_hp",
    label: "Nomor HP",
    type: "tel",
    max: 16,
  },
  {
    key: "tempat_lahir",
    label: "Tempat Lahir",
    type: "text",
    max: 100,
  },
];

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
}

function resetSelectedPhoto() {
  revokePreview();
  photoFile.value = null;

  if (photoInput.value) {
    photoInput.value.value = "";
  }
}

function selectPhoto(event) {
  error.value = "";

  const file = event.target.files?.[0];

  resetSelectedPhoto();

  if (!file) return;

  if (!["image/jpeg", "image/png"].includes(file.type)) {
    error.value = "Foto hanya boleh berformat PNG, JPEG, atau JPG.";
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    error.value = "Ukuran foto maksimal 2 MB.";
    return;
  }

  photoFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

function addEducation() {
  if (form.pendidikan.length >= 20) return;

  form.pendidikan.push({
    tingkat_pendidikan: "",
    nama_sekolah: "",
    tahun_lulus: "",
  });
}

function removeEducation(index) {
  if (form.pendidikan.length <= 1) return;
  form.pendidikan.splice(index, 1);
}

function validateForm() {
  const errors = {};

  if (!/^\d{8,}$/.test(form.nip)) {
    errors.nip = "NIP minimal 8 digit angka tanpa spasi.";
  }

  if (!form.nama_pegawai.trim() || !/^[\p{L}\p{N}'‘’ ]+$/u.test(form.nama_pegawai.trim())) {
    errors.nama_pegawai = "Nama hanya boleh berisi huruf, angka, petik atas, dan spasi.";
  }

  if (!/^\+[1-9]\d{7,14}$/.test(form.nomor_hp)) {
    errors.nomor_hp = "Gunakan format internasional, contoh +6282218458888.";
  }

  const birth = parseDisplayDate(displayDate(birthDateText.value));
  const join = parseDisplayDate(displayDate(joinDateText.value));

  if (!birth) {
    errors.tanggal_lahir = "Pilih tanggal lahir yang valid.";
  } else if (birth > jakartaToday()) {
    errors.tanggal_lahir = "Tanggal lahir tidak boleh di masa depan.";
  }

  if (!join) {
    errors.tanggal_masuk = "Pilih tanggal masuk yang valid.";
  } else if (birth && join < birth) {
    errors.tanggal_masuk = "Tanggal masuk tidak boleh sebelum tanggal lahir.";
  }

  if (!region.value?.id) {
    errors.id_kecamatan = "Pilih kecamatan dari hasil pencarian.";
  }

  const distance = Number(form.jarak_rumah_kantor);

  if (form.jarak_rumah_kantor === "" || !Number.isFinite(distance) || distance < 0 || distance > 99.99) {
    errors.jarak_rumah_kantor = "Jarak harus antara 0–99,99 km.";
  }

  const children = Number(form.jumlah_anak);

  if (form.jumlah_anak === "" || !Number.isInteger(children) || children < 0 || children > 99) {
    errors.jumlah_anak = "Jumlah anak harus bilangan bulat 0–99.";
  }

  if (!form.pendidikan.length) {
    errors.pendidikan = "Minimal satu riwayat pendidikan wajib diisi.";
  }

  const birthYear = birth ? Number(birth.slice(0, 4)) : null;

  for (const item of form.pendidikan) {
    const year = Number(item.tahun_lulus);

    if (!item.tingkat_pendidikan.trim() || !item.nama_sekolah.trim() || !Number.isInteger(year) || year < 1900 || year > 2100 || (birthYear !== null && year < birthYear)) {
      errors.pendidikan = "Lengkapi pendidikan dengan tahun lulus 1900–2100 dan tidak sebelum tahun lahir.";
      break;
    }
  }

  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

function readApiError(value) {
  const backendErrors = value?.data?.errors?.fieldErrors;

  if (backendErrors) {
    fieldErrors.value = Object.fromEntries(Object.entries(backendErrors).map(([key, messages]) => [key, Array.isArray(messages) ? messages.join(" ") : String(messages)]));
  }

  return value?.data?.message || value?.message || "Gagal menyimpan pegawai.";
}

async function saveEmployee() {
  if (saving.value || !canManage.value) return;

  error.value = "";
  message.value = "";

  if (!validateForm()) {
    error.value = "Periksa kembali isian yang ditandai.";
    return;
  }

  saving.value = true;
  let employeeSaved = false;

  try {
    const payload = {
      nip: form.nip,
      nama_pegawai: form.nama_pegawai.trim(),
      email: form.email.trim(),
      nomor_hp: form.nomor_hp,
      tempat_lahir: form.tempat_lahir.trim(),
      tanggal_lahir: birthDateText.value,
      jenis_kelamin: form.jenis_kelamin,
      id_kecamatan: Number(region.value.id),
      alamat_lengkap: form.alamat_lengkap.trim(),
      jarak_rumah_kantor: Number(form.jarak_rumah_kantor),
      status_kawin: form.status_kawin,
      jumlah_anak: Number(form.jumlah_anak),
      tanggal_masuk: joinDateText.value,
      id_jabatan: Number(form.id_jabatan),
      id_departemen: Number(form.id_departemen),
      status: form.status,
      status_kontrak: form.status_kontrak,
      pendidikan: form.pendidikan.map((item) => ({
        tingkat_pendidikan: item.tingkat_pendidikan.trim(),
        nama_sekolah: item.nama_sekolah.trim(),
        tahun_lulus: Number(item.tahun_lulus),
      })),
    };

    const response = await request(savedId.value ? `/employees/${savedId.value}` : "/employees", {
      method: savedId.value ? "PATCH" : "POST",
      body: payload,
    });

    savedId.value = Number(response.data.id);
    employeeSaved = true;

    if (photoFile.value) {
      const body = new FormData();
      body.append("photo", photoFile.value);

      const photoResponse = await request(`/employees/${savedId.value}/photo`, {
        method: "POST",
        body,
      });

      photoUrl.value = photoResponse.data.foto_pegawai;
      resetSelectedPhoto();
    }
  } catch (value) {
    const detail = readApiError(value);

    if (employeeSaved) {
      message.value = "Data pegawai sudah tersimpan. Foto belum berhasil diunggah.";
      error.value = `${detail} Klik Simpan lagi untuk mencoba ulang pada pegawai yang sama.`;
    } else {
      error.value = detail;
    }
  } finally {
    saving.value = false;
  }

  if (employeeSaved && !error.value) {
    await navigateTo(`/pegawai/${savedId.value}?saved=1`);
  }
}

async function deleteStoredPhoto() {
  if (!savedId.value || !photoUrl.value || saving.value || !window.confirm("Hapus foto pegawai yang tersimpan?")) {
    return;
  }

  saving.value = true;
  error.value = "";
  message.value = "";

  try {
    await request(`/employees/${savedId.value}/photo`, {
      method: "DELETE",
    });

    photoUrl.value = "";
    resetSelectedPhoto();
    message.value = "Foto berhasil dihapus.";
  } catch (value) {
    error.value = value?.data?.message || "Gagal menghapus foto.";
  } finally {
    saving.value = false;
  }
}

async function loadEmployee() {
  if (!savedId.value) return;

  const response = await request(`/employees/${savedId.value}`);
  const employee = response.data;

  for (const key of Object.keys(form)) {
    if (key !== "pendidikan" && employee[key] !== undefined && employee[key] !== null) {
      form[key] = employee[key];
    }
  }

  form.jenis_kelamin = employee.jenis_kelamin ?? null;

  birthDateText.value = String(employee.tanggal_lahir || "").slice(0, 10);
  joinDateText.value = String(employee.tanggal_masuk || "").slice(0, 10);
  photoUrl.value = employee.foto_pegawai || "";

  form.pendidikan = employee.pendidikan?.length
    ? employee.pendidikan.map((item) => ({
        tingkat_pendidikan: item.tingkat_pendidikan,
        nama_sekolah: item.nama_sekolah,
        tahun_lulus: Number(item.tahun_lulus),
      }))
    : [
        {
          tingkat_pendidikan: "",
          nama_sekolah: "",
          tahun_lulus: "",
        },
      ];

  const regionResponse = await request("/master-data/regions", {
    query: { id: employee.id_kecamatan },
  });

  region.value = regionResponse.data?.[0] || null;

  if (!region.value) {
    message.value = "Kecamatan tersimpan tidak ditemukan. Pilih kembali kecamatan sebelum menyimpan.";
  }
}

onMounted(async () => {
  try {
    if (!user.value) await fetchMe();

    if (!canManage.value) {
      error.value = "Halaman ini hanya dapat digunakan oleh Admin HRD.";
      return;
    }

    const [positionResponse, departmentResponse] = await Promise.all([request("/master-data/positions"), request("/master-data/departments")]);

    positions.value = positionResponse.data || [];
    departments.value = departmentResponse.data || [];

    await loadEmployee();
  } catch (value) {
    error.value = value?.data?.message || "Gagal memuat form pegawai.";
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(revokePreview);
</script>

<template>
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">
        {{ isEdit ? "Edit Pegawai" : "Tambah Pegawai" }}
      </h3>
    </div>

    <div class="card-body">
      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-if="message" class="alert alert-info" role="status">
        {{ message }}

        <NuxtLink v-if="savedId" :to="`/pegawai/${savedId}`" class="d-block mt-2"> Lihat data pegawai tersimpan </NuxtLink>
      </div>

      <div v-if="loading" class="text-center py-4">Memuat form...</div>

      <form v-else-if="canManage" @submit.prevent="saveEmployee">
        <fieldset :disabled="saving">
          <h3>Foto Pegawai</h3>

          <div class="d-flex flex-wrap gap-3 align-items-center mb-4">
            <EmployeeAvatar :src="previewUrl || photoUrl" :name="form.nama_pegawai || 'Pegawai'" />

            <div>
              <label for="employee-photo" class="form-label"> Foto opsional </label>

              <input id="employee-photo" ref="photoInput" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" class="form-control" @change="selectPhoto" />

              <div class="form-hint">PNG/JPEG/JPG, maksimal 2 MB.</div>

              <div class="d-flex gap-2 mt-2">
                <button v-if="photoFile" type="button" class="btn btn-sm" @click="resetSelectedPhoto">Batal Pilih Foto</button>

                <button v-if="photoUrl" type="button" class="btn btn-sm btn-outline-danger" @click="deleteStoredPhoto">Hapus Foto Tersimpan</button>
              </div>
            </div>
          </div>

          <h3>Data Diri</h3>

          <div class="row g-3 mb-4">
            <div v-for="field in textFields" :key="field.key" class="col-md-6">
              <label :for="`employee-${field.key}`" class="form-label required">
                {{ field.label }}
              </label>

              <input
                :id="`employee-${field.key}`"
                v-model="form[field.key]"
                :type="field.type"
                :maxlength="field.max"
                :inputmode="field.key === 'nip' ? 'numeric' : undefined"
                :placeholder="field.key === 'nomor_hp' ? '+6282218458888' : ''"
                class="form-control"
                :class="{ 'is-invalid': fieldErrors[field.key] }"
                required
              />

              <div v-if="fieldErrors[field.key]" class="invalid-feedback">
                {{ fieldErrors[field.key] }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="employee-gender" class="form-label"> Jenis Kelamin </label>

              <select id="employee-gender" v-model="form.jenis_kelamin" class="form-select">
                <option :value="null">Tidak ditentukan</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>

            <div class="col-md-6">
              <label for="employee-birth" class="form-label required"> Tanggal Lahir </label>

              <input
                id="employee-birth"
                v-model="birthDateText"
                type="date"
                min="1900-01-01"
                :max="jakartaToday()"
                class="form-control"
                :class="{ 'is-invalid': fieldErrors.tanggal_lahir }"
                required
              />

              <div class="invalid-feedback">
                {{ fieldErrors.tanggal_lahir }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="employee-age" class="form-label"> Usia </label>

              <input id="employee-age" :value="age === null ? '' : `${age} tahun`" class="form-control" disabled />
            </div>

            <div class="col-md-6">
              <label for="employee-children" class="form-label required"> Jumlah Anak </label>

              <input id="employee-children" v-model="form.jumlah_anak" type="number" min="0" max="99" step="1" class="form-control" :class="{ 'is-invalid': fieldErrors.jumlah_anak }" required />

              <div class="invalid-feedback">
                {{ fieldErrors.jumlah_anak }}
              </div>
            </div>

            <div class="col-md-6">
              <fieldset>
                <legend class="form-label required">Status Kawin</legend>

                <label class="form-check form-check-inline">
                  <input v-model="form.status_kawin" type="radio" value="kawin" name="marital-status" class="form-check-input" required />
                  <span class="form-check-label">Kawin</span>
                </label>

                <label class="form-check form-check-inline">
                  <input v-model="form.status_kawin" type="radio" value="tidak kawin" name="marital-status" class="form-check-input" required />
                  <span class="form-check-label">Tidak Kawin</span>
                </label>
              </fieldset>
            </div>
          </div>

          <h3>Alamat</h3>

          <RegionAutocomplete v-model="region" :disabled="saving" />

          <div v-if="fieldErrors.id_kecamatan" class="text-danger small mt-2">
            {{ fieldErrors.id_kecamatan }}
          </div>

          <div class="row g-3 mt-1 mb-4">
            <div class="col-md-8">
              <label for="employee-address" class="form-label required"> Alamat Lengkap </label>

              <textarea id="employee-address" v-model="form.alamat_lengkap" rows="3" class="form-control" required />
            </div>

            <div class="col-md-4">
              <label for="employee-distance" class="form-label required"> Jarak Rumah–Kantor (km) </label>

              <input
                id="employee-distance"
                v-model="form.jarak_rumah_kantor"
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                class="form-control"
                :class="{ 'is-invalid': fieldErrors.jarak_rumah_kantor }"
                required
              />

              <div class="invalid-feedback">
                {{ fieldErrors.jarak_rumah_kantor }}
              </div>
            </div>
          </div>

          <h3>Data Kepegawaian</h3>

          <div class="row g-3 mb-4">
            <div class="col-md-6">
              <label for="employee-join" class="form-label required"> Tanggal Masuk </label>

              <input id="employee-join" v-model="joinDateText" type="date" min="1900-01-01" class="form-control" :class="{ 'is-invalid': fieldErrors.tanggal_masuk }" required />

              <div class="invalid-feedback">
                {{ fieldErrors.tanggal_masuk }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="employee-position" class="form-label required"> Jabatan </label>

              <select id="employee-position" v-model="form.id_jabatan" class="form-select" required>
                <option value="">Pilih Jabatan</option>
                <option v-for="item in positions" :key="item.id" :value="item.id">
                  {{ item.nama }}
                </option>
              </select>
            </div>

            <div class="col-md-6">
              <label for="employee-department" class="form-label required"> Departemen </label>

              <select id="employee-department" v-model="form.id_departemen" class="form-select" required>
                <option value="">Pilih Departemen</option>
                <option v-for="item in departments" :key="item.id" :value="item.id">
                  {{ item.nama }}
                </option>
              </select>
            </div>

            <div class="col-md-6">
              <label for="employee-status" class="form-label required"> Status </label>

              <select id="employee-status" v-model="form.status" class="form-select" required>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            <div class="col-md-6">
              <label for="employee-contract" class="form-label required"> Status Kontrak </label>

              <select id="employee-contract" v-model="form.status_kontrak" class="form-select" required>
                <option value="PKWTT">PKWTT</option>
                <option value="PKWT">PKWT</option>
                <option value="Magang">Magang</option>
              </select>
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="mb-0">Riwayat Pendidikan</h3>

            <button type="button" class="btn btn-outline-primary" :disabled="form.pendidikan.length >= 20" @click="addEducation">+ Tambah Pendidikan</button>
          </div>

          <div v-if="fieldErrors.pendidikan" class="text-danger mb-2">
            {{ fieldErrors.pendidikan }}
          </div>

          <div v-for="(item, index) in form.pendidikan" :key="index" class="row g-2 mb-3">
            <div class="col-md-3">
              <label :for="`education-level-${index}`" class="form-label required"> Jenjang </label>

              <input :id="`education-level-${index}`" v-model="item.tingkat_pendidikan" maxlength="50" placeholder="SD, SMP, SMA, S1..." class="form-control" required />
            </div>

            <div class="col-md-5">
              <label :for="`education-school-${index}`" class="form-label required"> Nama Sekolah </label>

              <input :id="`education-school-${index}`" v-model="item.nama_sekolah" maxlength="255" class="form-control" required />
            </div>

            <div class="col-md-2">
              <label :for="`education-year-${index}`" class="form-label required"> Tahun Lulus </label>

              <input :id="`education-year-${index}`" v-model="item.tahun_lulus" type="number" min="1900" max="2100" step="1" class="form-control" required />
            </div>

            <div class="col-md-2 d-flex align-items-end">
              <button type="button" class="btn btn-outline-danger w-100" :disabled="form.pendidikan.length <= 1" :aria-label="`Hapus pendidikan baris ${index + 1}`" @click="removeEducation(index)">
                Hapus
              </button>
            </div>
          </div>
        </fieldset>

        <div class="d-flex justify-content-end gap-2 mt-4">
          <NuxtLink v-if="!saving" to="/pegawai" class="btn"> Kembali </NuxtLink>

          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? "Menyimpan..." : "Simpan Pegawai" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
