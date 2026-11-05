import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles/main.css'
import HomeView from './views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/sets', name: 'sets', component: HomeView, props: { openSets: true } },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/library', name: 'library', component: () => import('./views/LibraryView.vue') },
    { path: '/songs/new', name: 'new-song', component: () => import('./views/SongEditView.vue') },
    { path: '/songs/:id/edit', name: 'edit-song', component: () => import('./views/SongEditView.vue'), props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

createApp(App).use(createPinia()).use(router).mount('#app')
