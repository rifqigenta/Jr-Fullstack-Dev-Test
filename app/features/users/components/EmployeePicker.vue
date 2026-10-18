<script setup>
const props = defineProps({
  modelValue: {
    type: Object,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);
const { request } = useApi();

const search = ref("");
const results = ref([]);
const loading = ref(false);
const open = ref(false);
const error = ref("");

let timer;
let version = 0;

watch(
  () => props.modelValue,
  (employee) => {
    search.value = employee?.nama_pegawai || "";
  },
  { immediate: true },
);

async function findEmployees(keyword, requestVersion) {
  loading.value = true;

  try {
    const response = await request("/users/employee-options", {
      query: { search: keyword, limit: 20 },
    });

    if (requestVersion !== version) return;

    results.value = response.data || [];
    open.value = true;
  } catch (value) {
    if (requestVersion !== version) return;

    error.value = value?.data?.message || "Gagal mencari pegawai.";
  } finally {
    if (requestVersion === version) {
      loading.value = false;
    }
  }
}

function input(event) {
  search.value = event.target.value;
  emit("update:modelValue", null);

  clearTimeout(timer);

  const requestVersion = ++version;

  results.value = [];
  error.value = "";
  open.value = false;
  loading.value = false;

  const keyword = search.value.trim();

  if (keyword.length < 2) return;

  timer = setTimeout(() => {
    findEmployees(keyword, requestVersion);
  }, 300);
}

function choose(employee) {
  clearTimeout(timer);
  version++;

  loading.value = false;
  open.value = false;
  results.value = [];

  emit("update:modelValue", employee);
  search.value = employee.nama_pegawai;
}

function closeOnBlur(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    open.value = false;
  }
}

onBeforeUnmount(() => {
  clearTimeout(timer);
  version++;
});
</script>

<template>
  <div class="position-relative" @focusout="closeOnBlur" @keydown.esc="open = false">
    <input
      :value="search"
      type="text"
      class="form-control"
      maxlength="100"
      autocomplete="off"
      placeholder="Ketik minimal 2 karakter nama/NIP"
      aria-label="Cari dan pilih pegawai"
      :disabled="disabled"
      :aria-expanded="open"
      @input="input"
      @focus="open = results.length > 0"
    />

    <div v-if="open && results.length" class="list-group position-absolute w-100 shadow" style="z-index: 40; max-height: 240px; overflow-y: auto">
      <button v-for="employee in results" :key="employee.id" type="button" class="list-group-item list-group-item-action" @click="choose(employee)">
        {{ employee.nama_pegawai }}
        <span class="d-block small text-secondary">
          {{ employee.nip }}
        </span>
      </button>
    </div>

    <div v-if="loading" class="form-hint">Mencari pegawai...</div>

    <div v-else-if="error" class="text-danger small">
      {{ error }}
    </div>

    <div v-else-if="open && !results.length && !modelValue" class="form-hint">Tidak ada pegawai yang tersedia.</div>

    <div v-if="modelValue" class="form-hint">Terpilih: {{ modelValue.nip }} — {{ modelValue.nama_pegawai }}</div>
  </div>
</template>
