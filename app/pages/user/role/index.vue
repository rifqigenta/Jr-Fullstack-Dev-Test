<script setup>
import { IconSearch } from "@tabler/icons-vue";

definePageMeta({
  title: "Manajemen Role",
});

useSeoMeta({
  title: "Manajemen Role",
});

const { request } = useApi();

const roles = ref([]);
const loading = ref(false);
const error = ref("");

const selectedRole = ref("");
const searchInput = ref("");
const keyword = ref("");
const currentPage = ref(1);
const perPage = 10;

const filteredRoles = computed(() => {
  return roles.value.filter((role) => {
    const matchesRole = !selectedRole.value || String(role.id) === String(selectedRole.value);

    const matchesSearch = role.nama_role.toLowerCase().includes(keyword.value.toLowerCase());

    return matchesRole && matchesSearch;
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRoles.value.length / perPage)));

const paginatedRoles = computed(() => {
  const start = (currentPage.value - 1) * perPage;
  return filteredRoles.value.slice(start, start + perPage);
});

watch([selectedRole, keyword], () => {
  currentPage.value = 1;
});

async function loadRoles() {
  loading.value = true;
  error.value = "";

  try {
    const response = await request("/roles");
    roles.value = Array.isArray(response.data) ? response.data : [];
  } catch (e) {
    error.value = e?.data?.message || "Gagal mengambil data manajemen role.";
  } finally {
    loading.value = false;
  }
}

function applySearch() {
  keyword.value = searchInput.value.trim();
}

onMounted(loadRoles);
</script>

<template>
  <div class="card">
    <div class="card-header">
      <div class="d-flex gap-2 ms-auto flex-wrap">
        <!-- Filter Role -->
        <select v-model="selectedRole" class="form-select" style="width: 180px">
          <option value="">Semua Role</option>

          <option v-for="role in roles" :key="role.id" :value="String(role.id)">
            {{ role.nama_role }}
          </option>
        </select>

        <!-- Search -->
        <form class="input-group" style="width: 250px" @submit.prevent="applySearch">
          <input v-model="searchInput" type="text" class="form-control" placeholder="Cari Data ..." />

          <button class="btn" type="submit">
            <IconSearch :stroke="2" />
          </button>
        </form>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger m-3">
      {{ error }}

      <button class="btn btn-sm btn-outline-danger ms-2" @click="loadRoles">Coba Lagi</button>
    </div>

    <div class="table-responsive card-body p-0">
      <table class="table table-vcenter">
        <thead>
          <tr>
            <th width="5">No</th>
            <th>Role</th>
            <th>Deskripsi</th>
            <th class="text-center">Aksi</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td colspan="4" class="text-center py-4">Memuat data role...</td>
          </tr>

          <tr v-for="(item, index) in paginatedRoles" :key="item.id">
            <td class="text-center">
              {{ (currentPage - 1) * perPage + index + 1 }}
            </td>

            <td>{{ item.nama_role }}</td>

            <td>
              {{ item.deskripsi || "-" }}
            </td>

            <td class="text-center">
              <NuxtLink :to="`/user/role/hak-akses/${item.id}`" class="btn btn-sm btn-primary"> Hak Akses </NuxtLink>
            </td>
          </tr>

          <tr v-if="!loading && !error && paginatedRoles.length === 0">
            <td colspan="4" class="text-center py-4">Tidak ada data role.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="card-footer d-flex align-items-center">
      <span class="text-secondary"> Total {{ filteredRoles.length }} role </span>

      <ul class="pagination ms-auto m-0">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button type="button" class="page-link" :disabled="currentPage === 1" @click="currentPage--">Sebelumnya</button>
        </li>

        <li v-for="pageNumber in totalPages" :key="pageNumber" class="page-item" :class="{ active: currentPage === pageNumber }">
          <button type="button" class="page-link" @click="currentPage = pageNumber">
            {{ pageNumber }}
          </button>
        </li>

        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button type="button" class="page-link" :disabled="currentPage === totalPages" @click="currentPage++">Berikutnya</button>
        </li>
      </ul>
    </div>
  </div>
</template>
