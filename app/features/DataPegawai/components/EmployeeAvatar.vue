<script setup>
const props = defineProps({
  src: {
    type: String,
    default: "",
  },
  name: {
    type: String,
    default: "Pegawai",
  },
  size: {
    type: Number,
    default: 96,
  },
});

const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <div
    class="rounded bg-secondary-lt d-inline-flex align-items-center justify-content-center overflow-hidden flex-shrink-0"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
    }"
  >
    <img v-if="src && !failed" :src="src" :alt="`Foto ${name}`" :width="size" :height="size" class="w-100 h-100" style="object-fit: cover" @error="failed = true" />

    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" role="img" :aria-label="`Avatar ${name}`" :width="size * 0.6" :height="size * 0.6">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </svg>
  </div>
</template>
