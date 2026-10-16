<script setup>
import { menuItems } from "~/data/menu.js";

const route = useRoute();
const config = useRuntimeConfig();
const { user } = useAuth();

const openDropdowns = ref([]);

// Role user yang sedang login
const currentRole = computed(() =>
  String(user.value?.nama_role || "")
    .trim()
    .toLowerCase(),
);

// Hak akses menu berdasarkan matriks requirement JMC
const menuPermissions = {
  superadmin: ["/", "/user/role", "/user/manage", "/log"],

  "manager hrd": ["/", "/pegawai", "/tunjangan/transport"],

  "admin hrd": ["/", "/pegawai", "/tunjangan/transport/settings", "/tunjangan/transport"],
};

// Filter menu tanpa mengubah menuItems asli
const filteredMenuItems = computed(() => {
  const allowedPaths = menuPermissions[currentRole.value] || [];

  return menuItems
    .map((item) => {
      // Menu tanpa children
      if (!item.children) {
        return allowedPaths.includes(item.to) ? item : null;
      }

      // Menu dengan children
      const allowedChildren = item.children.filter((child) => allowedPaths.includes(child.to));

      // Sembunyikan parent jika tidak punya child yang diizinkan
      if (allowedChildren.length === 0) {
        return null;
      }

      return {
        ...item,
        children: allowedChildren,
      };
    })
    .filter(Boolean);
});

// Active state
function isActive(path) {
  if (path === "/") {
    return route.path === "/";
  }

  return route.path === path || route.path.startsWith(path + "/");
}

// Active state parent dropdown
function isParentActive(item) {
  if (!item.children) return false;

  return item.children.some((child) => isActive(child.to));
}

// Toggle dropdown
function toggleDropdown(title) {
  const index = openDropdowns.value.indexOf(title);

  if (index === -1) {
    openDropdowns.value.push(title);
  } else {
    openDropdowns.value.splice(index, 1);
  }
}

// Buka dropdown otomatis sesuai route
watch(
  [() => route.path, filteredMenuItems],
  () => {
    filteredMenuItems.value.forEach((item) => {
      if (item.children && isParentActive(item) && !openDropdowns.value.includes(item.title)) {
        openDropdowns.value.push(item.title);
      }
    });
  },
  { immediate: true },
);
</script>

<template>
  <aside class="navbar navbar-vertical navbar-expand-lg navbar-dark sidebar" data-bs-theme="dark">
    <div class="container-fluid px-0 justify-content-start">
      <!-- BRAND -->
      <h1 class="navbar-brand text-white ms-3 ms-lg-0 gap-3">
        <div class="logo">
          <img src="~/assets/images/logo/logo_jmc.png" alt="Logo" height="15" />
        </div>

        <NuxtLink to="/" class="fw-bold hstack gap-3 text-decoration-none text-white">
          <div style="font-size: 0.9rem">
            {{ config.public.appName }}
          </div>
        </NuxtLink>
      </h1>

      <div id="sidebar-menu" class="offcanvas offcanvas-start px-lg-3" tabindex="-1">
        <!-- HEADER -->
        <div class="offcanvas-header">
          <div class="d-flex gap-3 align-items-center">
            <div class="image">
              <img src="~/assets/images/logo/logo_jmc.png" alt="Logo" height="15" />
            </div>

            <div class="logo-text flex-grow-1">
              <h3 class="m-0"></h3>
              <div class="fs-4 fw-bold">
                {{ config.public.appName }}
              </div>
            </div>
          </div>

          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close" />
        </div>

        <!-- BODY -->
        <div class="offcanvas-body p-3 p-lg-0 flex-column flex-grow-1 overflow-auto">
          <ul class="navbar-nav align-items-start pt-lg-3">
            <template v-for="item in filteredMenuItems" :key="item.title">
              <!-- Menu dengan children -->
              <li v-if="item.children" class="nav-item dropdown" :class="{ active: isParentActive(item) }">
                <a
                  class="nav-link dropdown-toggle"
                  href="#"
                  :class="{ active: isParentActive(item) }"
                  data-bs-toggle="dropdown"
                  data-bs-auto-close="false"
                  role="button"
                  :aria-expanded="openDropdowns.includes(item.title) || isParentActive(item)"
                  @click.prevent="toggleDropdown(item.title)"
                >
                  <span class="nav-link-icon d-md-none d-lg-inline-block">
                    <component :is="item.icon" />
                  </span>

                  <span class="nav-link-title">
                    {{ item.title }}
                  </span>
                </a>

                <div
                  class="dropdown-menu"
                  :class="{
                    show: openDropdowns.includes(item.title) || isParentActive(item),
                  }"
                >
                  <div class="dropdown-menu-columns">
                    <div class="dropdown-menu-column">
                      <NuxtLink v-for="child in item.children" :key="child.to" :to="child.to" class="dropdown-item" :class="{ active: isActive(child.to) }">
                        {{ child.title }}
                      </NuxtLink>
                    </div>
                  </div>
                </div>
              </li>

              <!-- Menu biasa -->
              <li v-else class="nav-item">
                <NuxtLink :to="item.to" class="nav-link" :class="{ active: isActive(item.to) }">
                  <span class="nav-link-icon d-md-none d-lg-inline-block">
                    <component :is="item.icon" />
                  </span>

                  <span class="nav-link-title">
                    {{ item.title }}
                  </span>
                </NuxtLink>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </div>
  </aside>
</template>
