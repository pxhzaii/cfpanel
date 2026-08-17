import { createRouter, createWebHistory } from "vue-router";
import { auth } from "../api/client";
import App from "../App.vue";
import Layout from "../components/Layout.vue";
import Login from "../views/Login.vue";
import Home from "../views/Home.vue";
import Dns from "../views/Dns.vue";
import Workers from "../views/Workers.vue";
import Storage from "../views/Storage.vue";
import Settings from "../views/Settings.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: App,
      children: [
        { path: "login", name: "login", component: Login },
        {
          path: "",
          component: Layout,
          children: [
            { path: "", name: "home", component: Home },
            { path: "dns", name: "dns", component: Dns },
            { path: "workers", name: "workers", component: Workers },
            { path: "storage", name: "storage", component: Storage },
            { path: "settings", name: "settings", component: Settings },
          ],
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const loggedIn = !!auth.pass;
  if (to.name !== "login" && !loggedIn) return { name: "login" };
  if (to.name === "login" && loggedIn) return { name: "home" };
  return true;
});

export default router;