<template>
  <section class="stats-page">
    <article class="stats-panel">
      <div class="section-head">
        <div>
          <h2>{{ t('stats.title') }}</h2>
          <p>{{ t('stats.description') }}</p>
        </div>
      </div>

      <div v-if="problemsStore.loading" class="state-box">
        {{ t('messages.loadProblems') }}
      </div>

      <div v-else class="stats-stack">
        <div class="top-metrics">
          <article class="metric-card">
            <span>{{ t('stats.total') }}</span>
            <strong>{{ problemsStore.totalProblems }}</strong>
          </article>
          <article class="metric-card accent">
            <span>{{ t('stats.solveRate') }}</span>
            <strong>{{ problemsStore.solveRate }}%</strong>
          </article>
          <article class="metric-card success">
            <span>{{ t('stats.solved') }}</span>
            <strong>{{ problemsStore.solvedCount }}</strong>
          </article>
          <article class="metric-card">
            <span>{{ t('stats.unsolved') }}</span>
            <strong>{{ problemsStore.unsolvedCount }}</strong>
          </article>
        </div>

        <div class="two-column">
          <article class="card">
            <h3>{{ t('stats.byDifficulty') }}</h3>
            <div class="difficulty-list">
              <div v-for="item in difficultyStats" :key="item.key" class="difficulty-item">
                <div class="difficulty-meta">
                  <span class="difficulty-name">{{ item.label }}</span>
                  <span>{{ item.solved }}/{{ item.total }}</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" :class="item.key" :style="{ width: `${item.rate}%` }"></div>
                </div>
                <span class="rate-label">{{ item.rate }}%</span>
              </div>
            </div>
          </article>

          <article class="card">
            <h3>{{ t('stats.distribution') }}</h3>
            <div class="distribution-list">
              <div v-for="item in distributionStats" :key="item.key" class="distribution-row">
                <div class="distribution-label">
                  <span class="legend" :class="item.key"></span>
                  <span>{{ item.label }}</span>
                </div>
                <div class="distribution-bar">
                  <div class="distribution-fill" :class="item.key" :style="{ width: `${item.share}%` }"></div>
                </div>
                <strong>{{ item.share }}%</strong>
              </div>
            </div>
          </article>
        </div>

        <div class="two-column">
          <article class="card">
            <h3>{{ t('stats.topTags') }}</h3>
            <div v-if="topTags.length" class="tag-ranking">
              <div v-for="tag in topTags" :key="tag.name" class="tag-row">
                <div>
                  <strong>{{ tag.name }}</strong>
                  <p>{{ t('stats.count') }}: {{ tag.count }}</p>
                </div>
                <span class="tag-score">{{ tag.solved }}/{{ tag.count }}</span>
              </div>
            </div>
            <p v-else class="empty-copy">{{ t('stats.noTags') }}</p>
          </article>

          <article class="card">
            <h3>{{ t('stats.recent') }}</h3>
            <div v-if="problemsStore.recentProblems.length" class="recent-list">
              <div v-for="problem in problemsStore.recentProblems" :key="problem.id" class="recent-row">
                <div>
                  <strong>{{ problem.title }}</strong>
                  <p>#{{ problem.number }} · {{ formatDate(problem.updatedAt || problem.date) }}</p>
                </div>
                <span class="status-pill" :class="{ solved: problem.isSolved }">
                  {{ problem.isSolved ? t('labels.solved') : t('labels.unsolved') }}
                </span>
              </div>
            </div>
            <p v-else class="empty-copy">{{ t('stats.noRecent') }}</p>
          </article>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useProblemsStore } from '../stores/problems';

const { t, locale } = useI18n({ useScope: 'global' });
const problemsStore = useProblemsStore();

onMounted(async () => {
  if (!problemsStore.problems.length) {
    await problemsStore.fetchProblems();
  }
});

const difficultyStats = computed(() => [
  {
    key: 'easy',
    label: t('difficulty.easy'),
    total: problemsStore.easyCount,
    solved: problemsStore.easySolvedCount,
    rate: problemsStore.easyCount ? Math.round((problemsStore.easySolvedCount / problemsStore.easyCount) * 100) : 0,
  },
  {
    key: 'medium',
    label: t('difficulty.medium'),
    total: problemsStore.mediumCount,
    solved: problemsStore.mediumSolvedCount,
    rate: problemsStore.mediumCount
      ? Math.round((problemsStore.mediumSolvedCount / problemsStore.mediumCount) * 100)
      : 0,
  },
  {
    key: 'hard',
    label: t('difficulty.hard'),
    total: problemsStore.hardCount,
    solved: problemsStore.hardSolvedCount,
    rate: problemsStore.hardCount ? Math.round((problemsStore.hardSolvedCount / problemsStore.hardCount) * 100) : 0,
  },
]);

