<template>
  <section class="page">
    <div class="summary-grid">
      <article class="metric-card">
        <span class="metric-label">{{ t('stats.total') }}</span>
        <strong class="metric-value">{{ problemsStore.totalProblems }}</strong>
      </article>
      <article class="metric-card solved">
        <span class="metric-label">{{ t('stats.solved') }}</span>
        <strong class="metric-value">{{ problemsStore.solvedCount }}</strong>
      </article>
      <article class="metric-card">
        <span class="metric-label">{{ t('stats.unsolved') }}</span>
        <strong class="metric-value">{{ problemsStore.unsolvedCount }}</strong>
      </article>
      <article class="metric-card accent">
        <span class="metric-label">{{ t('stats.solveRate') }}</span>
        <strong class="metric-value">{{ problemsStore.solveRate }}%</strong>
      </article>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>{{ t('labels.allProblems') }}</h2>
          <p>{{ t('labels.summary') }}</p>
        </div>
      </div>

      <div class="filters">
        <input
          v-model="searchQuery"
          class="field search-field"
          type="text"
          :placeholder="t('labels.searchPlaceholder')"
        />

        <select v-model="difficultyFilter" class="field">
          <option value="">{{ t('labels.allDifficulties') }}</option>
          <option value="Easy">{{ t('difficulty.easy') }}</option>
          <option value="Medium">{{ t('difficulty.medium') }}</option>
          <option value="Hard">{{ t('difficulty.hard') }}</option>
        </select>

        <select v-model="statusFilter" class="field">
          <option value="">{{ t('labels.allStatuses') }}</option>
          <option value="solved">{{ t('labels.solved') }}</option>
          <option value="unsolved">{{ t('labels.unsolved') }}</option>
        </select>

        <select v-model="tagFilter" class="field">
          <option value="">{{ t('labels.allTags') }}</option>
          <option v-for="tag in problemsStore.availableTags" :key="tag" :value="tag">
            {{ tag }}
          </option>
        </select>
      </div>

      <div v-if="problemsStore.loading" class="state-box">
        {{ t('messages.loadProblems') }}
      </div>

      <div v-else-if="problemsStore.error" class="state-box error">
        <p>{{ t('messages.fetchFailed') }}</p>
        <p>{{ problemsStore.error }}</p>
        <p>{{ t('messages.noBackend') }}</p>
      </div>

      <div v-else-if="filteredProblems.length === 0" class="state-box">
        <p>{{ t('labels.noProblems') }}</p>
        <p>{{ t('labels.emptyFilter') }}</p>
      </div>

      <div v-else class="table-wrap">
        <table class="problems-table">
          <thead>
            <tr>
              <th>{{ t('labels.problemNumber') }}</th>
              <th>{{ t('labels.title') }}</th>
              <th>{{ t('labels.difficulty') }}</th>
              <th>{{ t('labels.tag') }}</th>
              <th>{{ t('labels.status') }}</th>
              <th>{{ t('labels.updatedAt') }}</th>
              <th>{{ t('labels.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="problem in filteredProblems" :key="problem.id">
              <td class="mono">#{{ problem.number }}</td>
              <td>
                <button class="link-btn" @click="openDetail(problem)">
                  {{ problem.title }}
                </button>
              </td>
              <td>
                <span class="difficulty-pill" :class="problem.difficulty.toLowerCase()">
                  {{ t(`difficulty.${problem.difficulty.toLowerCase()}`) }}
                </span>
              </td>
              <td>
                <div class="tag-list">
                  <span
                    v-for="tag in parseTags(problem.tag)"
                    :key="`${problem.id}-${tag}`"
                    class="tag-pill"
                  >
                    {{ tag }}
                  </span>
                  <span v-if="parseTags(problem.tag).length === 0" class="muted">-</span>
                </div>
              </td>
              <td>
                <button
                  class="status-pill"
                  :class="{ solved: problem.isSolved }"
                  @click="toggleSolved(problem)"
                >
                  {{ problem.isSolved ? t('labels.solved') : t('labels.unsolved') }}
                </button>
              </td>
              <td>{{ formatDate(problem.updatedAt || problem.date) }}</td>
              <td>
                <div class="action-row">
                  <button class="action-btn" @click="editProblem(problem)">
                    {{ t('labels.edit') }}
                  </button>
                  <button class="action-btn danger" @click="removeProblem(problem)">
                    {{ t('labels.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="selectedProblem" class="modal-backdrop" @click="selectedProblem = null">
      <article class="modal-card" @click.stop>
        <div class="modal-head">
          <div>
            <p class="eyebrow">{{ t('labels.quickView') }}</p>
            <h3>{{ selectedProblem.title }}</h3>
          </div>
          <button class="close-btn" @click="selectedProblem = null">{{ t('labels.close') }}</button>
        </div>

        <div class="detail-grid">
          <div class="detail-item">
            <span>{{ t('labels.number') }}</span>
            <strong>#{{ selectedProblem.number }}</strong>
          </div>
          <div class="detail-item">
            <span>{{ t('labels.difficulty') }}</span>
            <strong>{{ t(`difficulty.${selectedProblem.difficulty.toLowerCase()}`) }}</strong>
          </div>
          <div class="detail-item">
            <span>{{ t('labels.status') }}</span>
            <strong>{{ selectedProblem.isSolved ? t('labels.solved') : t('labels.unsolved') }}</strong>
          </div>
          <div class="detail-item">
            <span>{{ t('labels.lastUpdated') }}</span>
            <strong>{{ formatDate(selectedProblem.updatedAt || selectedProblem.date) }}</strong>
          </div>
        </div>

        <div class="detail-block">
          <span class="block-title">{{ t('labels.tag') }}</span>
          <div class="tag-list">
            <span v-for="tag in parseTags(selectedProblem.tag)" :key="tag" class="tag-pill">{{ tag }}</span>
            <span v-if="parseTags(selectedProblem.tag).length === 0" class="muted">-</span>
          </div>
        </div>

        <div class="detail-block">
          <span class="block-title">{{ t('labels.note') }}</span>
          <p class="note-box">{{ selectedProblem.note || t('labels.noData') }}</p>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useProblemsStore, type Problem } from '../stores/problems';

const { t, locale } = useI18n({ useScope: 'global' });
const router = useRouter();
const problemsStore = useProblemsStore();

const searchQuery = ref('');
const difficultyFilter = ref('');
const statusFilter = ref('');
const tagFilter = ref('');
const selectedProblem = ref<Problem | null>(null);

onMounted(async () => {
  if (!problemsStore.problems.length) {
    await problemsStore.fetchProblems();
  }
});

const filteredProblems = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  return problemsStore.problems.filter((problem) => {
    const tags = parseTags(problem.tag);
    const searchable = [problem.title, problem.note || '', problem.tag || ''].join(' ').toLowerCase();

    const matchesSearch = !keyword || searchable.includes(keyword);
    const matchesDifficulty = !difficultyFilter.value || problem.difficulty === difficultyFilter.value;
    const matchesStatus =
      !statusFilter.value ||
      (statusFilter.value === 'solved' && problem.isSolved) ||
      (statusFilter.value === 'unsolved' && !problem.isSolved);
    const matchesTag = !tagFilter.value || tags.includes(tagFilter.value);

    return matchesSearch && matchesDifficulty && matchesStatus && matchesTag;
  });
});

function parseTags(value?: string | null) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-TW' : 'en-US', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function openDetail(problem: Problem) {
  selectedProblem.value = problem;
}

function editProblem(problem: Problem) {
  problemsStore.selectProblem(problem);
  router.push({ name: 'add', params: { locale: locale.value } });
}

async function removeProblem(problem: Problem) {
  if (!problem.id) {
    return;
  }

  if (!window.confirm(t('messages.deleteConfirm'))) {
    return;
  }

  try {
    await problemsStore.deleteProblem(problem.id);
    if (selectedProblem.value?.id === problem.id) {
      selectedProblem.value = null;
    }
  } catch (error) {
    console.error(error);
    window.alert(t('messages.deleteFailed'));
  }
}

async function toggleSolved(problem: Problem) {
  try {
    await problemsStore.toggleSolved(problem);
  } catch (error) {
    console.error(error);
    window.alert(t('messages.saveFailed'));
  }
}
</script>

<style scoped>
.page {
  display: grid;
  gap: 24px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card,
.panel,
.modal-card {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(247, 244, 236, 0.96);
  color: #172230;
  box-shadow: 0 16px 40px rgba(10, 18, 28, 0.18);
}

.metric-card {
  padding: 20px;
}

.metric-card.solved {
  background: linear-gradient(135deg, #d8f6ea, #eefcf6);
}

.metric-card.accent {
  background: linear-gradient(135deg, #ffe3b9, #fff4e1);
}

.metric-label {
  display: block;
  color: #5d6a79;
  margin-bottom: 10px;
}

.metric-value {
  font-size: clamp(1.7rem, 4vw, 2.5rem);
}

.panel {
  padding: 24px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.panel-head h2 {
  margin: 0 0 4px;
}

.panel-head p {
  color: #6f7987;
}

.filters {
  display: grid;
  grid-template-columns: 2fr repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.field {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #d7d9df;
  background: #ffffff;
  color: #172230;
}

.state-box {
  padding: 36px 20px;
  text-align: center;
  color: #596575;
  border-radius: 18px;
  background: rgba(24, 34, 48, 0.05);
}

.state-box.error {
  background: rgba(207, 72, 72, 0.08);
  color: #8a2d2d;
}

.table-wrap {
  overflow-x: auto;
}

.problems-table {
  width: 100%;
  border-collapse: collapse;
}

.problems-table th,
.problems-table td {
  padding: 14px 10px;
  border-bottom: 1px solid rgba(23, 34, 48, 0.08);
  vertical-align: top;
}

.problems-table th {
  text-align: left;
  color: #66717f;
  font-size: 0.82rem;
}

.mono {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.link-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: #1756a9;
  font-weight: 700;
  text-align: left;
}

.difficulty-pill,
.tag-pill,
.status-pill,
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 0.85rem;
}

.difficulty-pill {
  padding: 6px 10px;
}

.difficulty-pill.easy {
  background: #dcfce7;
  color: #146c43;
}

.difficulty-pill.medium {
  background: #fff1c9;
  color: #9a6700;
}

.difficulty-pill.hard {
  background: #ffd8d8;
  color: #a12626;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-pill {
  padding: 5px 10px;
  background: #ecf0f7;
  color: #465363;
}

.status-pill {
  border: none;
  padding: 7px 12px;
  background: #edf2f7;
  color: #576474;
}

.status-pill.solved {
  background: #1f8f63;
  color: white;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-btn {
  border: none;
  padding: 7px 12px;
  background: #dde8f6;
  color: #17467b;
}

.action-btn.danger {
  background: #ffe1e1;
  color: #9f3030;
}

.muted {
  color: #8391a1;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(6, 10, 18, 0.56);
}

.modal-card {
  width: min(720px, 100%);
  padding: 24px;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.eyebrow {
  color: #a06a14;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.78rem;
}

.close-btn {
  border: none;
  padding: 10px 14px;
  border-radius: 999px;
  background: #e8edf5;
  color: #233142;
  height: fit-content;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-item,
.detail-block {
  padding: 16px;
  border-radius: 18px;
  background: #ffffff;
}

.detail-item span,
.block-title {
  display: block;
  color: #66717f;
  margin-bottom: 8px;
}

.detail-block {
  margin-top: 14px;
}

.note-box {
  white-space: pre-wrap;
  color: #1e2b39;
  line-height: 1.7;
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-field {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .summary-grid,
  .filters,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .panel,
  .modal-card {
    padding: 18px;
  }
}
</style>
