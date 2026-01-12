import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import SingleQuery from './views/SingleQuery.vue'
import TestSuite from './views/TestSuite.vue'
import HowItWorks from './views/HowItWorks.vue'

const routes = [
  { path: '/', component: SingleQuery },
  { path: '/q/:id', component: SingleQuery, props: true },
  { path: '/suite', component: TestSuite },
  { path: '/suite/:id', component: TestSuite, props: true },
  { path: '/how-it-works', component: HowItWorks }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

createApp(App).use(router).mount('#app')
