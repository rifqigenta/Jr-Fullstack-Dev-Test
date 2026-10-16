<template>
  <div class="row">
    <div class="col-md-6">
      <SettingFrom />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  title: "Setting Tunjangan Transport",
});

await navigateTo("/tunjangan/transport/settings", {
  redirectCode: 302,
  replace: true,
});
</script>
