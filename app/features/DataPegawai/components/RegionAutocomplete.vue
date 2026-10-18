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
const error = ref("");
const open = ref(false);

let timer;
let version = 0;

watch(
  () => props.modelValue,
  (region) => {
    search.value = region?.kecamatan || "";
  },
  { immediate: true },
);

function closeResults() {
  open.value = false;
}

async function findRegions(text, requestVersion) {
  loading.value = true;

  try {
    const response = await request("/master-data/regions", {
      query: {
        search: text,
        limit: 20,
      },
    });

    if (requestVersion !== version) return;

    results.value = response.data || [];
    open.value = true;
  } catch (value) {
    if (requestVersion !== version) return;

    results.value = [];
    error.value = value?.data?.message || "Gagal mencari kecamatan.";
  } finally {
    if (requestVersion === version) {
      loading.value = false;
    }
  }
}

function handleInput(event) {
  const text = event.target.value;

  search.value = text;
  emit("update:modelValue", null);

  clearTimeout(timer);
  const requestVersion = ++version;

  results.value = [];
  error.value = "";
  open.value = false;
  loading.value = false;

  const keyword = text.trim();

  if (keyword.length < 3) return;

  timer = setTimeout(() => {
    findRegions(keyword, requestVersion);
  }, 300);
}

function selectRegion(region) {
  clearTimeout(timer);
  version++;
  loading.value = false;

  emit("update:modelValue", region);

  search.value = region.kecamatan;
  results.value = [];
  open.value = false;
  error.value = "";
}

onBeforeUnmount(() => {
  clearTimeout(timer);
  version++;
});
</script>

<template>
  <div class="row g-3">
    <div class="col-md-4">
      <label for="region-search" class="form-label required"> Kecamatan </label>

      <div
        class="position-relative"
        @focusout="
          (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              closeResults();
            }
          }
        "
        @keydown.esc="closeResults"
      >
        <input
          id="region-search"
          :value="search"
          type="text"
          maxlength="100"
          class="form-control"
          autocomplete="off"
          placeholder="Ketik minimal 3 karakter"
          :disabled="disabled"
          :aria-expanded="open && results.length > 0"
          aria-controls="region-results"
          @input="handleInput"
          @focus="open = results.length > 0"
        />

        <div v-if="open && results.length" id="region-results" class="list-group w-100 shadow" style="z-index: 20; max-height: 250px; overflow-y: auto">
          <button v-for="region in results" :key="region.id" type="button" class="list-group-item list-group-item-action" :disabled="disabled" @click="selectRegion(region)">
            <strong>{{ region.kecamatan }}</strong>
            <span class="d-block small text-secondary"> {{ region.kabupaten }}, {{ region.provinsi }} </span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="form-hint">Mencari kecamatan...</div>

      <div v-else-if="error" class="text-danger small">
        {{ error }}
      </div>

      <div v-else-if="open && !results.length && search.trim().length >= 3 && !modelValue" class="form-hint">Kecamatan tidak ditemukan.</div>
    </div>

    <div class="col-md-4">
      <label for="region-city" class="form-label required"> Kabupaten/Kota </label>

      <input id="region-city" :value="modelValue?.kabupaten || ''" class="form-control" disabled />
    </div>

    <div class="col-md-4">
      <label for="region-province" class="form-label required"> Provinsi </label>

      <input id="region-province" :value="modelValue?.provinsi || ''" class="form-control" disabled />
    </div>
  </div>
</template>