const distributionStats = computed(() => {
  const total = problemsStore.totalProblems || 1;

  return [
    {
      key: 'easy',
      label: t('difficulty.easy'),
      share: Math.round((problemsStore.easyCount / total) * 100),
    },
    {
      key: 'medium',
      label: t('difficulty.medium'),
      share: Math.round((problemsStore.mediumCount / total) * 100),
    },
    {
      key: 'hard',
      label: t('difficulty.hard'),
      share: Math.round((problemsStore.hardCount / total) * 100),
    },
  ];
});

const topTags = computed(() => {
  const tagMap = new Map<string, { name: string; count: number; solved: number }>();

  for (const problem of problemsStore.problems) {
    const tags = (problem.tag || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const tag of tags) {
      const current = tagMap.get(tag) || { name: tag, count: 0, solved: 0 };
      current.count += 1;
      current.solved += problem.isSolved ? 1 : 0;
      tagMap.set(tag, current);
    }
  }

  return [...tagMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8);
});

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-TW' : 'en-US', {
    dateStyle: 'medium',
  }).format(new Date(value));
}
</script>

<style scoped>
.stats-page {
  display: grid;
}

.stats-panel,
.card,
.metric-card {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(247, 244, 236, 0.96);
  color: #172230;
  box-shadow: 0 16px 40px rgba(10, 18, 28, 0.18);
}

.stats-panel {
  padding: 24px;
}

.section-head h2 {
  margin: 0 0 8px;
}

.section-head p {
  color: #66717f;
}

.stats-stack {
  display: grid;
  gap: 22px;
  margin-top: 24px;
}

.top-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  padding: 20px;
}

.metric-card span {
  color: #687484;
}

.metric-card strong {
  display: block;
  margin-top: 10px;
  font-size: clamp(1.8rem, 4vw, 2.5rem);
}

.metric-card.accent {
  background: linear-gradient(135deg, #ffe3b9, #fff4e1);
}

.metric-card.success {
  background: linear-gradient(135deg, #d8f6ea, #eefcf6);
}

.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.card {
  padding: 22px;
}

.card h3 {
  margin: 0 0 18px;
}

.difficulty-list,
.distribution-list,
.tag-ranking,
.recent-list {
  display: grid;
  gap: 14px;
}

.difficulty-meta,
.distribution-row,
.tag-row,
.recent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.difficulty-item {
  display: grid;
  gap: 8px;
}

.difficulty-name {
  font-weight: 700;
}

.bar-track,
.distribution-bar {
  width: 100%;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e8edf2;
}

.bar-fill,
.distribution-fill {
  height: 100%;
  border-radius: 999px;
}

.bar-fill.easy,
.distribution-fill.easy,
.legend.easy {
  background: #29a36a;
}

.bar-fill.medium,
.distribution-fill.medium,
.legend.medium {
  background: #f0ad2c;
}

.bar-fill.hard,
.distribution-fill.hard,
.legend.hard {
  background: #d64b4b;
}

.distribution-label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 96px;
}

.legend {
  display: inline-flex;
  width: 12px;
  height: 12px;
  border-radius: 999px;
}

.distribution-bar {
  flex: 1;
}

.tag-row,
.recent-row {
  padding: 14px;
  border-radius: 18px;
  background: #ffffff;
}

.tag-row p,
.recent-row p,
.empty-copy,
.state-box {
  color: #66717f;
}

.tag-score,
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #edf2f7;
}

.status-pill.solved {
  background: #1f8f63;
  color: white;
}

.state-box {
  padding: 34px 18px;
}

@media (max-width: 980px) {
  .top-metrics,
  .two-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .stats-panel,
  .card {
    padding: 18px;
  }

  .top-metrics,
  .two-column {
    grid-template-columns: 1fr;
  }

  .distribution-row,
  .tag-row,
  .recent-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
