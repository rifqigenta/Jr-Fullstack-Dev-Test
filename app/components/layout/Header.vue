<script setup>
import { IconMoon, IconSun, IconBell, IconUser, IconKey, IconLogout } from "@tabler/icons-vue";

const { user, logout } = useAuth();
const { toggleTheme } = useTheme();
const { toggleSidebar } = useSidebar();

const loggingOut = ref(false);

const displayName = computed(() => {
  return user.value?.nama || user.value?.nama_lengkap || user.value?.username || "Pengguna";
});

const displayRole = computed(() => {
  return user.value?.nama_role || "Pengguna";
});

const initials = computed(() => {
  const name = displayName.value.trim();

  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "US"
  );
});

async function handleLogout() {
  if (loggingOut.value) return;

  loggingOut.value = true;

  try {
    await logout();
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <header id="navbar" class="navbar navbar-expand-lg d-print-none sticky-top">
    <div class="container-xl justify-content">
      <!-- Sidebar toggle desktop -->
      <button class="sidebar-toggler d-none d-lg-block" type="button" aria-label="Toggle sidebar" @click="toggleSidebar()">
        <span class="sidebar-icon"></span>
      </button>

      <!-- Sidebar toggle mobile -->
      <button class="navbar-toggler" type="button" data-bs-toggle="offcanvas" data-bs-target="#sidebar-menu" aria-label="Open sidebar">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="navbar-nav flex-row order-md-last ms-md-auto">
        <!-- Theme toggle -->
        <button type="button" class="nav-link px-0 btn-toggle-theme hide-theme-dark" title="Enable dark mode" @click="toggleTheme()">
          <IconMoon :size="22" :stroke="1.8" />
        </button>

        <button type="button" class="nav-link px-0 btn-toggle-theme hide-theme-light" title="Enable light mode" @click="toggleTheme()">
          <IconSun :size="22" :stroke="1.8" />
        </button>

        <!-- Notifications -->
        <div class="nav-item dropdown">
          <a href="#" class="nav-link d-flex lh-1 text-reset p-0 me-3" data-bs-toggle="dropdown" aria-label="Show notifications" @click.prevent>
            <IconBell :size="22" :stroke="1.8" />

            <!-- Tidak menampilkan badge merah
                 karena belum ada notifikasi baru -->
          </a>

          <div class="dropdown-menu dropdown-menu-arrow dropdown-menu-end dropdown-menu-card">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Notifikasi</h3>
              </div>

              <div class="card-body text-center py-4">
                <IconBell :size="28" :stroke="1.5" class="text-secondary mb-2" />

                <p class="text-secondary mb-0">Belum ada notifikasi.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- User dropdown -->
        <div class="nav-item dropdown">
          <a href="#" class="nav-link d-flex lh-1 text-reset p-0 dropdown-toggle" data-bs-toggle="dropdown" aria-label="Open user menu" @click.prevent>
            <span class="bg-primary text-white avatar rounded-circle">
              {{ initials }}
            </span>

            <div class="d-none d-xl-block ps-2">
              <div class="fw-bold">
                {{ displayName }}
              </div>

              <div class="mt-1 small text-primary">
                {{ displayRole }}
              </div>
            </div>
          </a>

          <div class="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
            <div class="dropdown-header">
              <div class="fw-semibold">
                {{ displayName }}
              </div>

              <div class="text-secondary small">
                {{ displayRole }}
              </div>
            </div>

            <div class="dropdown-divider"></div>

            <NuxtLink to="/user/profile" class="dropdown-item">
              <IconUser :size="18" class="me-2" />
              My Profile
            </NuxtLink>

            <NuxtLink to="/user/change-password" class="dropdown-item">
              <IconKey :size="18" class="me-2" />
              Change Password
            </NuxtLink>

            <div class="dropdown-divider"></div>

            <button type="button" class="dropdown-item text-danger" :disabled="loggingOut" @click="handleLogout">
              <IconLogout :size="18" class="me-2" />

              {{ loggingOut ? "Keluar..." : "Logout" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
