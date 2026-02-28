<script setup>
import RestroomMap from "./components/RestroomMap.vue";
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <div class="brand">
        <span class="brand-icon">🚻</span>
        <div>
          <h1 class="brand-title">RestRoom Map</h1>
          <p class="brand-tagline">Find &amp; share public restrooms near you</p>
        </div>
      </div>
    </div>
  </header>
  <main class="app-body">
    <RestroomMap />
  </main>
</template>

<style scoped>
.app-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  font-size: 2rem;
  line-height: 1;
}

.brand-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

.brand-tagline {
  margin: 2px 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

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
