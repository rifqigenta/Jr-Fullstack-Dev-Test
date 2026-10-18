<script setup>
definePageMeta({
  title: "Pengaturan Tarif Transport",

  middleware: [
    () =>
      navigateTo("/tunjangan/transport/settings", {
        replace: true,
        redirectCode: 302,
      }),
  ],
});
</script>

<template>
  <div />
</template>
