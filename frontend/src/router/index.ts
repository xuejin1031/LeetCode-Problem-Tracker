import { createRouter, createWebHistory } from 'vue-router';
import i18n from '../i18n';
import ProblemsList from '../pages/ProblemsList.vue';
import AddProblem from '../pages/AddProblem.vue';
import Statistics from '../pages/Statistics.vue';

const supportedLocales = ['en', 'zh'] as const;
type Locale = (typeof supportedLocales)[number];

const normalizeLocale = (locale: string | undefined): Locale => {
  if (supportedLocales.includes(locale as Locale)) {
    return locale as Locale;
  }
  return 'zh';
};

const routes = [
  { path: '/', redirect: '/zh/list' },
  {
    path: '/:locale(en|zh)/list',
    name: 'list',
    component: ProblemsList,
  },
  {
    path: '/:locale(en|zh)/add',
    name: 'add',
    component: AddProblem,
  },
  {
    path: '/:locale(en|zh)/stats',
    name: 'stats',
    component: Statistics,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/zh/list',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const localeParam = to.params.locale as string | undefined;
  const localeKey = normalizeLocale(localeParam);
  const globalLocale = i18n.global.locale as unknown as { value: string };

  if (globalLocale.value !== localeKey) {
    globalLocale.value = localeKey;
  }

  if (localeKey !== localeParam) {
    next('/zh/list');
    return;
  }

  next();
});

export default router;
