<script setup>
import RestroomMap from "./components/RestroomMap.vue";
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <div class="brand">
        <div class="brand-icon-wrap" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd"
              d="M14 2C9.582 2 6 5.582 6 10c0 6.627 7.2 15.2 7.51 15.57a.64.64 0 0 0 .98 0C14.8 25.2 22 16.627 22 10c0-4.418-3.582-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
              fill="currentColor"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1 class="brand-title">Restroom Map</h1>
          <p class="brand-tagline">Find &amp; share public restrooms</p>
        </div>
      </div>
    </div>
  </header>
  <main class="app-body">
    <RestroomMap />
  </main>
</template>

<style scoped>
/* ── Frosted glass nav bar ───────────────────── */
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
  background: var(--color-surface-blur);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border-bottom: 1px solid var(--color-separator);
  padding-top: calc(var(--safe-top) + 8px);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 20px 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.brand-tagline {
  margin: 0;
  font-size: 0.78125rem;
  color: var(--color-text-secondary);
}

/* ── App body ────────────────────────────────── */
.app-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0 20px 20px;
}

@media (max-width: 768px) {
  .app-body {
    padding: 0;
    max-width: none;
  }
}
</style>
