<template>
  <div class="shell">
    <div class="glow glow-one"></div>
    <div class="glow glow-two"></div>

    <main class="app-frame">
      <header class="masthead">
        <div class="brand-copy">
          <p class="eyebrow">LeetCode Workspace</p>
          <h1>{{ t('appTitle') }}</h1>
          <p class="subtitle">{{ t('appSubtitle') }}</p>
          <div class="hero-card">
            <h2>{{ t('hero.title') }}</h2>
            <p>{{ t('hero.description') }}</p>
          </div>
        </div>

        <div class="masthead-side">
          <div class="locale-switcher">
            <button
              v-for="lang in supportedLocales"
              :key="lang"
              class="locale-btn"
              :class="{ active: currentLocale === lang }"
              @click="changeLocale(lang)"
            >
              {{ lang.toUpperCase() }}
            </button>
          </div>

          <nav class="tab-row">
            <router-link
              v-for="tab in tabs"
              :key="tab.name"
              :to="{ name: tab.name, params: { locale: currentLocale } }"
              class="tab-link"
              :class="{ active: route.name === tab.name }"
            >
              {{ tab.label }}
            </router-link>
          </nav>
        </div>
      </header>

      <section class="page-body">
        <router-view />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const supportedLocales = ['zh', 'en'] as const;

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n({ useScope: 'global' });

const currentLocale = computed(() => {
  const value = route.params.locale as string | undefined;
  return supportedLocales.includes(value as (typeof supportedLocales)[number]) ? value as 'zh' | 'en' : 'zh';
});

watch(
  currentLocale,
  (value) => {
    locale.value = value;
  },
  { immediate: true }
);

const tabs = computed(() => [
  { name: 'list', label: t('tabs.list') },
  { name: 'add', label: t('tabs.add') },
  { name: 'stats', label: t('tabs.stats') },
]);

function changeLocale(newLocale: 'zh' | 'en') {
  if (newLocale === currentLocale.value) {
    return;
  }

  router.push({
    name: (route.name as string) || 'list',
    params: {
      ...route.params,
      locale: newLocale,
    },
  });
}
</script>

<style scoped>
.shell {
  position: relative;
  min-height: 100vh;
  width: 100%;
  padding: 28px;
  overflow: hidden;
}

.glow {
  position: fixed;
  border-radius: 999px;
  filter: blur(18px);
  opacity: 0.55;
  pointer-events: none;
}

.glow-one {
  width: 24rem;
  height: 24rem;
  top: -6rem;
  left: -5rem;
  background: rgba(255, 175, 92, 0.28);
}

.glow-two {
  width: 26rem;
  height: 26rem;
  right: -8rem;
  bottom: 2rem;
  background: rgba(78, 180, 160, 0.22);
}

.app-frame {
  position: relative;
  z-index: 1;
  width: min(1280px, 100%);
  margin: 0 auto;
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background:
    linear-gradient(160deg, rgba(14, 25, 43, 0.88), rgba(26, 46, 67, 0.82)),
    rgba(255, 255, 255, 0.04);
  box-shadow: 0 28px 80px rgba(4, 12, 26, 0.5);
  backdrop-filter: blur(18px);
}

.masthead {
  display: grid;
  grid-template-columns: 1.3fr 0.9fr;
  gap: 24px;
  padding: 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.eyebrow {
  color: #ffd9a4;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.82rem;
}

.brand-copy h1 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.02;
  margin: 0;
}

.subtitle {
  max-width: 42rem;
  color: rgba(239, 243, 248, 0.82);
  font-size: 1.02rem;
}

.hero-card {
  margin-top: 10px;
  width: min(34rem, 100%);
  padding: 18px 20px;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(255, 190, 118, 0.15), rgba(76, 175, 160, 0.12));
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.hero-card h2 {
  margin: 0 0 6px;
  font-size: 1.15rem;
}

.hero-card p {
  margin: 0;
  color: rgba(239, 243, 248, 0.76);
}

.masthead-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 18px;
}

.locale-switcher {
  display: inline-flex;
  gap: 8px;
  padding: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.locale-btn {
  min-width: 72px;
  padding: 10px 14px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.74);
}

.locale-btn.active {
  background: #f8f5ed;
  color: #18222f;
}

.tab-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.tab-link {
  padding: 12px 18px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.06);
}

.tab-link.active {
  color: #12202e;
  background: linear-gradient(135deg, #ffd8a8, #fff1d7);
  border-color: transparent;
}

.page-body {
  padding: 28px 32px 32px;
}

@media (max-width: 960px) {
  .masthead {
    grid-template-columns: 1fr;
  }

  .masthead-side {
    align-items: flex-start;
  }

  .tab-row {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .shell {
    padding: 14px;
  }

  .app-frame {
    border-radius: 24px;
  }

  .masthead {
    padding: 22px;
  }

  .page-body {
    padding: 18px 22px 24px;
  }

  .locale-btn {
    min-width: 60px;
  }
}
</style>
