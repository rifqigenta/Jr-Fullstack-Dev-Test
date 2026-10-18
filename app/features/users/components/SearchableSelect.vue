<script setup>
const props = defineProps({
  modelValue: {
    type: [Number, String],
    default: "",
  },
  options: {
    type: Array,
    default: () => [],
  },
  label: {
    type: String,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const search = ref("");

const selected = computed(() => props.options.find((item) => String(item.id) === String(props.modelValue)));

const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase();

  return props.options.filter((item) =>
    String(item.nama || "")
      .toLowerCase()
      .includes(keyword),
  );
});

function choose(item) {
  emit("update:modelValue", item.id);
  open.value = false;
  search.value = "";
}

function closeOnBlur(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    open.value = false;
  }
}
</script>

<template>
  <div class="position-relative" @focusout="closeOnBlur" @keydown.esc="open = false">
    <button type="button" class="form-select text-start" :disabled="disabled" :aria-label="label" :aria-expanded="open" @click="open = !open">
      {{ selected?.nama || `Pilih ${label}` }}
    </button>

    <div v-if="open && !disabled" class="position-absolute w-100 bg-white border rounded shadow p-2" style="z-index: 30">
      <input v-model="search" type="search" class="form-control mb-2" :aria-label="`Cari ${label}`" :placeholder="`Cari ${label.toLowerCase()}...`" />

      <div style="max-height: 220px; overflow-y: auto">
        <button v-for="item in filtered" :key="item.id" type="button" class="btn btn-link text-start text-reset w-100" @click="choose(item)">
          {{ item.nama }}
        </button>

        <p v-if="!filtered.length" class="text-secondary p-2 mb-0">Tidak ada pilihan.</p>
      </div>
    </div>
  </div>
</template>
