import JobsPage from '../features/jobs/JobsPage.vue';
import HustlesPage from '../features/hustles/HustlesPage.vue';
import HustlePage from '../features/jobs/HustlePage.vue';
import { createRouter, createWebHistory } from 'vue-router';
import PhonePage from '../pages/PhonePage.vue';
import LockedPage from '../pages/LockedPage.vue';
import WalletPage from '../features/wallet/WalletPage.vue';
import HomePage from '../pages/HomePage.vue';
import AuthPage from '../features/auth/AuthPage.vue';
import AccountPage from '../features/auth/AccountPage.vue';
import CreateCharacterPage from '../features/character/CreateCharacterPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/hustles',
      name: 'hustles',
      component: HustlesPage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/hustles/attempts/:attemptId',
      name: 'hustle-result',
      component: HustlesPage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/hustles/:hustleId',
      name: 'hustle-detail',
      component: HustlesPage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: JobsPage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/jobs/work',
      name: 'job-work',
      component: JobsPage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/jobs/:jobId',
      name: 'job-detail',
      component: JobsPage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/phone',
      name: 'phone',
      component: PhonePage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/city',
      name: 'city',
      component: LockedPage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/hustle',
      name: 'hustle',
      component: HustlePage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/wallet',
      name: 'wallet',
      component: WalletPage,
      meta: { requiresAuth: true, requiresCharacter: true },
    },
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
      meta: { requiresAuth: true, requiresCharacter: true },
    },
    {
      path: '/create-character',
      name: 'create-character',
      component: CreateCharacterPage,
      meta: { requiresAuth: true },
    },
  ],
});
