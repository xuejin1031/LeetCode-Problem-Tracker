<template>
  <section class="editor-layout">
    <article class="editor-card">
      <div class="header">
        <div>
          <p class="eyebrow">{{ isEditing ? t('labels.edit') : t('tabs.add') }}</p>
          <h2>{{ isEditing ? t('form.editTitle') : t('form.createTitle') }}</h2>
          <p>{{ t('form.description') }}</p>
        </div>

        <button v-if="isEditing" class="ghost-btn" @click="cancelEditing">
          {{ t('labels.cancelEdit') }}
        </button>
      </div>

      <form class="form" @submit.prevent="submitForm">
        <div class="field-group">
          <label for="title">{{ t('form.title') }}</label>
          <input
            id="title"
            v-model.trim="form.title"
            class="field"
            type="text"
            :placeholder="t('form.titlePlaceholder')"
            required
          />
        </div>

        <div class="split">
          <div class="field-group">
            <label for="number">{{ t('form.number') }}</label>
            <input
              id="number"
              v-model.number="form.number"
              class="field"
              type="number"
              min="1"
              step="1"
              :placeholder="t('form.numberPlaceholder')"
              required
            />
          </div>

          <div class="field-group">
            <label for="difficulty">{{ t('form.difficulty') }}</label>
            <select id="difficulty" v-model="form.difficulty" class="field" required>
              <option value="Easy">{{ t('difficulty.easy') }}</option>
              <option value="Medium">{{ t('difficulty.medium') }}</option>
              <option value="Hard">{{ t('difficulty.hard') }}</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label for="tag">{{ t('form.tag') }}</label>
          <input
            id="tag"
            v-model.trim="form.tag"
            class="field"
            type="text"
            :placeholder="t('form.tagPlaceholder')"
          />
          <small>{{ t('labels.tagHint') }}</small>
        </div>

        <div class="field-group">
          <label for="note">{{ t('form.note') }}</label>
          <textarea
            id="note"
            v-model.trim="form.note"
            class="field textarea"
            rows="10"
            :placeholder="t('form.notePlaceholder')"
          ></textarea>
        </div>

        <label class="checkbox-row">
          <input v-model="form.isSolved" type="checkbox" />
          <span>{{ t('form.markSolved') }}</span>
        </label>

        <div class="action-bar">
          <button class="primary-btn" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? t('form.saving') : isEditing ? t('form.update') : t('form.save') }}
          </button>
          <button class="ghost-btn" type="button" @click="resetForm">
            {{ t('form.clear') }}
          </button>
        </div>

        <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="feedback success">{{ successMessage }}</p>
      </form>
    </article>

    <aside class="preview-card">
      <p class="eyebrow">{{ t('labels.summary') }}</p>
      <h3>{{ form.title || t('labels.noData') }}</h3>

      <div class="preview-grid">
        <div class="preview-item">
          <span>{{ t('labels.number') }}</span>
          <strong>{{ form.number || '-' }}</strong>
        </div>
        <div class="preview-item">
          <span>{{ t('labels.difficulty') }}</span>
          <strong>{{ t(`difficulty.${form.difficulty.toLowerCase()}`) }}</strong>
        </div>
        <div class="preview-item">
          <span>{{ t('labels.status') }}</span>
          <strong>{{ form.isSolved ? t('labels.solved') : t('labels.unsolved') }}</strong>
        </div>
        <div class="preview-item">
          <span>{{ t('labels.tag') }}</span>
          <div class="tag-list">
            <span v-for="tag in parsedTags" :key="tag" class="tag-pill">{{ tag }}</span>
            <span v-if="parsedTags.length === 0">-</span>
          </div>
        </div>
      </div>

      <div class="note-preview">
        <span>{{ t('labels.note') }}</span>
        <p>{{ form.note || t('labels.noData') }}</p>
      </div>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useProblemsStore, type Difficulty, type Problem } from '../stores/problems';

const router = useRouter();
const { t, locale } = useI18n({ useScope: 'global' });
const problemsStore = useProblemsStore();

const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const emptyForm = (): Problem => ({
  title: '',
  number: 0,
  difficulty: 'Easy',
  tag: '',
  isSolved: false,
  note: '',
});

