import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import AuthPage from '../features/auth/AuthPage.vue';
import AccountPage from '../features/auth/AccountPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    {
      path: '/login',
      name: 'login',
      component: AuthPage,
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: AuthPage,
      meta: { guestOnly: true },
    },
    {
      path: '/account',
      name: 'account',
      component: AccountPage,
      meta: { requiresAuth: true },
    },
  ],
});
