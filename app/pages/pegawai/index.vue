<script setup>
import { IconPencil, IconPlus, IconSearch, IconTrash, IconFileDescription } from "@tabler/icons-vue";

definePageMeta({
  title: "Data Pegawai",
  layout: false,
});

useSeoMeta({ title: "Data Pegawai" });

const { request } = useApi();

const employees = ref([]);
const pagination = ref({});
const loading = ref(false);
const error = ref("");

const page = ref(1);
const search = ref("");
const keyword = ref("");
const statusKontrak = ref("");

async function loadEmployees() {
  loading.value = true;
  error.value = "";

  try {
    const response = await request("/employees", {
      query: {
        page: page.value,
        limit: 10,
        search: keyword.value,
        ...(statusKontrak.value ? { status_kontrak: statusKontrak.value } : {}),
      },
    });

    employees.value = response.data || [];
    pagination.value = response.pagination || {};
  } catch (e) {
    error.value = e?.data?.message || "Gagal mengambil data pegawai.";
  } finally {
    loading.value = false;
  }
}

function submitSearch() {
  page.value = 1;
  keyword.value = search.value.trim();
  loadEmployees();
}

function changePage(nextPage) {
  if (nextPage < 1) return;

  page.value = nextPage;
  loadEmployees();
}

async function deleteEmployee(employee) {
  if (!confirm(`Hapus pegawai ${employee.nama_pegawai}?`)) {
    return;
  }

  try {
    await request(`/employees/${employee.id}`, {
      method: "DELETE",
    });

    await loadEmployees();
  } catch (e) {
    alert(e?.data?.message || "Gagal menghapus pegawai.");
  }
}

watch(statusKontrak, () => {
  page.value = 1;
  loadEmployees();
});

onMounted(loadEmployees);
</script>

<template>
  <NuxtLayout name="default">
    <template #actions>
      <NuxtLink to="/pegawai/form" class="btn btn-primary">
        <IconPlus :size="20" />
        Tambah Pegawai
      </NuxtLink>
    </template>

    <div class="card">
      <div class="card-header">
        <div class="d-flex flex-wrap gap-2 ms-auto">
          <select v-model="statusKontrak" class="form-select" style="width: 180px">
            <option value="">Semua Kontrak</option>
            <option value="PKWTT">PKWTT</option>
            <option value="PKWT">PKWT</option>
            <option value="Magang">Magang</option>
          </select>

          <form class="input-group" style="width: 250px" @submit.prevent="submitSearch">
            <input v-model="search" class="form-control" placeholder="Cari pegawai..." />

            <button class="btn" type="submit">
              <IconSearch :size="18" />
            </button>
          </form>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger m-3">
        {{ error }}
      </div>

      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Aksi</th>
              <th>NIP</th>
              <th>Nama</th>
              <th>Jabatan</th>
              <th>Tanggal Masuk</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="text-center py-4">Memuat data...</td>
            </tr>

            <tr v-else-if="employees.length === 0">
              <td colspan="7" class="text-center py-4">Tidak ada data pegawai.</td>
            </tr>

            <tr v-for="(employee, index) in employees" v-else :key="employee.id">
              <td>
                {{ (page - 1) * 10 + index + 1 }}
              </td>

              <td>
                <div class="d-flex gap-2">
                  <NuxtLink :to="`/pegawai/form/${employee.id}`" class="text-dark" title="Edit">
                    <IconPencil :size="20" />
                  </NuxtLink>

                  <NuxtLink :to="`/pegawai/${employee.id}`" class="text-dark" title="Detail">
                    <IconFileDescription :size="20" />
                  </NuxtLink>

                  <button type="button" class="btn btn-link text-danger p-0" title="Hapus" @click="deleteEmployee(employee)">
                    <IconTrash :size="20" />
                  </button>
                </div>
              </td>

              <td>{{ employee.nip }}</td>
              <td>{{ employee.nama_pegawai }}</td>
              <td>
                {{ employee.nama_jabatan || "-" }}
              </td>
              <td>
                {{ employee.tanggal_masuk ? String(employee.tanggal_masuk).slice(0, 10) : "-" }}
              </td>
              <td>
                <span class="badge" :class="employee.status === 'Aktif' ? 'bg-success-lt' : 'bg-secondary-lt'">
                  {{ employee.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card-footer d-flex align-items-center justify-content-between">
        <span class="text-secondary">
          Halaman {{ page }}
          <template v-if="pagination.total"> · {{ pagination.total }} pegawai </template>
        </span>

        <div class="btn-list">
          <button class="btn btn-outline-secondary" :disabled="page <= 1 || loading" @click="changePage(page - 1)">Sebelumnya</button>

          <button class="btn btn-outline-secondary" :disabled="loading || employees.length < 10 || (pagination.totalPages ? page >= pagination.totalPages : false)" @click="changePage(page + 1)">
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>
