<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { auth, logout } from "../api/client";

const route = useRoute();
const router = useRouter();

const user = computed(() => auth.user);

const navs = [
  { path: "/", label: "首页", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { path: "/dns", label: "DNS", icon: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" },
  { path: "/workers", label: "Workers", icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z" },
  { path: "/storage", label: "存储", icon: "M4 6h16v4H4zM4 12h16v4H4zM6 18h12" },
  { path: "/settings", label: "设置", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" },
];

function isActive(p: string) {
  return route.path === p || (p !== "/" && route.path.startsWith(p));
}

function onLogout() {
  logout();
  router.replace("/login");
}
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div class="brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="logo">
          <path d="M12 2c3.5 0 6 2.5 6 6 0 1.5-.6 2.9-1.5 3.9C18 13.3 19 15 19 17c0 2.8-3 5-7 5s-7-2.2-7-5c0-2 1-3.7 2.5-5.1C6.6 10.9 6 9.5 6 8c0-3.5 2.5-6 6-6z" />
        </svg>
        <span>CF Panel</span>
      </div>
      <div class="right">
        <span class="user">{{ user?.email ?? user?.username ?? "未登录" }}</span>
        <button class="logout" @click="onLogout">退出</button>
      </div>
    </header>

    <main class="content">
      <router-view />
    </main>

    <nav class="tabbar">
      <router-link
        v-for="n in navs"
        :key="n.path"
        :to="n.path"
        class="tab"
        :class="{ active: isActive(n.path) }"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path :d="n.icon" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ n.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #0b1220;
  color: #e8edf5;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(11, 18, 32, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
}
.brand .logo {
  width: 22px;
  height: 22px;
  color: #f69a22;
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user {
  font-size: 12px;
  color: #8b95a9;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.logout {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #aab3c5;
  font-size: 12px;
  cursor: pointer;
}
.content {
  flex: 1;
  padding: 16px 16px 100px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: rgba(13, 21, 38, 0.96);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 30;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0 6px;
  color: #6b768a;
  text-decoration: none;
  font-size: 11px;
}
.tab svg {
  width: 22px;
  height: 22px;
}
.tab.active {
  color: #f69a22;
}
</style>