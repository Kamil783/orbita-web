import {
  Component,
  AfterViewInit,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
  HostListener,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CdkDropList, CdkDrag, CdkDragHandle, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { Chart, registerables } from 'chart.js';
import { FinanceService } from '../../features/finance/data/finance.service';
import { NotificationService } from '../../features/notifications/data/notification.service';
import { ModalOverlayComponent } from '../../shared/ui/modal-overlay/modal-overlay.component';
import { DatePickerComponent } from '../../shared/ui/date-picker/date-picker.component';
import { SelectComponent } from '../../shared/ui/select/select.component';
import {
  Category,
  SavingsGoal,
  ShoppingList,
  ShoppingListItem,
  Transaction,
  TransactionType,
  RecurringPayment,
  ICON_OPTIONS,
  COLOR_OPTIONS,
} from '../../features/finance/models/finance.models';

/**
 * Source filter used by the chart toggle and the transaction list tabs.
 * 5 modes — see `chartFilter` field comment for details.
 */
type TxSourceFilter = 'all' | 'mine' | 'personal' | 'shared' | 'team';

/**
 * Resolve a transaction's wallet, preferring the new `transactionType` field
 * and falling back to the legacy `fromBalance` boolean for older payloads.
 */
function txType(tx: Transaction): TransactionType {
  if (tx.transactionType) return tx.transactionType;
  return tx.fromBalance ? 'shared' : 'personal';
}

/** Returns true if a transaction passes the given source filter. */
function passesSourceFilter(tx: Transaction, filter: TxSourceFilter): boolean {
  if (filter === 'all') return true;
  const t = txType(tx);
  if (filter === 'mine') return t === 'personal' || t === 'shared';
  return t === filter;
}

Chart.register(...registerables);

@Component({
  selector: 'app-finance-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent, FormsModule, RouterLink, ModalOverlayComponent, DatePickerComponent, SelectComponent, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './finance-page.component.html',
  styleUrl: './finance-page.component.scss',
})
export class FinancePageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly financeService = inject(FinanceService);
  private readonly notifications = inject(NotificationService);

  readonly title = 'Финансы';
  readonly iconOptions = ICON_OPTIONS;
  readonly colorOptions = COLOR_OPTIONS;

  @ViewChild('spendingChart') chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart') categoryChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('recurringWrap') recurringWrap?: ElementRef<HTMLElement>;
  private chart: Chart | null = null;
  private categoryChart: Chart | null = null;
  private viewReady = false;

  readonly activeChartTab = signal<'weekly' | 'monthly' | 'yearly'>('weekly');
  // 5 modes for the chart source filter:
  //  - 'all'      — все транзакции (личные + общие + командные)
  //  - 'mine'     — «Свои»: личные + общие (всё, кроме командных)
  //  - 'personal' — только личные
  //  - 'shared'   — только общие
  //  - 'team'     — только командные
  readonly chartFilter = signal<TxSourceFilter>('all');

  private spendingChartEffect = effect(() => {
    this.spendingTrendData();
    this.financeService.limits();
    if (this.viewReady) {
      this.chart?.destroy();
      this.createChart();
    }
  });

  private categoryChartEffect = effect(() => {
    this.categoryChartDatasets();
    if (this.viewReady) {
      // Defer to next microtask so Angular renders the @if canvas first
      setTimeout(() => {
        this.categoryChart?.destroy();
        this.createCategoryChart();
      });
    }
  });

  // ─── State (delegated to service) ───

  readonly balance = this.financeService.balance;
  readonly categories = this.financeService.categories;
  readonly transactions = this.financeService.transactions;
  readonly savingsGoals = this.financeService.savingsGoals;
  readonly shoppingLists = this.financeService.shoppingLists;
  readonly recurringPayments = this.financeService.recurringPayments;

  // ─── Recurring payments popover ───

  readonly showRecurringPopover = signal(false);
  readonly recurringEditingId = signal<string | null>(null);

  recurringTitleInput = '';
  recurringAmountInput = '';
  recurringDayInput = '';

  readonly sortedRecurringPayments = computed(() =>
    [...this.recurringPayments()].sort((a, b) => a.dayOfMonth - b.dayOfMonth),
  );

  readonly recurringTotal = computed(() =>
    this.recurringPayments().reduce((sum, p) => sum + p.amount, 0),
  );

  // ─── Limits (delegated to service) ───

  readonly monthlyLimit = computed(() => this.financeService.limits().monthlyLimit);
  readonly weeklyLimit = computed(() => this.financeService.limits().weeklyLimit);

  // ─── View state ───

  readonly txFilter = signal<TxSourceFilter>('all');
  readonly txCategoryFilter = signal<string>('');      // category id, '' = все
  readonly txDateFrom = signal<string>('');            // ISO 'YYYY-MM-DD'
  readonly txDateTo = signal<string>('');              // ISO 'YYYY-MM-DD'
  readonly showTxFilters = signal(false);
  readonly slFilter = signal<'all' | 'personal' | 'shared' | 'team'>('personal');
  readonly periodOffset = signal(0);

  // ─── Computed ───

  /**
   * Sum of all expenses (personal + shared + team) for the current month.
   * Drives the «Расходы за месяц» counter in the summary bar.
   */
  readonly monthlySpend = computed(() => this.sumMonthlyExpenses());

  readonly monthlySpendPersonal = computed(() =>
    this.sumMonthlyExpenses('personal'),
  );

  readonly monthlySpendShared = computed(() =>
    this.sumMonthlyExpenses('shared'),
  );

  readonly monthlySpendTeam = computed(() =>
    this.sumMonthlyExpenses('team'),
  );

  /**
   * Sum expenses of the current month, optionally filtered by wallet type.
   * Pass `undefined` to count all wallets.
   */
  private sumMonthlyExpenses(only?: TransactionType): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    return this.transactions()
      .filter(t =>
        t.amount < 0
        && t.timestamp >= monthStart
        && t.timestamp < nextMonthStart
        && (only === undefined || txType(t) === only),
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }



  readonly weeklySpend = computed(() => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    const mondayTs = monday.getTime();
    const nextMondayTs = mondayTs + 7 * 86400000;

    return this.transactions()
      .filter(
        (t) =>
          t.amount < 0 &&
          t.timestamp >= mondayTs &&
          t.timestamp < nextMondayTs
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  });

  /** Compute the start/end of the active period taking offset into account */
  private readonly activePeriodRange = computed(() => {
    const tab = this.activeChartTab();
    const offset = this.periodOffset();
    const now = new Date();

    if (tab === 'weekly') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday + offset * 7);
      const start = monday.getTime();
      const end = start + 7 * 86400000;
      return { start, end };
    }

    if (tab === 'yearly') {
      const year = now.getFullYear() + offset;
      const start = new Date(year, 0, 1).getTime();
      const end = new Date(year + 1, 0, 1).getTime();
      return { start, end };
    }

    // monthly
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1).getTime();
    return { start, end };
  });

  /** Human-readable label for the active period */
  readonly periodLabel = computed(() => {
    const tab = this.activeChartTab();
    const offset = this.periodOffset();
    const now = new Date();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const monthNamesShort = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

    if (tab === 'weekly') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday + offset * 7);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      if (offset === 0) return 'Текущая неделя';
      return `${monday.getDate()} ${monthNamesShort[monday.getMonth()]} – ${sunday.getDate()} ${monthNamesShort[sunday.getMonth()]}`;
    }

    if (tab === 'yearly') {
      const year = now.getFullYear() + offset;
      if (offset === 0) return 'Текущий год';
      return `${year} год`;
    }

    // monthly
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    if (offset === 0) return 'Текущий месяц';
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  });

  /** Transactions filtered by active period (weekly / monthly / yearly) and chart source filter */
  private readonly periodTransactions = computed(() => {
    const filter = this.chartFilter();
    const { start, end } = this.activePeriodRange();

    return this.transactions().filter(t =>
      t.timestamp >= start
      && t.timestamp < end
      && passesSourceFilter(t, filter),
    );
  });

  readonly periodSpend = computed(() => {
    return this.periodTransactions()
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  });

  readonly categorySpending = computed(() => {
    const cats = this.categories();
    const txs = this.periodTransactions();
    const tab = this.activeChartTab();
    return cats
      .map((cat) => {
        const total = txs
          .filter((t) => t.categoryId === cat.id && t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const limit = tab === 'weekly'
          ? (cat.weeklyLimit ?? 0)
          : tab === 'yearly'
            ? (cat.monthlyLimit ?? 0) * 12
            : (cat.monthlyLimit ?? 0);
        const isOverLimit = limit > 0 && total > limit;
        const limitPercent = limit > 0 ? Math.min(100, Math.round((total / limit) * 100)) : 0;
        return { ...cat, total, limit, isOverLimit, limitPercent };
      })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  });

  // ─── Category chart ───

  readonly hiddenCategoryIds = signal<Set<string>>(new Set());

  toggleCategoryVisibility(catId: string): void {
    this.hiddenCategoryIds.update(set => {
      const next = new Set(set);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  readonly allCategoriesHidden = computed(() => {
    const datasets = this.categoryChartDatasets().datasets;
    return datasets.length > 0 && datasets.every(ds => ds.hidden);
  });

  toggleAllCategoryVisibility(): void {
    const datasets = this.categoryChartDatasets().datasets;
    if (this.allCategoriesHidden()) {
      this.hiddenCategoryIds.set(new Set());
    } else {
      this.hiddenCategoryIds.set(new Set(datasets.map(ds => ds.catId)));
    }
  }

  /** Build time buckets (day/week/month) for the active period */
  private readonly periodBuckets = computed(() => {
    const tab = this.activeChartTab();
    const offset = this.periodOffset();
    const now = new Date();
    const buckets: { key: string; label: string; start: number; end: number }[] = [];

    if (tab === 'weekly') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday + offset * 7);
      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const start = d.getTime();
        const end = start + 86400000;
        buckets.push({ key: `d${i}`, label: dayNames[i], start, end });
      }
    } else if (tab === 'monthly') {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
      let weekStart = new Date(monthStart);
      let weekNum = 1;
      while (weekStart.getTime() < nextMonthStart.getTime()) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const end = Math.min(weekEnd.getTime(), nextMonthStart.getTime());
        const startDay = weekStart.getDate();
        const endDay = new Date(end - 1).getDate();
        buckets.push({
          key: `w${weekNum}`,
          label: `${startDay}–${endDay}`,
          start: weekStart.getTime(),
          end,
        });
        weekStart = weekEnd;
        weekNum++;
      }
    } else {
      const year = now.getFullYear() + offset;
      const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
      for (let m = 0; m < 12; m++) {
        const start = new Date(year, m, 1).getTime();
        const end = new Date(year, m + 1, 1).getTime();
        buckets.push({ key: `m${m}`, label: monthNames[m], start, end });
      }
    }

    return buckets;
  });

  /** Aggregated spending per bucket for the spending-trend chart */
  readonly spendingTrendData = computed(() => {
    const buckets = this.periodBuckets();
    const txs = this.periodTransactions().filter(t => t.amount < 0);
    const labels = buckets.map(b => b.label);
    const data = buckets.map(b =>
      txs
        .filter(t => t.timestamp >= b.start && t.timestamp < b.end)
        .reduce((s, t) => s + Math.abs(t.amount), 0) / 100,
    );
    return { labels, data };
  });

  /** Build time-series datasets per category for the category chart */
  readonly categoryChartDatasets = computed(() => {
    const buckets = this.periodBuckets();
    const txs = this.periodTransactions().filter(t => t.amount < 0);
    const cats = this.categories();
    const hidden = this.hiddenCategoryIds();

    // Group transactions by category
    const catIds = new Set(txs.map(t => t.categoryId));
    const datasets: {
      catId: string; name: string; color: string; hidden: boolean;
      data: number[];
    }[] = [];

    for (const catId of catIds) {
      const cat = cats.find(c => c.id === catId);
      const catTxs = txs.filter(t => t.categoryId === catId);
      const data = buckets.map(b => {
        const sum = catTxs
          .filter(t => t.timestamp >= b.start && t.timestamp < b.end)
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return sum / 100; // convert kopecks to rubles
      });

      datasets.push({
        catId,
        name: cat?.name ?? 'Без категории',
        color: cat?.color ?? '#6b7280',
        hidden: hidden.has(catId),
        data,
      });
    }

    // Sort by total descending
    datasets.sort((a, b) => {
      const totalA = a.data.reduce((s, v) => s + v, 0);
      const totalB = b.data.reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });

    return { labels: buckets.map(b => b.label), datasets };
  });

  readonly chartBadgeStatus = computed(() => {
    const tab = this.activeChartTab();
    const spend = this.periodSpend();
    const limit = tab === 'weekly'
      ? this.weeklyLimit()
      : tab === 'yearly'
        ? this.monthlyLimit() * 12
        : this.monthlyLimit();
    if (!limit) return { text: 'ЛИМИТ НЕ ЗАДАН', status: 'neutral' as const };
    return spend > limit
      ? { text: 'ЛИМИТ ПРЕВЫШЕН', status: 'over' as const }
      : { text: 'В РАМКАХ ПЛАНА', status: 'ok' as const };
  });

  readonly balanceTrend = computed(() => {
    const currentBalance = this.balance();
    const previousBalance = this.financeService.previousMonthBalance();

    if (previousBalance === null || previousBalance === 0) {
      return { hasData: false, percent: 0, formatted: '' };
    }

    const percent = ((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100;
    const rounded = Math.round(percent * 10) / 10;
    const sign = rounded >= 0 ? '+' : '';
    const formatted = `${sign}${rounded.toLocaleString('ru-RU')}%`;

    return { hasData: true, percent: rounded, formatted };
  });

  readonly monthlyLimitStatus = computed(() => {
    const limit = this.monthlyLimit();
    const spend = this.monthlySpend();
    if (!limit) return { hasLimit: false, percent: 0, barPercent: 0, isOver: false, diff: 0 };
    const percent = Math.round((spend / limit) * 100);
    const barPercent = Math.min(100, percent);
    return { hasLimit: true, percent, barPercent, isOver: spend > limit, diff: Math.abs(limit - spend) };
  });

  readonly transactionsWithCategory = computed(() => {
    const cats = this.categories();
    return this.transactions().map((tx) => {
      const cat = cats.find((c) => c.id === tx.categoryId);
      return {
        ...tx,
        icon: cat?.icon ?? 'receipt',
        iconBg: cat?.bg ?? '#f5f7f8',
        iconColor: cat?.color ?? '#6b7280',
        categoryName: cat?.name ?? 'Без категории',
      };
    });
  });

  readonly filteredTransactions = computed(() => {
    const all = this.transactionsWithCategory();
    const filter = this.txFilter();
    const catId = this.txCategoryFilter();
    const from = this.txDateFrom();
    const to = this.txDateTo();

    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : null;
    const toTs = to ? new Date(to + 'T23:59:59.999').getTime() : null;

    return all.filter(tx => {
      if (!passesSourceFilter(tx, filter)) return false;
      if (catId && tx.categoryId !== catId) return false;
      if (fromTs !== null && tx.timestamp < fromTs) return false;
      if (toTs !== null && tx.timestamp > toTs) return false;
      return true;
    });
  });

  readonly hasActiveTxFilters = computed(() =>
    !!this.txCategoryFilter() || !!this.txDateFrom() || !!this.txDateTo(),
  );

  readonly categoryFilterOptions = computed(() =>
    this.categories().map(c => ({ value: c.id, label: c.name })),
  );

  resetTxFilters(): void {
    this.txCategoryFilter.set('');
    this.txDateFrom.set('');
    this.txDateTo.set('');
  }

  setTxDateToday(): void {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.txDateFrom.set(iso);
    this.txDateTo.set(iso);
  }

  // ─── Period detail dialog (click on chart) ───

  readonly detailPeriodRange = signal<{ start: number; end: number; label: string; catId?: string } | null>(null);

  readonly showPeriodDetailDialog = computed(() => this.detailPeriodRange() !== null);

  readonly periodDetailTransactions = computed(() => {
    const range = this.detailPeriodRange();
    if (!range) return [];
    return this.transactionsWithCategory()
      .filter(tx =>
        tx.timestamp >= range.start &&
        tx.timestamp < range.end &&
        (!range.catId || tx.categoryId === range.catId),
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  readonly periodDetailTotal = computed(() =>
    this.periodDetailTransactions()
      .filter(tx => tx.amount < 0)
      .reduce((s, tx) => s + Math.abs(tx.amount), 0),
  );

  closePeriodDetail(): void {
    this.detailPeriodRange.set(null);
  }

  openCategoryDetail(catId: string, catName: string): void {
    const { start, end } = this.activePeriodRange();
    const label = `${catName} · ${this.periodLabel()}`;
    this.detailPeriodRange.set({ start, end, label, catId });
  }

  private openBucketDetail(bucketIndex: number, catId?: string): void {
    const buckets = this.periodBuckets();
    const bucket = buckets[bucketIndex];
    if (!bucket) return;
    const tab = this.activeChartTab();
    let label = bucket.label;
    if (tab === 'weekly') {
      const d = new Date(bucket.start);
      const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
      label = `${d.getDate()} ${months[d.getMonth()]}`;
    } else if (tab === 'monthly') {
      const s = new Date(bucket.start);
      const e = new Date(bucket.end - 1);
      label = `${s.getDate()}–${e.getDate()} ${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][s.getMonth()]}`;
    } else {
      const s = new Date(bucket.start);
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      label = `${months[s.getMonth()]} ${s.getFullYear()}`;
    }
    this.detailPeriodRange.set({ start: bucket.start, end: bucket.end, label, catId });
  }

  readonly filteredShoppingLists = computed(() => {
    let all = this.shoppingLists();
    const filter = this.slFilter();
    if (filter !== 'all') all = all.filter(l => l.listType === filter);
    // Pinned first, then by createdAt desc
    return [...all].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  });

  togglePinShoppingList(list: ShoppingList): void {
    this.financeService.updateShoppingList(list.id, { pinned: !list.pinned });
  }

  onShoppingItemDrop(listId: string, event: CdkDragDrop<ShoppingListItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const list = this.shoppingLists().find(l => l.id === listId);
    if (!list) return;
    const ids = list.items.map(i => i.id);
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.financeService.reorderShoppingListItems(listId, ids);
  }

  // ─── History ───

  readonly historyMode = signal<'weekly' | 'monthly'>('weekly');
  readonly expandedPeriodKey = signal<string | null>(null);

  readonly historyData = computed(() => {
    const mode = this.historyMode();
    const txs = this.transactions().filter((t) => t.amount < 0);
    const cats = this.categories();

    const groups = new Map<string, Transaction[]>();
    for (const tx of txs) {
      let key: string;
      if (mode === 'weekly') {
        const { year, week } = this.getISOWeekInfo(tx.timestamp);
        key = `${year}-W${week.toString().padStart(2, '0')}`;
      } else {
        const d = new Date(tx.timestamp);
        key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }

    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
    ];

    const periods: {
      key: string; label: string; dateRange: string; year: number;
      total: number; limit: number; isOverLimit: boolean;
      categories: { name: string; icon: string; bg: string; color: string; total: number; limit: number; isOverLimit: boolean }[];
    }[] = [];

    for (const [key, periodTxs] of groups) {
      let year: number, label: string, dateRange: string;
      if (mode === 'weekly') {
        const [y, w] = key.split('-W').map(Number);
        year = y;
        label = `Неделя ${w}`;
        const monday = this.getWeekMonday(y, w);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        dateRange = `${this.formatDateShort(monday)} \u2013 ${this.formatDateShort(sunday)}`;
      } else {
        const [y, m] = key.split('-').map(Number);
        year = y;
        label = monthNames[m - 1];
        dateRange = '';
      }

      const total = periodTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const catMap = new Map<string, number>();
      for (const tx of periodTxs) {
        catMap.set(tx.categoryId, (catMap.get(tx.categoryId) ?? 0) + Math.abs(tx.amount));
      }

      const overallLimit = mode === 'weekly' ? this.weeklyLimit() : this.monthlyLimit();

      const categoryDetails = Array.from(catMap.entries())
        .map(([catId, catTotal]) => {
          const cat = cats.find((c) => c.id === catId);
          const catLimit = mode === 'weekly' ? (cat?.weeklyLimit ?? 0) : (cat?.monthlyLimit ?? 0);
          return {
            name: cat?.name ?? 'Без категории',
            icon: cat?.icon ?? 'receipt',
            bg: cat?.bg ?? '#f5f7f8',
            color: cat?.color ?? '#6b7280',
            total: catTotal,
            limit: catLimit,
            isOverLimit: catLimit > 0 && catTotal > catLimit,
          };
        })
        .sort((a, b) => b.total - a.total);

      periods.push({
        key, label, dateRange, year, total,
        limit: overallLimit,
        isOverLimit: overallLimit > 0 && total > overallLimit,
        categories: categoryDetails,
      });
    }

    periods.sort((a, b) => b.key.localeCompare(a.key));

    const yearMap = new Map<number, typeof periods>();
    for (const p of periods) {
      if (!yearMap.has(p.year)) yearMap.set(p.year, []);
      yearMap.get(p.year)!.push(p);
    }

    return Array.from(yearMap.entries())
      .map(([year, pds]) => ({ year, periods: pds }))
      .sort((a, b) => b.year - a.year);
  });

  // ─── Dialogs ───

  readonly showBalanceDialog = signal(false);
  readonly showCategoryDialog = signal(false);
  readonly showGoalDialog = signal(false);
  readonly showTransactionDialog = signal(false);
  readonly showLimitDialog = signal(false);
  readonly showHistoryDialog = signal(false);

  // Balance form
  balanceAmount = '';

  // Category form
  categoryName = '';
  categorySelectedIcon = 'restaurant';
  categorySelectedColorIdx = 0;
  categoryWeeklyLimit = '';
  categoryMonthlyLimit = '';
  editCategoryId: string | null = null;

  // Goal form
  goalType: 'goal' | 'shoppingList' = 'goal';
  goalName = '';
  goalTarget = '';
  // Shopping list creation wallet — mirrors transaction's fromBalance:
  //   false → personal, true → shared. Team lists aren't created from this UI.
  goalFromBalance = false;

  // Shopping list item form
  readonly showAddItemDialog = signal(false);
  addItemListId = '';
  addItemName = '';
  addItemPrice = '';

  // Shopping list detail dialog
  readonly showShoppingListDetail = signal(false);
  readonly detailList = computed(() => {
    const lists = this.shoppingLists();
    return lists.find(l => l.id === this.detailListId()) ?? null;
  });
  private readonly detailListId = signal('');

  // Delete shopping list confirmation
  readonly showDeleteListDialog = signal(false);
  deleteListId = '';
  deleteListName = '';

  // Edit goal form
  readonly showEditGoalDialog = signal(false);
  editGoalId = '';
  editGoalName = '';
  editGoalTarget = '';

  // Edit shopping list form
  readonly showEditShoppingListDialog = signal(false);
  editShoppingListId = '';
  editShoppingListName = '';
  editShoppingListType: 'personal' | 'shared' | 'team' = 'personal';

  // Inline edit shopping list item
  readonly editingShoppingItemId = signal<string | null>(null);
  editShoppingItemListId = '';
  editShoppingItemName = '';
  editShoppingItemPrice = '';

  // Fund goal form
  readonly showFundGoalDialog = signal(false);
  fundGoalId = '';
  fundGoalName = '';
  fundGoalAmount = '';

  // Withdraw goal form
  readonly showWithdrawGoalDialog = signal(false);
  withdrawGoalId = '';
  withdrawGoalName = '';
  withdrawGoalMax = 0;
  withdrawGoalAmount = '';

  // Delete goal confirmation
  readonly showDeleteGoalDialog = signal(false);
  deleteGoalId = '';
  deleteGoalName = '';

  // Transaction form
  txTitle = '';
  txAmount = '';
  txType: 'expense' | 'income' = 'expense';
  txCategoryId = '';
  txFromBalance = false;
  txDate = '';

  // Edit transaction
  readonly showEditTransactionDialog = signal(false);
  editTxId = '';
  editTxTitle = '';
  editTxAmount = '';
  editTxType: 'expense' | 'income' = 'expense';
  editTxCategoryId = '';
  editTxFromBalance = false;
  editTxDate = '';

  // Delete transaction confirmation
  readonly showDeleteTransactionDialog = signal(false);
  deleteTxId = '';
  deleteTxTitle = '';

  // Limit form
  limitMonthly = '';
  limitWeekly = '';

  // ─── Toast helper ───
  private toast(title: string, message = ''): void {
    this.notifications.showToast({ type: 'finance', title, message });
  }

  // ─── Recurring payment handlers ───

  toggleRecurringPopover(event: MouseEvent): void {
    event.stopPropagation();
    this.showRecurringPopover.update(v => !v);
    if (!this.showRecurringPopover()) {
      this.cancelRecurringEdit();
    }
  }

  closeRecurringPopover(): void {
    this.showRecurringPopover.set(false);
    this.cancelRecurringEdit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClickForRecurring(event: MouseEvent): void {
    if (!this.showRecurringPopover()) return;
    const target = event.target as Node;
    if (this.recurringWrap && !this.recurringWrap.nativeElement.contains(target)) {
      this.closeRecurringPopover();
    }
  }

  private resetRecurringForm(): void {
    this.recurringTitleInput = '';
    this.recurringAmountInput = '';
    this.recurringDayInput = '';
  }

  cancelRecurringEdit(): void {
    this.recurringEditingId.set(null);
    this.resetRecurringForm();
  }

  startEditRecurring(payment: RecurringPayment): void {
    this.recurringEditingId.set(payment.id);
    this.recurringTitleInput = payment.title;
    this.recurringAmountInput = (payment.amount / 100).toString();
    this.recurringDayInput = payment.dayOfMonth.toString();
  }

  submitRecurring(): void {
    const title = String(this.recurringTitleInput ?? '').trim();

    const amountRub = parseFloat(
      String(this.recurringAmountInput ?? '').replace(',', '.')
    );

    const day = parseInt(String(this.recurringDayInput ?? ''), 10);

    if (!title || !Number.isFinite(amountRub) || amountRub <= 0) return;
    if (!Number.isInteger(day) || day < 1 || day > 31) return;

    const amount = Math.round(amountRub * 100);
    const editingId = this.recurringEditingId();

    if (editingId) {
      this.financeService.updateRecurringPayment(editingId, {
        title,
        amount,
        dayOfMonth: day,
      });
      this.toast('Платёж обновлён', `${title} · ${day}-го числа`);
    } else {
      this.financeService.createRecurringPayment({
        title,
        amount,
        dayOfMonth: day,
      });
      this.toast('Платёж добавлен', `${title} · ${day}-го числа`);
    }

    this.cancelRecurringEdit();
  }

  deleteRecurring(id: string, event: MouseEvent): void {
    event.stopPropagation();
    const removed = this.recurringPayments().find(p => p.id === id);
    this.financeService.deleteRecurringPayment(id);
    if (this.recurringEditingId() === id) {
      this.cancelRecurringEdit();
    }
    this.toast('Платёж удалён', removed?.title ?? '');
  }

  // ─── Lifecycle ───

  ngOnInit(): void {
    this.financeService.loadBalance();
    this.financeService.loadPreviousMonthBalance();
    this.financeService.loadCategories();
    this.financeService.loadTransactions();
    this.financeService.loadSavingsGoals();
    this.financeService.loadShoppingLists();
    this.financeService.loadLimits();
    this.financeService.loadRecurringPayments();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.chart?.destroy();
    this.createChart();
    this.categoryChart?.destroy();
    this.createCategoryChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.categoryChart?.destroy();
  }

  // ─── Chart ───

  setChartTab(tab: 'weekly' | 'monthly' | 'yearly'): void {
    this.activeChartTab.set(tab);
    this.periodOffset.set(0);
  }

  goToPreviousPeriod(): void {
    this.periodOffset.update(o => o - 1);
  }

  goToNextPeriod(): void {
    if (this.periodOffset() >= 0) return;
    this.periodOffset.update(o => o + 1);
  }

  goToCurrentPeriod(): void {
    this.periodOffset.set(0);
  }

  // ─── Formatters ───

  /** Wallet type for a transaction (template-visible helper). */
  getTxType(tx: Transaction): TransactionType {
    return txType(tx);
  }

  /** Display label for a wallet type (Личный / Общий / Командный). */
  txTypeLabel(t: TransactionType): string {
    switch (t) {
      case 'personal': return 'Личный';
      case 'shared':   return 'Общий';
      case 'team':     return 'Командный';
    }
  }

  formatRub(kopecks: number): string {
    const abs = Math.abs(kopecks);
    const rub = Math.floor(abs / 100);
    const kop = abs % 100;
    const formatted = rub.toLocaleString('ru-RU') + ',' + kop.toString().padStart(2, '0') + ' \u20BD';
    return kopecks < 0 ? '\u2212' + formatted : formatted;
  }

  formatAmount(amount: number): string {
    const sign = amount < 0 ? '\u2212' : '+';
    return sign + this.formatRub(Math.abs(amount));
  }

  goalPercent(goal: SavingsGoal): number {
    if (goal.target <= 0) return 0;
    return Math.min(100, Math.round((goal.current / goal.target) * 100));
  }

  // ─── Balance dialog ───

  openBalanceDialog(): void {
    this.balanceAmount = '';
    this.showBalanceDialog.set(true);
  }

  saveBalance(): void {
    const val = parseFloat(this.balanceAmount.replace(',', '.'));
    if (isNaN(val) || val === 0) return;
    const kopecks = Math.round(val * 100);
    this.financeService.adjustBalance(kopecks);
    this.showBalanceDialog.set(false);
    this.toast(
      val > 0 ? 'Баланс пополнен' : 'Баланс уменьшен',
      this.formatRub(Math.abs(kopecks)),
    );
  }

  // ─── Category dialog ───

  openCategoryDialog(): void {
    this.editCategoryId = null;
    this.categoryName = '';
    this.categorySelectedIcon = 'restaurant';
    this.categorySelectedColorIdx = 0;
    this.categoryWeeklyLimit = '';
    this.categoryMonthlyLimit = '';
    this.showCategoryDialog.set(true);
  }

  openEditCategoryDialog(cat: Category): void {
    this.editCategoryId = cat.id;
    this.categoryName = cat.name;
    this.categorySelectedIcon = cat.icon;
    this.categorySelectedColorIdx = this.colorOptions.findIndex(c => c.bg === cat.bg && c.color === cat.color);
    if (this.categorySelectedColorIdx < 0) this.categorySelectedColorIdx = 0;
    this.categoryWeeklyLimit = cat.weeklyLimit ? (cat.weeklyLimit / 100).toString() : '';
    this.categoryMonthlyLimit = cat.monthlyLimit ? (cat.monthlyLimit / 100).toString() : '';
    this.showCategoryDialog.set(true);
  }

  saveCategory(): void {
    const name = this.categoryName.trim();
    if (!name) return;
    const c = this.colorOptions[this.categorySelectedColorIdx];
    const wl = parseFloat(this.categoryWeeklyLimit.replace(',', '.'));
    const ml = parseFloat(this.categoryMonthlyLimit.replace(',', '.'));
    const data = {
      name,
      icon: this.categorySelectedIcon,
      bg: c.bg,
      color: c.color,
      weeklyLimit: !isNaN(wl) && wl > 0 ? Math.round(wl * 100) : undefined,
      monthlyLimit: !isNaN(ml) && ml > 0 ? Math.round(ml * 100) : undefined,
    };
    if (this.editCategoryId) {
      this.financeService.updateCategory(this.editCategoryId, data);
      this.toast('Категория обновлена', name);
    } else {
      this.financeService.createCategory(data);
      this.toast('Категория создана', name);
    }
    this.showCategoryDialog.set(false);
  }

  // ─── Goal dialog ───

  openGoalDialog(): void {
    this.goalType = 'goal';
    this.goalName = '';
    this.goalTarget = '';
    this.goalFromBalance = false;
    this.showGoalDialog.set(true);
  }

  saveGoal(): void {
    const name = this.goalName.trim();
    if (!name) return;

    if (this.goalType === 'shoppingList') {
      this.financeService.createShoppingList(name, this.goalFromBalance);
      this.toast('Список покупок создан', name);
      this.showGoalDialog.set(false);
      return;
    }

    const target = parseFloat(this.goalTarget.replace(',', '.'));
    if (isNaN(target) || target <= 0) return;
    this.financeService.createSavingsGoal({
      name,
      target: Math.round(target * 100),
    });
    this.toast('Цель создана', name);
    this.showGoalDialog.set(false);
  }

  // ─── Edit goal dialog ───

  openEditGoalDialog(goal: SavingsGoal): void {
    this.editGoalId = goal.id;
    this.editGoalName = goal.name;
    this.editGoalTarget = (goal.target / 100).toString().replace('.', ',');
    this.showEditGoalDialog.set(true);
  }

  saveEditGoal(): void {
    const name = this.editGoalName.trim();
    if (!name) return;
    const val = parseFloat(this.editGoalTarget.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    this.financeService.updateSavingsGoal(this.editGoalId, {
      name,
      target: Math.round(val * 100),
    });
    this.toast('Цель обновлена', name);
    this.showEditGoalDialog.set(false);
  }

  // ─── Edit shopping list dialog ───

  openEditShoppingListDialog(list: ShoppingList): void {
    this.editShoppingListId = list.id;
    this.editShoppingListName = list.name;
    this.editShoppingListType = list.listType;
    this.showEditShoppingListDialog.set(true);
  }

  saveEditShoppingList(): void {
    const name = this.editShoppingListName.trim();
    if (!name) return;
    this.financeService.updateShoppingList(this.editShoppingListId, {
      name,
      listType: this.editShoppingListType,
    });
    this.toast('Список обновлён', name);
    this.showEditShoppingListDialog.set(false);
  }

  // ─── Edit shopping list item dialog ───

  startEditShoppingItem(listId: string, item: ShoppingListItem): void {
    this.editShoppingItemListId = listId;
    this.editShoppingItemName = item.name;
    this.editShoppingItemPrice = item.price !== null ? (item.price / 100).toString().replace('.', ',') : '';
    this.editingShoppingItemId.set(item.id);
  }

  saveEditShoppingItem(): void {
    const itemId = this.editingShoppingItemId();
    if (!itemId) return;
    const name = this.editShoppingItemName.trim();
    if (!name) return;
    const val = parseFloat(this.editShoppingItemPrice.replace(',', '.'));
    const price = !isNaN(val) && val > 0 ? Math.round(val * 100) : null;
    this.financeService.updateShoppingListItem(this.editShoppingItemListId, itemId, { name, price });
    this.toast('Товар обновлён', name);
    this.editingShoppingItemId.set(null);
  }

  cancelEditShoppingItem(): void {
    this.editingShoppingItemId.set(null);
  }

  // ─── Shopping list dialogs ───

  shoppingListTotal(list: ShoppingList): number {
    return list.items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  }

  shoppingListBoughtTotal(list: ShoppingList): number {
    return list.items.filter(i => i.bought).reduce((sum, i) => sum + (i.price ?? 0), 0);
  }

  shoppingListRemainingTotal(list: ShoppingList): number {
    return list.items.filter(i => !i.bought).reduce((sum, i) => sum + (i.price ?? 0), 0);
  }

  shoppingListPercent(list: ShoppingList): number {
    const total = this.shoppingListTotal(list);
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.shoppingListBoughtTotal(list) / total) * 100));
  }

  shoppingListBoughtCount(list: ShoppingList): number {
    return list.items.filter(i => i.bought).length;
  }

  toggleShoppingItem(listId: string, itemId: string): void {
    this.financeService.toggleShoppingListItem(listId, itemId);
  }

  removeShoppingItem(listId: string, itemId: string): void {
    this.financeService.removeShoppingListItem(listId, itemId);
  }

  openShoppingListDetail(list: ShoppingList): void {
    this.detailListId.set(list.id);
    this.showShoppingListDetail.set(true);
  }

  openAddItemFromDetail(): void {
    const list = this.detailList();
    if (!list) return;
    this.showShoppingListDetail.set(false);
    this.openAddItemDialog(list);
  }

  openAddItemDialog(list: ShoppingList): void {
    this.addItemListId = list.id;
    this.addItemName = '';
    this.addItemPrice = '';
    this.showAddItemDialog.set(true);
  }

  saveAddItem(): void {
    const name = this.addItemName.trim();
    if (!name) return;
    const val = parseFloat(this.addItemPrice.replace(',', '.'));
    const price = !isNaN(val) && val > 0 ? Math.round(val * 100) : null;
    this.financeService.addShoppingListItem(this.addItemListId, name, price);
    this.toast('Товар добавлен', name);
    this.showAddItemDialog.set(false);
  }

  openDeleteListDialog(list: ShoppingList): void {
    this.deleteListId = list.id;
    this.deleteListName = list.name;
    this.showDeleteListDialog.set(true);
  }

  confirmDeleteList(): void {
    const name = this.deleteListName;
    this.financeService.deleteShoppingList(this.deleteListId);
    this.toast('Список удалён', name);
    this.showDeleteListDialog.set(false);
  }

  // ─── Fund goal dialog ───

  openFundGoalDialog(goal: SavingsGoal): void {
    this.fundGoalId = goal.id;
    this.fundGoalName = goal.name;
    this.fundGoalAmount = '';
    this.showFundGoalDialog.set(true);
  }

  saveFundGoal(): void {
    const val = parseFloat(this.fundGoalAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    const kopecks = Math.round(val * 100);
    this.financeService.fundSavingsGoal(this.fundGoalId, kopecks);
    this.toast('Пополнено', `${this.fundGoalName} · ${this.formatRub(kopecks)}`);
    this.showFundGoalDialog.set(false);
  }

  // ─── Withdraw goal dialog ───

  openWithdrawGoalDialog(goal: SavingsGoal): void {
    this.withdrawGoalId = goal.id;
    this.withdrawGoalName = goal.name;
    this.withdrawGoalMax = goal.current;
    this.withdrawGoalAmount = '';
    this.showWithdrawGoalDialog.set(true);
  }

  saveWithdrawGoal(): void {
    const val = parseFloat(this.withdrawGoalAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    const kopecks = Math.round(val * 100);
    const clamped = Math.min(kopecks, this.withdrawGoalMax);
    if (clamped <= 0) return;
    this.financeService.withdrawSavingsGoal(this.withdrawGoalId, clamped);
    this.toast('Снято с цели', `${this.withdrawGoalName} · ${this.formatRub(clamped)}`);
    this.showWithdrawGoalDialog.set(false);
  }

  // ─── Delete goal dialog ───

  openDeleteGoalDialog(goal: SavingsGoal): void {
    this.deleteGoalId = goal.id;
    this.deleteGoalName = goal.name;
    this.showDeleteGoalDialog.set(true);
  }

  confirmDeleteGoal(): void {
    const name = this.deleteGoalName;
    this.financeService.deleteSavingsGoal(this.deleteGoalId);
    this.toast('Цель удалена', name);
    this.showDeleteGoalDialog.set(false);
  }

  // ─── Transaction dialog ───

  openTransactionDialog(): void {
    this.txTitle = '';
    this.txAmount = '';
    this.txType = 'expense';
    this.txCategoryId = '';
    this.txFromBalance = false;
    this.txDate = '';
    this.showTransactionDialog.set(true);
  }

  saveTransaction(): void {
    const title = this.txTitle.trim();
    const val = parseFloat(this.txAmount.replace(',', '.'));
    if (!title || isNaN(val) || val <= 0) return;

    const kopecks = Math.round(val * 100);
    const amount = this.txType === 'expense' ? -kopecks : kopecks;

    this.financeService.createTransaction(
      {
        categoryId: this.txCategoryId || '',
        title,
        amount,
        fromBalance: this.txFromBalance,
        date: this.txDate || undefined,
      },
      (created) => {
        const isExpense = created.amount < 0;
        this.notifications.showToast({
          type: 'finance',
          title: 'Транзакция добавлена',
          message: `${created.title} · ${this.formatRub(Math.abs(created.amount))}`,
        });
      },
    );
    this.showTransactionDialog.set(false);
  }

  // ─── Edit transaction dialog ───

  openEditTransactionDialog(tx: Transaction): void {
    this.editTxId = tx.id;
    this.editTxTitle = tx.title;
    const absKopecks = Math.abs(tx.amount);
    this.editTxAmount = (absKopecks / 100).toString().replace('.', ',');
    this.editTxType = tx.amount < 0 ? 'expense' : 'income';
    this.editTxCategoryId = tx.categoryId;
    // Edit toggle is still boolean (shared vs. personal). Map the wallet:
    //   shared → true, personal/team → false. Team transactions can't yet be
    //   edited via this toggle (requires a separate UI), so they fall back to
    //   personal — the wallet stays untouched unless the user toggles it.
    this.editTxFromBalance = txType(tx) === 'shared';
    this.editTxDate = tx.date ?? '';
    this.showEditTransactionDialog.set(true);
  }

  saveEditTransaction(): void {
    const title = this.editTxTitle.trim();
    const val = parseFloat(this.editTxAmount.replace(',', '.'));
    if (!title || isNaN(val) || val <= 0) return;

    const kopecks = Math.round(val * 100);
    const amount = this.editTxType === 'expense' ? -kopecks : kopecks;

    this.financeService.updateTransaction(this.editTxId, {
      title,
      amount,
      categoryId: this.editTxCategoryId || undefined,
      fromBalance: this.editTxFromBalance,
      date: this.editTxDate || undefined,
    });
    this.toast('Транзакция обновлена', `${title} · ${this.formatRub(kopecks)}`);
    this.showEditTransactionDialog.set(false);
  }

  // ─── Delete transaction dialog ───

  openDeleteTransactionDialog(tx: Transaction): void {
    this.deleteTxId = tx.id;
    this.deleteTxTitle = tx.title;
    this.showDeleteTransactionDialog.set(true);
  }

  confirmDeleteTransaction(): void {
    const title = this.deleteTxTitle;
    this.financeService.deleteTransaction(this.deleteTxId);
    this.toast('Транзакция удалена', title);
    this.showDeleteTransactionDialog.set(false);
  }

  // ─── Limit dialog ───

  openLimitDialog(): void {
    const ml = this.monthlyLimit();
    const wl = this.weeklyLimit();
    this.limitMonthly = ml > 0 ? (ml / 100).toString() : '';
    this.limitWeekly = wl > 0 ? (wl / 100).toString() : '';
    this.showLimitDialog.set(true);
  }

  saveLimits(): void {
    const ml = parseFloat(this.limitMonthly.replace(',', '.'));
    const wl = parseFloat(this.limitWeekly.replace(',', '.'));
    this.financeService.updateLimits({
      monthlyLimit: !isNaN(ml) && ml > 0 ? Math.round(ml * 100) : 0,
      weeklyLimit: !isNaN(wl) && wl > 0 ? Math.round(wl * 100) : 0,
    });
    this.toast('Лимиты обновлены');
    this.showLimitDialog.set(false);
  }

  // ─── History dialog ───

  openHistoryDialog(): void {
    this.expandedPeriodKey.set(null);
    this.showHistoryDialog.set(true);
  }

  setHistoryMode(mode: 'weekly' | 'monthly'): void {
    this.historyMode.set(mode);
    this.expandedPeriodKey.set(null);
  }

  togglePeriodDetail(key: string): void {
    this.expandedPeriodKey.update((k) => (k === key ? null : key));
  }

  // ─── Dialog backdrop ───


  // ─── Date helpers ───

  private getISOWeekInfo(timestamp: number): { year: number; week: number } {
    const d = new Date(timestamp);
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { year: date.getUTCFullYear(), week: weekNo };
  }

  private getWeekMonday(isoYear: number, isoWeek: number): Date {
    const jan4 = new Date(isoYear, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday1 = new Date(jan4);
    monday1.setDate(jan4.getDate() - (dayOfWeek - 1));
    const result = new Date(monday1);
    result.setDate(monday1.getDate() + (isoWeek - 1) * 7);
    return result;
  }

  private formatDateShort(d: Date): string {
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }

  // ─── Chart ───

  private createChart(): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) return;

    const tab = this.activeChartTab();
    const { labels, data } = this.spendingTrendData();

    const datasets: any[] = [
      {
        data,
        borderColor: '#facc15',
        backgroundColor: 'rgba(250, 204, 21, 0.12)',
        borderWidth: 3,
        pointBackgroundColor: '#facc15',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: tab === 'yearly' ? 3 : 5,
        pointHoverRadius: tab === 'yearly' ? 5 : 7,
        tension: 0.4,
        fill: true,
      },
    ];

    // Add dashed limit line if limit is set
    const limit = tab === 'weekly'
      ? this.weeklyLimit()
      : tab === 'yearly'
        ? this.monthlyLimit() * 12
        : this.monthlyLimit();
    if (limit > 0) {
      const limitInRub = limit / 100;
      datasets.push({
        data: labels.map(() => limitInRub),
        borderColor: '#ef4444',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      });
    }

    this.chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt, elements) => {
          if (elements.length > 0) {
            this.openBucketDetail(elements[0].index);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            titleFont: { family: 'Inter', size: 13, weight: 600 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y ?? 0;
                if (ctx.datasetIndex === 1) return '\u041B\u0438\u043C\u0438\u0442: ' + val.toLocaleString('ru-RU') + ' \u20BD';
                return val.toLocaleString('ru-RU') + ' \u20BD';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Inter', size: 12, weight: 600 },
              color: '#6b7280',
            },
            border: { display: false },
          },
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.04)' },
            ticks: {
              font: { family: 'Inter', size: 12 },
              color: '#9ca3af',
              callback: (value) => value.toLocaleString('ru-RU'),
            },
            border: { display: false },
          },
        },
      },
    });
  }

  private createCategoryChart(): void {
    const canvas = this.categoryChartCanvas?.nativeElement;
    if (!canvas) return;

    const { labels, datasets } = this.categoryChartDatasets();

    const visibleDatasets = datasets.map(ds => ({
      label: ds.name,
      data: ds.data,
      borderColor: ds.hidden ? 'transparent' : ds.color,
      backgroundColor: ds.hidden ? 'transparent' : this.hexToRgba(ds.color, 0.08),
      borderWidth: 2.5,
      pointBackgroundColor: ds.hidden ? 'transparent' : ds.color,
      pointBorderColor: ds.hidden ? 'transparent' : '#ffffff',
      pointBorderWidth: 2,
      pointRadius: ds.hidden ? 0 : 4,
      pointHoverRadius: ds.hidden ? 0 : 6,
      tension: 0.4,
      fill: false,
      hidden: ds.hidden,
    }));

    const datasetCatIds = datasets.map(d => d.catId);

    this.categoryChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: visibleDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        onClick: (_evt, elements) => {
          if (elements.length > 0) {
            const el = elements[0];
            this.openBucketDetail(el.index, datasetCatIds[el.datasetIndex]);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            titleFont: { family: 'Inter', size: 13, weight: 600 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 8,
            filter: (item) => (item.parsed.y ?? 0) > 0,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y ?? 0;
                return `${ctx.dataset.label}: ${val.toLocaleString('ru-RU')} \u20BD`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Inter', size: 12, weight: 600 },
              color: '#6b7280',
            },
            border: { display: false },
          },
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.04)' },
            ticks: {
              font: { family: 'Inter', size: 12 },
              color: '#9ca3af',
              callback: (value) => value.toLocaleString('ru-RU'),
            },
            border: { display: false },
          },
        },
      },
    });
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
