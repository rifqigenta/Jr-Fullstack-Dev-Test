<script setup>
const props = defineProps({
  tahun: { type: Number, required: true },
  bulan: { type: Number, required: true },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["saved", "busy"]);
const { request } = useApi();

const search = ref("");
const employees = ref([]);
const employeeId = ref("");
const days = ref(19);

const searching = ref(false);
const saving = ref(false);
const error = ref("");
const message = ref("");

let version = 0;

const maximumDays = computed(() => new Date(Date.UTC(props.tahun, props.bulan, 0)).getUTCDate());

const busy = computed(() => props.disabled || searching.value || saving.value);

function getError(value) {
  const fields = value?.data?.errors?.fieldErrors;

  return (fields ? Object.values(fields).flat().filter(Boolean).join(" ") : "") || value?.data?.message || value?.message || "Terjadi kesalahan.";
}

async function searchEmployees() {
  if (busy.value) return;

  error.value = "";
  message.value = "";

  if (search.value.trim().length < 2) {
    error.value = "Ketik minimal 2 karakter nama atau NIP.";
    return;
  }

  const requestVersion = ++version;
  searching.value = true;
  employeeId.value = "";
  employees.value = [];

  try {
    const response = await request("/employees", {
      query: {
        search: search.value.trim(),
        page: 1,
        limit: 20,
        sortBy: "nama_pegawai",
        sortOrder: "asc",
      },
    });

    if (requestVersion !== version) return;

    employees.value = response.data || [];

    if (!employees.value.length) {
      message.value = "Pegawai tidak ditemukan.";
    }
  } catch (value) {
    if (requestVersion === version) {
      error.value = getError(value);
    }
  } finally {
    if (requestVersion === version) {
      searching.value = false;
    }
  }
}

async function save() {
  if (busy.value) return;

  error.value = "";
  message.value = "";

  const count = Number(days.value);

  if (!employeeId.value || days.value === "" || !Number.isInteger(count) || count < 0 || count > maximumDays.value) {
    error.value = `Pilih pegawai dan isi jumlah hari antara 0–${maximumDays.value}.`;
    return;
  }

  saving.value = true;
  emit("busy", true);

  try {
    const response = await request("/transport/attendance", {
      method: "PUT",
      body: {
        id_pegawai: Number(employeeId.value),
        tahun: props.tahun,
        bulan: props.bulan,
        jumlah_hari_masuk: count,
      },
    });

    message.value = response.message;
    emit("saved");
  } catch (value) {
    error.value = getError(value);
  } finally {
    saving.value = false;
    emit("busy", false);
  }
}

onBeforeUnmount(() => {
  version++;
});
</script>

<template>
  <div class="card mb-3">
    <div class="card-header">
      <h3 class="card-title">Input Kehadiran Bulanan</h3>
    </div>

    <div class="card-body">
      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-if="message" class="alert alert-info" role="status">
        {{ message }}
      </div>

      <form class="mb-3" @submit.prevent="searchEmployees">
        <label for="attendance-search" class="form-label"> Cari Pegawai </label>

        <div class="input-group">
          <input id="attendance-search" v-model="search" maxlength="100" class="form-control" placeholder="Nama atau NIP" :disabled="busy" required />

          <button type="submit" class="btn" :disabled="busy">
            {{ searching ? "Mencari..." : "Cari" }}
          </button>
        </div>
      </form>

      <form @submit.prevent="save">
        <fieldset :disabled="busy">
          <div class="row g-3">
            <div class="col-md-8">
              <label for="attendance-employee" class="form-label required"> Pegawai </label>

              <select id="attendance-employee" v-model="employeeId" class="form-select" required>
                <option value="">Pilih hasil pencarian</option>

                <option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.nip }} — {{ employee.nama_pegawai }}</option>
              </select>
            </div>

            <div class="col-md-4">
              <label for="attendance-days" class="form-label required"> Jumlah Hari Masuk </label>

              <input id="attendance-days" v-model="days" type="number" min="0" :max="maximumDays" step="1" class="form-control" required />
            </div>
          </div>

          <button type="submit" class="btn btn-primary mt-3">
            {{ saving ? "Menyimpan..." : "Simpan Kehadiran" }}
          </button>
        </fieldset>
      </form>
    </div>
  </div>
</template>
