<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <div class="logo-section">
          <div class="logo">
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" rx="20" fill="url(#lovable-gradient)"/>
              <path d="M50 25C38 25 30 35 30 45C30 60 50 75 50 75C50 75 70 60 70 45C70 35 62 25 50 25Z" fill="white"/>
              <defs>
                <linearGradient id="lovable-gradient" x1="0" y1="0" x2="100" y2="100">
                  <stop offset="0%" stop-color="#FF385C"/>
                  <stop offset="100%" stop-color="#EC4899"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="brand">
            <span class="brand-name">Lovable</span>
            <span class="brand-sub">Search API Comparison</span>
          </div>
        </div>
        <nav class="nav">
          <router-link to="/" class="nav-link">Single Query</router-link>
          <router-link to="/suite" class="nav-link">Test Suite</router-link>
          <router-link to="/how-it-works" class="nav-link">How It Works</router-link>
        </nav>
      </div>
    </header>

    <main class="main">
      <router-view />
    </main>

    <footer class="footer">
      <p>Comparing <strong>Parallel</strong> vs <strong>Firecrawl</strong> vs <strong>Exa</strong> for Lovable.dev</p>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 10, 15, 0.8);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #FF385C, #EC4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.5px;
}

.nav {
  display: flex;
  gap: 8px;
}

.nav-link {
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.nav-link.router-link-active {
  color: #FF385C;
  background: rgba(255, 56, 92, 0.1);
}

.main {
  flex: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px;
  width: 100%;
}

.footer {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.footer strong {
  color: rgba(255, 255, 255, 0.5);
}
</style>
