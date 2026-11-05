<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import Icon from './Icon.vue'

const app = useAppStore()
const router = useRouter()
const menuOpen = ref(false)

async function logout() {
  menuOpen.value = false
  await app.logout()
  router.push('/login')
}

function go(path: string) {
  menuOpen.value = false
  router.push(path)
}
</script>

<template>
  <header id="header" class="menu">
    <h1 id="page-title"><RouterLink to="/">Redlark</RouterLink></h1>

    <nav id="nav">
      <RouterLink class="menu-button" to="/" exact-active-class="active"><span>Songs</span></RouterLink>
      <RouterLink class="menu-button" to="/sets" active-class="active"><span>Sets</span></RouterLink>
      <RouterLink class="menu-button" to="/library" active-class="active"><span>Teams</span></RouterLink>
      <span class="menu-button disabled" title="Coming soon"><span>Records</span></span>
    </nav>

    <div class="header-right">
      <select
        v-if="app.libraries.length > 1"
        class="library-select"
        v-model="app.libraryId"
        title="Library"
      >
        <option v-for="lib in app.libraries" :key="lib.id" :value="lib.id">{{ lib.name }}</option>
      </select>
      <div id="profile" :class="{ open: menuOpen }" @mouseleave="menuOpen = false">
        <button id="profile-icon" @click="menuOpen = !menuOpen" @mouseenter="menuOpen = true" aria-label="Menu">
          <Icon name="circleUser" />
        </button>
        <div id="profile-menu">
          <div id="profile-menu-triangle"></div>
          <div id="profile-menu-options" class="menu">
            <div v-if="app.user" class="profile-name">{{ app.user.name || app.user.email }}</div>
            <button class="menu-button mobile-only" @click="go('/sets')"><Icon name="list" />Sets</button>
            <button class="menu-button mobile-only" @click="go('/library')"><Icon name="users" />Teams</button>
            <button class="menu-button" @click="go('/library')"><Icon name="upload" />Import / Export</button>
            <button class="menu-button" @click="go('/settings')"><Icon name="gear" />Settings</button>
            <button v-if="!app.isLocal" class="menu-button" id="logout-button" @click="logout">
              <Icon name="logout" />Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style>
.menu {
  background-color: var(--menu-bg);
}

#header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  margin: 0;
  height: 40px;
  min-height: 40px;
  position: relative;
  z-index: 30;
}

#page-title {
  color: white;
  margin: 0 0 0 10px;
  min-width: 185px;
  font-size: 2em;
  line-height: 40px;
}

.menu-button {
  background-color: transparent;
  border: 1px solid transparent;
  color: white;
  cursor: pointer;
}

.menu-button:hover {
  background-color: var(--accent);
  border: 1px solid var(--accent-dark);
}

.menu-button:active {
  background-color: var(--accent-light);
  transition-duration: 0s;
}

#nav {
  display: flex;
  justify-content: center;
  flex-direction: row;
}

#nav .menu-button {
  transform: skew(-20deg);
  border-radius: 0 0 5px 5px;
  height: 20px;
  padding: 7px 30px;
  margin: 0 2px;
  display: flex;
  align-items: center;
  transition-duration: 0.1s;
  font-weight: bold;
  font-size: large;
}

#nav .menu-button > * {
  transform: skew(20deg);
}

#nav .menu-button:hover,
#nav .menu-button.active {
  padding-top: 18px;
}

#nav .menu-button.active {
  background-color: var(--accent);
}

#nav .menu-button.disabled {
  opacity: 0.45;
  cursor: default;
}

#nav .menu-button.disabled:hover {
  background: transparent;
  border-color: transparent;
  padding-top: 7px;
}

.header-right {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 185px;
  justify-content: flex-end;
}

.library-select {
  margin-top: 8px;
  background: transparent;
  color: white;
  border: 1px solid #3b4a60;
  border-radius: 4px;
  padding: 3px 6px;
  max-width: 180px;
}

.library-select option {
  color: black;
}

#profile {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

#profile-icon {
  font-size: 30px;
  padding: 5px 6px;
  color: white;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
}

#profile-menu {
  transition-duration: 0.2s;
  visibility: hidden;
  opacity: 0;
  position: absolute;
  top: 40px;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

#profile.open #profile-menu {
  visibility: visible;
  opacity: 1;
}

#profile-menu-triangle {
  width: 0;
  height: 0;
  border-left: 20px solid transparent;
  border-bottom: 7px solid var(--menu-bg);
  margin-right: 20px;
}

#profile-menu-options {
  margin-right: 20px;
  border-radius: 5px 0 5px 5px;
  padding: 5px;
  display: flex;
  flex-direction: column;
  min-width: 180px;
}

.profile-name {
  color: #aab;
  padding: 6px 15px;
  font-size: small;
  text-align: right;
}

#profile-menu-options button {
  text-align: right;
  padding: 10px 15px;
  border-radius: 4px;
  font-size: medium;
  font-weight: bold;
  transition-duration: 0.1s;
  width: 100%;
  margin-bottom: 5px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}

#profile-menu-options button:last-child {
  margin-bottom: 0;
}

#profile-menu-options #logout-button:hover {
  background-color: #dc7700;
  border: 1px solid #cc6e00;
}

.mobile-only {
  display: none !important;
}

@media (max-width: 900px) {
  #nav {
    display: none;
  }
  #page-title {
    min-width: 0;
    font-size: 1.6em;
  }
  .header-right {
    min-width: 0;
  }
  .mobile-only {
    display: flex !important;
  }
}
</style>
