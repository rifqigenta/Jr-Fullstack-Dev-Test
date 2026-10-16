<script setup>
definePageMeta({ title: "Pengaturan Tarif Transport" });

const { request } = useApi();

const settings = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const message = ref("");
const editingId = ref(null);

const form = reactive({
  base_fare: 2000,
  berlaku_mulai: new Date().toISOString().slice(0, 10),
  minimum_km: 5,
  maximum_km: 25,
});

const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

async function loadSettings() {
  loading.value = true;
  error.value = "";
  try {
    const res = await request("/transport/settings");
    settings.value = res.data || [];
  } catch (e) {
    error.value = e?.data?.message || "Gagal mengambil tarif.";
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = null;
  form.base_fare = 2000;
  form.berlaku_mulai = new Date().toISOString().slice(0, 10);
  form.minimum_km = 5;
  form.maximum_km = 25;
}

function editSetting(item) {
  editingId.value = item.id;
  form.base_fare = Number(item.base_fare);
  form.berlaku_mulai = String(item.berlaku_mulai).slice(0, 10);
  form.minimum_km = 5;
  form.maximum_km = 25;
}

async function saveSetting() {
  saving.value = true;
  error.value = "";
  message.value = "";

  try {
    const payload = {
      base_fare: Number(form.base_fare),
      berlaku_mulai: form.berlaku_mulai,
      minimum_km: 5,
      maximum_km: 25,
    };

    const res = await request(editingId.value ? `/transport/settings/${editingId.value}` : "/transport/settings", {
      method: editingId.value ? "PATCH" : "POST",
      body: payload,
    });

    message.value = res.message || "Tarif berhasil disimpan.";
    resetForm();
    await loadSettings();
  } catch (e) {
    error.value = e?.data?.message || "Gagal menyimpan tarif.";
  } finally {
    saving.value = false;
  }
}

async function removeSetting(item) {
  if (!confirm("Yakin ingin menghapus pengaturan tarif ini?")) return;

  error.value = "";
  message.value = "";

  try {
    await request(`/transport/settings/${item.id}`, {
      method: "DELETE",
    });

    message.value = "Tarif berhasil dihapus.";
    await loadSettings();
  } catch (e) {
    error.value = e?.data?.message || "Gagal menghapus tarif.";
  }
}

onMounted(loadSettings);
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="invisible">Pengaturan Tarif Transport</h2>
      <NuxtLink to="/tunjangan/transport" class="btn"> Kembali </NuxtLink>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="message" class="alert alert-success">{{ message }}</div>

    <div class="card mb-3">
      <div class="card-header">
        <h3 class="card-title">
          {{ editingId ? "Edit Tarif" : "Tambah Tarif" }}
        </h3>
      </div>

      <form @submit.prevent="saveSetting">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Tarif Dasar (Rp/km)</label>
              <input v-model.number="form.base_fare" type="number" min="1" max="1000000" class="form-control" required />
            </div>

            <div class="col-md-6">
              <label class="form-label">Berlaku Mulai</label>
              <input v-model="form.berlaku_mulai" type="date" class="form-control" required />
            </div>

            <div class="col-md-6">
              <label class="form-label">Minimum Jarak</label>
              <input :value="5" class="form-control" disabled />
            </div>

            <div class="col-md-6">
              <label class="form-label">Maksimum Jarak</label>
              <input :value="25" class="form-control" disabled />
            </div>
          </div>
        </div>

        <div class="card-footer d-flex justify-content-end gap-2">
          <button v-if="editingId" type="button" class="btn" @click="resetForm">Batal Edit</button>

          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? "Menyimpan..." : "Simpan Tarif" }}
          </button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Tarif Dasar</th>
              <th>Berlaku Mulai</th>
              <th>Jarak</th>
              <th>Aksi</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="text-center">Memuat...</td>
            </tr>

            <tr v-for="(item, i) in settings" :key="item.id">
              <td>{{ i + 1 }}</td>
              <td>{{ rupiah(item.base_fare) }}/km</td>
              <td>{{ item.berlaku_mulai }}</td>
              <td>{{ item.minimum_km }}–{{ item.maximum_km }} km</td>
              <td>
                <button class="btn btn-sm btn-outline-primary me-2" @click="editSetting(item)">Edit</button>
                <button class="btn btn-sm btn-outline-danger" @click="removeSetting(item)">Hapus</button>
              </td>
            </tr>

            <tr v-if="!loading && settings.length === 0">
              <td colspan="5" class="text-center">Belum ada pengaturan tarif.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
