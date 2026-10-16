<script setup>
import { IconCircleCheckFilled, IconXboxXFilled } from "@tabler/icons-vue";

definePageMeta({
  title: "Hak Akses",
});

useSeoMeta({
  title: "Hak Akses",
});

const route = useRoute();
const { request } = useApi();

const role = ref(null);
const loading = ref(false);
const error = ref("");

const roleId = computed(() => route.params.id);

const hakAkses = computed(() => {
  return role.value?.permissions || [];
});

async function loadPermissions() {
  loading.value = true;
  error.value = "";
  role.value = null;

  try {
    const response = await request(`/roles/${roleId.value}/permissions`);

    role.value = response.data;
  } catch (e) {
    error.value = e?.data?.message || "Gagal mengambil data hak akses.";
  } finally {
    loading.value = false;
  }
}

watch(roleId, loadPermissions, { immediate: true });
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger">
      {{ error }}

      <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="loadPermissions">Coba Lagi</button>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" />
      <p class="mt-2 text-secondary">Memuat hak akses...</p>
    </div>

    <template v-else-if="role">
      <!-- Informasi Role -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-4 col-lg-3">
              <label class="form-label"> Nama Role </label>

              <input :value="role.nama_role" type="text" class="form-control" readonly disabled />
            </div>

            <div class="col-md-4 col-lg-3">
              <label class="form-label"> Deskripsi </label>

              <input :value="role.deskripsi || '-'" type="text" class="form-control" readonly disabled />
            </div>
          </div>
        </div>
      </div>

      <!-- Tabel Hak Akses -->
      <div class="card">
        <div class="table-responsive card-body p-0">
          <table class="table table-vcenter">
            <thead>
              <tr>
                <th width="5">No</th>
                <th>Modul/Fitur</th>
                <th class="text-center">Akses</th>
                <th class="text-center">Create</th>
                <th>Read</th>
                <th>Update</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(item, index) in hakAkses" :key="item.id">
                <td class="text-center">
                  {{ index + 1 }}
                </td>

                <td>
                  {{ item.modul_fitur }}
                </td>

                <td class="text-center">
                  <IconCircleCheckFilled v-if="item.akses" class="text-green" />
                  <IconXboxXFilled v-else class="text-red" />
                </td>

                <td class="text-center">
                  <IconCircleCheckFilled v-if="item.create" class="text-green" />
                  <IconXboxXFilled v-else class="text-red" />
                </td>

                <td>{{ item.read }}</td>
                <td>{{ item.update }}</td>
                <td>{{ item.delete }}</td>
              </tr>

              <tr v-if="hakAkses.length === 0">
                <td colspan="7" class="text-center py-4 text-secondary">Belum ada data hak akses.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