const form = reactive<Problem>(emptyForm());

const isEditing = computed(() => Boolean(problemsStore.selectedProblem?.id));
const parsedTags = computed(() =>
  (form.tag || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

watch(
  () => problemsStore.selectedProblem,
  (value) => {
    if (value) {
      form.id = value.id;
      form.title = value.title;
      form.number = value.number;
      form.difficulty = value.difficulty;
      form.tag = value.tag || '';
      form.isSolved = value.isSolved;
      form.note = value.note || '';
      return;
    }

    Object.assign(form, emptyForm());
  },
  { immediate: true }
);

async function submitForm() {
  errorMessage.value = '';
  successMessage.value = '';

  if (!form.title || !form.number || !form.difficulty) {
    errorMessage.value = t('messages.required');
    return;
  }

  isSubmitting.value = true;

  const payload: Problem = {
    title: form.title,
    number: Number(form.number),
    difficulty: form.difficulty as Difficulty,
    tag: form.tag?.trim() || null,
    isSolved: form.isSolved,
    note: form.note?.trim() || null,
  };

  try {
    if (isEditing.value && form.id) {
      await problemsStore.updateProblem(form.id, payload);
      successMessage.value = t('messages.updated');
    } else {
      await problemsStore.addProblem(payload);
      successMessage.value = t('messages.saved');
    }

    resetForm();
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    router.push({ name: 'list', params: { locale: String(locale.value || 'zh') } });
  } catch (error: unknown) {
    const apiMessage =
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;

    errorMessage.value = apiMessage ?? t('messages.saveFailed');
  } finally {
    isSubmitting.value = false;
  }
}

function resetForm() {
  Object.assign(form, emptyForm());
  problemsStore.clearSelection();
  errorMessage.value = '';
}

function cancelEditing() {
  resetForm();
}
</script>

<style scoped>
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.8fr);
  gap: 24px;
}

.editor-card,
.preview-card {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(247, 244, 236, 0.96);
  color: #172230;
  padding: 24px;
  box-shadow: 0 16px 40px rgba(10, 18, 28, 0.18);
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.eyebrow {
  color: #a06a14;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.78rem;
  margin-bottom: 6px;
}

.header h2,
.preview-card h3 {
  margin: 0 0 8px;
}

.header p {
  color: #627181;
}

.form {
  display: grid;
  gap: 18px;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field-group {
  display: grid;
  gap: 8px;
}

.field-group label,
.preview-item span,
.note-preview span {
  color: #556171;
  font-weight: 600;
}

.field,
.textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #d7d9df;
  background: #ffffff;
  color: #172230;
}

.textarea {
  resize: vertical;
  min-height: 220px;
}

.field-group small {
  color: #7a8695;
}

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #243142;
  font-weight: 600;
}

.action-bar {
  display: flex;
  gap: 12px;
}

.primary-btn,
.ghost-btn {
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
}

.primary-btn {
  background: linear-gradient(135deg, #1756a9, #3a7bd5);
  color: #ffffff;
}

.primary-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.ghost-btn {
  background: #e7edf5;
  color: #223142;
}

.feedback {
  padding: 12px 14px;
  border-radius: 14px;
}

.feedback.error {
  background: #ffe1e1;
  color: #962e2e;
}

.feedback.success {
  background: #dff8ea;
  color: #186a49;
}

.preview-card {
  align-self: start;
  background:
    linear-gradient(180deg, rgba(255, 233, 202, 0.95), rgba(247, 244, 236, 0.96));
}

.preview-grid {
  display: grid;
  gap: 12px;
  margin: 16px 0 20px;
}

.preview-item,
.note-preview {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
}

.preview-item strong {
  display: block;
  margin-top: 6px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.tag-pill {
  display: inline-flex;
  padding: 5px 10px;
  border-radius: 999px;
  background: #f0f3f8;
  color: #415062;
}

.note-preview p {
  margin-top: 10px;
  white-space: pre-wrap;
  line-height: 1.7;
}

@media (max-width: 960px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .editor-card,
  .preview-card {
    padding: 18px;
  }

  .header,
  .split,
  .action-bar {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
