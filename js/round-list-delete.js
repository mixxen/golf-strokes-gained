import { installAggregateStartingDistanceAnalytics } from './aggregate-distance-analytics.js';
import { installPuttingAnalytics } from './putting-analytics.js';
import { installSgChartScale } from './sg-chart-scale.js';
import { installShortGameAnalytics } from './short-game-analytics.js';
import { createRoundStore } from './round-store.js';

export function formatDeleteRoundDate(value, locale) {
  if (!value) return 'date not set';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.valueOf())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
}

export function roundDeletePrompt(round, { locale } = {}) {
  const name = round?.courseName || 'Manual round';
  const date = formatDeleteRoundDate(round?.date, locale);
  return `Delete ${name} from ${date}? This permanently removes its scorecard and all recorded strokes from this browser. Export a backup first if you may need it later.`;
}

export function deleteStoredRound(
  roundId,
  roundStore,
  { confirmDelete = globalThis.confirm, locale } = {}
) {
  if (!roundId || !roundStore?.get || !roundStore?.remove) return false;
  const stored = roundStore.get(roundId);
  if (!stored) return false;
  if (!confirmDelete(roundDeletePrompt(stored, { locale }))) return false;
  return roundStore.remove(roundId);
}

export function installRoundListDeleteControls({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  storage = globalThis.localStorage,
  confirmDelete = globalThis.confirm
} = {}) {
  if (!documentRef || !windowRef || !storage) return null;
  const roundList = documentRef.querySelector('#round-list');
  if (!roundList) return null;

  const roundStore = createRoundStore(storage);
  const locale = windowRef.navigator?.language;

  function decorateRoundCards() {
    roundList.querySelectorAll('.round-card').forEach((card) => {
      if (card.querySelector('[data-delete-round]')) return;
      const openButton = card.querySelector('[data-open-round]');
      const metrics = card.querySelector('.round-card-metrics');
      const roundId = openButton?.dataset.openRound;
      const stored = roundId ? roundStore.get(roundId) : null;
      if (!roundId || !metrics || !stored) return;

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'round-card-delete';
      button.dataset.deleteRound = roundId;
      button.textContent = 'Delete';
      button.setAttribute(
        'aria-label',
        `Delete ${stored.courseName || 'Manual round'} from ${formatDeleteRoundDate(stored.date, locale)}`
      );

      const chevron = metrics.querySelector('.round-card-chevron');
      metrics.insertBefore(button, chevron || null);
    });
  }

  roundList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-round]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    const removed = deleteStoredRound(button.dataset.deleteRound, roundStore, {
      confirmDelete,
      locale
    });
    if (!removed) return;

    windowRef.dispatchEvent(new windowRef.Event('hashchange'));
  });

  const Observer = windowRef.MutationObserver;
  const observer = Observer ? new Observer(decorateRoundCards) : null;
  observer?.observe(roundList, { childList: true, subtree: true });
  decorateRoundCards();

  return () => observer?.disconnect();
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installRoundListDeleteControls();
  installPuttingAnalytics();
  installAggregateStartingDistanceAnalytics();
  installShortGameAnalytics();
  installSgChartScale();
}
