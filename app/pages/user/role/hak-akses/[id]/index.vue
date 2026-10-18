<script setup>
definePageMeta({ title: "Hak Akses" });

const route = useRoute();
const { request } = useApi();

const role = ref(null);
const loading = ref(true);
const error = ref("");
const ascending = ref(true);

let version = 0;

const permissions = computed(() => {
  const rows = [...(role.value?.permissions || [])];

  return rows.sort((a, b) => {
    const result = String(a.modul_fitur).localeCompare(String(b.modul_fitur), "id");

    return ascending.value ? result : -result;
  });
});

const description = computed(() => {
  if (role.value?.deskripsi) return role.value.deskripsi;

  const modules = (role.value?.permissions || []).filter((item) => item.akses).map((item) => item.modul_fitur);

  return modules.length ? `Memiliki akses ke: ${modules.join(", ")}.` : "Tidak memiliki akses modul.";
});

async function load() {
  const requestVersion = ++version;

  loading.value = true;
  error.value = "";
  role.value = null;

  try {
    const response = await request(`/roles/${route.params.id}/permissions`);

    if (requestVersion !== version) return;
    role.value = response.data;
  } catch (value) {
    if (requestVersion !== version) return;

    error.value = value?.data?.message || "Gagal memuat hak akses.";
  } finally {
    if (requestVersion === version) {
      loading.value = false;
    }
  }
}

onMounted(load);
watch(() => route.params.id, load);

onBeforeUnmount(() => {
  version++;
});
</script>

<template>
  <div>
    <NuxtLink to="/user/role" class="btn mb-3"> Kembali ke Daftar Role </NuxtLink>

    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <div v-if="loading" class="text-center py-4">Memuat hak akses...</div>

    <template v-else-if="role">
      <div class="card mb-3">
        <div class="card-body">
          <div class="mb-3">
            <label for="role-name" class="form-label"> Nama Role </label>

            <input id="role-name" :value="role.nama_role" class="form-control" disabled />
          </div>

          <label for="role-description" class="form-label"> Deskripsi </label>

          <textarea id="role-description" :value="description" rows="3" class="form-control" disabled />
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>No</th>

                <th :aria-sort="ascending ? 'ascending' : 'descending'">
                  <button type="button" class="btn btn-link p-0 text-reset" @click="ascending = !ascending">Modul/Fitur {{ ascending ? "↑" : "↓" }}</button>
                </th>

                <th>Akses</th>
                <th>Create</th>
                <th>Read</th>
                <th>Update</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(item, index) in permissions" :key="item.id">
                <td>{{ index + 1 }}</td>
                <td>{{ item.modul_fitur }}</td>

                <td>
                  <span :class="item.akses ? 'text-success' : 'text-danger'" :aria-label="item.akses ? 'Diizinkan' : 'Tidak diizinkan'">
                    {{ item.akses ? "✓" : "✕" }}
                  </span>
                </td>

                <td>
                  <span :class="item.create ? 'text-success' : 'text-danger'" :aria-label="item.create ? 'Diizinkan' : 'Tidak diizinkan'">
                    {{ item.create ? "✓" : "✕" }}
                  </span>
                </td>

                <td>{{ item.read }}</td>
                <td>{{ item.update }}</td>
                <td>{{ item.delete }}</td>
              </tr>

              <tr v-if="!permissions.length">
                <td colspan="7" class="text-center py-4">Tidak ada data hak akses.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
