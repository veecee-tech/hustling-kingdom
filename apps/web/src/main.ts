import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useSystemStore } from './stores/system';
import './assets/main.css';
import { useAuthStore } from './features/auth/store';
import { installAuthGuard } from './features/auth/route-guard';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
installAuthGuard(router, useAuthStore(pinia));
app.use(router);
app.config.errorHandler = () => {
  useSystemStore(pinia).applicationError =
    'Something went wrong. Please reload the page.';
};
router.onError(() => {
  useSystemStore(pinia).applicationError =
    'This page could not be loaded. Please reload the page.';
});
app.mount('#app');
