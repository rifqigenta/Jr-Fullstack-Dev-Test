<script setup>
import SettingForm from "~/features/Tunjangan/components/SettingForm.vue";

import { displayDate } from "~/utils/employeeDate.js";
import { formatRupiah } from "~/utils/formatRupiah.js";

definePageMeta({ title: "Pengaturan Tarif Transport" });

const { request } = useApi();
const { user, fetchMe } = useAuth();

const settings = ref([]);
const loading = ref(false);
const saving = ref(false);

const error = ref("");
const message = ref("");
const editing = ref(null);
const formVersion = ref(0);

const allowed = computed(
  () =>
    String(user.value?.nama_role || "")
      .trim()
      .toLowerCase() === "admin hrd",
);

const busy = computed(() => loading.value || saving.value);

function getError(value) {
  const fields = value?.data?.errors?.fieldErrors;

  return (fields ? Object.values(fields).flat().filter(Boolean).join(" ") : "") || value?.data?.message || value?.message || "Terjadi kesalahan.";
}

async function loadSettings() {
  loading.value = true;

  try {
    const response = await request("/transport/settings");
    settings.value = response.data || [];
  } catch (value) {
    error.value = getError(value);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editing.value = null;
  formVersion.value++;
}

function edit(item) {
  if (busy.value) return;

  error.value = "";
  message.value = "";
  editing.value = { ...item };
  formVersion.value++;
}

async function save(payload) {
  if (busy.value || !allowed.value) return;

  saving.value = true;
  error.value = "";
  message.value = "";

  try {
    const response = await request(editing.value ? `/transport/settings/${editing.value.id}` : "/transport/settings", {
      method: editing.value ? "PATCH" : "POST",
      body: payload,
    });

    message.value = response.message;
    resetForm();

    await loadSettings();
  } catch (value) {
    error.value = getError(value);
  } finally {
    saving.value = false;
  }
}

async function remove(item) {
  if (busy.value) return;

  if (!window.confirm(`Hapus tarif yang berlaku mulai ${displayDate(item.berlaku_mulai)}?`)) return;

  saving.value = true;
  error.value = "";
  message.value = "";

  try {
    await request(`/transport/settings/${item.id}`, {
      method: "DELETE",
    });

    if (editing.value?.id === item.id) resetForm();

    message.value = "Tarif berhasil dihapus.";
    await loadSettings();
  } catch (value) {
    error.value = getError(value);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    if (!user.value) await fetchMe();

    if (!allowed.value) {
      error.value = "Pengaturan tarif hanya dapat diakses Admin HRD.";
      return;
    }

    await loadSettings();
  } catch (value) {
    error.value = getError(value);
  }
});
</script>

<template>
  <div>
    <div class="d-flex justify-content-end mb-3">
      <NuxtLink to="/tunjangan/transport" class="btn"> Kembali </NuxtLink>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <div v-if="message" class="alert alert-success" role="status">
      {{ message }}
    </div>

    <template v-if="allowed">
      <div class="card mb-3">
        <div class="card-header">
          <h3 class="card-title">
            {{ editing ? "Edit Tarif" : "Tambah Tarif" }}
          </h3>
        </div>

        <SettingForm :key="formVersion" :setting="editing" :disabled="busy" @submit="save" @cancel="resetForm" />
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tarif Dasar</th>
                <th>Berlaku Mulai</th>
                <th>Minimum Km</th>
                <th>Maksimum Km</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="text-center py-4">Memuat pengaturan...</td>
              </tr>

              <template v-else>
                <tr v-for="(item, index) in settings" :key="item.id">
                  <td>{{ index + 1 }}</td>
                  <td>{{ formatRupiah(item.base_fare) }} / km</td>
                  <td>{{ displayDate(item.berlaku_mulai) }}</td>
                  <td>{{ item.minimum_km }}</td>
                  <td>{{ item.maximum_km }}</td>

                  <td>
                    <div class="d-flex gap-2">
                      <button type="button" class="btn btn-sm" :disabled="busy" @click="edit(item)">Edit</button>

                      <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy" @click="remove(item)">Hapus</button>
                    </div>
                  </td>
                </tr>

                <tr v-if="!settings.length">
                  <td colspan="6" class="text-center py-4">Belum ada tarif.</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
