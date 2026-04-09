import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import axios from 'axios';
import api from '../services/api';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Problem {
  id?: number;
  title: string;
  number: number;
  difficulty: Difficulty;
  tag?: string | null;
  isSolved: boolean;
  note?: string | null;
  date?: string;
  updatedAt?: string;
}

function sortProblems(items: Problem[]) {
  return [...items].sort((a, b) => a.number - b.number);
}

export const useProblemsStore = defineStore('problems', () => {
  const problems = ref<Problem[]>([]);
  const loading = ref(false);
  const error = ref('');
  const selectedProblem = ref<Problem | null>(null);

  const totalProblems = computed(() => problems.value.length);
  const solvedCount = computed(() => problems.value.filter((problem) => problem.isSolved).length);
  const unsolvedCount = computed(() => totalProblems.value - solvedCount.value);
  const solveRate = computed(() => {
    if (totalProblems.value === 0) {
      return 0;
    }
    return Math.round((solvedCount.value / totalProblems.value) * 100);
  });

  const easyCount = computed(() => problems.value.filter((problem) => problem.difficulty === 'Easy').length);
  const mediumCount = computed(() => problems.value.filter((problem) => problem.difficulty === 'Medium').length);
  const hardCount = computed(() => problems.value.filter((problem) => problem.difficulty === 'Hard').length);

  const easySolvedCount = computed(
    () => problems.value.filter((problem) => problem.difficulty === 'Easy' && problem.isSolved).length
  );
  const mediumSolvedCount = computed(
    () => problems.value.filter((problem) => problem.difficulty === 'Medium' && problem.isSolved).length
  );
  const hardSolvedCount = computed(
    () => problems.value.filter((problem) => problem.difficulty === 'Hard' && problem.isSolved).length
  );

  const availableTags = computed(() => {
    const tagSet = new Set<string>();
    for (const problem of problems.value) {
      for (const tag of (problem.tag || '').split(',').map((item) => item.trim()).filter(Boolean)) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  });

  const recentProblems = computed(() =>
    [...problems.value]
      .sort((a, b) => {
        const left = new Date(a.updatedAt || a.date || 0).getTime();
        const right = new Date(b.updatedAt || b.date || 0).getTime();
        return right - left;
      })
      .slice(0, 8)
  );

  async function fetchProblems() {
    loading.value = true;
    error.value = '';

    try {
      const response = await api.get<Problem[]>('/api/problems');
      problems.value = sortProblems(response.data);
    } catch (fetchError) {
      console.error('Failed to fetch problems:', fetchError);
      if (axios.isAxiosError(fetchError)) {
        const data = fetchError.response?.data as { error?: string; message?: string; detail?: string } | undefined;
        error.value = data?.message || data?.error || 'fetch_failed';
      } else {
        error.value = 'fetch_failed';
      }
    } finally {
      loading.value = false;
    }
  }

  async function addProblem(problem: Problem) {
    const response = await api.post('/api/problems', problem);
    await fetchProblems();
    return response.data;
  }

  async function updateProblem(id: number, problem: Problem) {
    const response = await api.put(`/api/problems/${id}`, problem);
    await fetchProblems();
    return response.data;
  }

  async function deleteProblem(id: number) {
    await api.delete(`/api/problems/${id}`);
    if (selectedProblem.value?.id === id) {
      selectedProblem.value = null;
    }
    await fetchProblems();
  }

  async function toggleSolved(problem: Problem) {
    if (!problem.id) {
      return;
    }

    await updateProblem(problem.id, {
      ...problem,
      isSolved: !problem.isSolved,
    });
  }

  function selectProblem(problem: Problem | null) {
    selectedProblem.value = problem ? { ...problem } : null;
  }

  function clearSelection() {
    selectedProblem.value = null;
  }

  return {
    problems,
    loading,
    error,
    selectedProblem,
    totalProblems,
    solvedCount,
    unsolvedCount,
    solveRate,
    easyCount,
    mediumCount,
    hardCount,
    easySolvedCount,
    mediumSolvedCount,
    hardSolvedCount,
    availableTags,
    recentProblems,
    fetchProblems,
    addProblem,
    updateProblem,
    deleteProblem,
    toggleSolved,
    selectProblem,
    clearSelection,
  };
});
