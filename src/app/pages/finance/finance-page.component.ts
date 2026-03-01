import {
  Component,
  AfterViewInit,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
  signal,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { Chart, registerables } from 'chart.js';
import { FinanceService } from '../../features/finance/data/finance.service';
import {
  Category,
  SavingsGoal,
  Transaction,
  ICON_OPTIONS,
  COLOR_OPTIONS,
} from '../../features/finance/models/finance.models';

Chart.register(...registerables);

@Component({
  selector: 'app-finance-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent, FormsModule],
  templateUrl: './finance-page.component.html',
  styleUrl: './finance-page.component.scss',
})
export class FinancePageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly financeService = inject(FinanceService);

  readonly title = 'Финансы';
  readonly iconOptions = ICON_OPTIONS;
  readonly colorOptions = COLOR_OPTIONS;

  @ViewChild('spendingChart') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  readonly activeChartTab = signal<'weekly' | 'monthly'>('weekly');

  // ─── State (delegated to service) ───

  readonly balance = this.financeService.balance;
  readonly categories = this.financeService.categories;
  readonly transactions = this.financeService.transactions;
  readonly savingsGoals = this.financeService.savingsGoals;

  // ─── Limits (delegated to service) ───

  readonly monthlyLimit = computed(() => this.financeService.limits().monthlyLimit);
  readonly weeklyLimit = computed(() => this.financeService.limits().weeklyLimit);

  // ─── View state ───

  readonly showAllTransactions = signal(false);
  readonly RECENT_LIMIT = 5;

  // ─── Computed ───

  readonly monthlySpend = computed(() => {
    const now = Date.now();
    const cutoff = now - 30 * 86400000;
    return this.transactions()
      .filter((t) => t.amount < 0 && t.timestamp >= cutoff)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  });

  readonly weeklySpend = computed(() => {
    const now = Date.now();
    const cutoff = now - 7 * 86400000;
    return this.transactions()
      .filter((t) => t.amount < 0 && t.timestamp >= cutoff)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  });

  /** Transactions filtered by active period (weekly / monthly) */
  private readonly periodTransactions = computed(() => {
    const tab = this.activeChartTab();
    const now = Date.now();
    const cutoff = tab === 'weekly' ? now - 7 * 86400000 : now - 30 * 86400000;
    return this.transactions().filter((t) => t.timestamp >= cutoff);
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
        const limit = tab === 'weekly' ? (cat.weeklyLimit ?? 0) : (cat.monthlyLimit ?? 0);
        const isOverLimit = limit > 0 && total > limit;
        const limitPercent = limit > 0 ? Math.min(100, Math.round((total / limit) * 100)) : 0;
        return { ...cat, total, limit, isOverLimit, limitPercent };
      })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  });

  readonly chartBadgeStatus = computed(() => {
    const tab = this.activeChartTab();
    const spend = tab === 'weekly' ? this.weeklySpend() : this.monthlySpend();
    const limit = tab === 'weekly' ? this.weeklyLimit() : this.monthlyLimit();
    if (!limit) return { text: 'ЛИМИТ НЕ ЗАДАН', status: 'neutral' as const };
    return spend > limit
      ? { text: 'ЛИМИТ ПРЕВЫШЕН', status: 'over' as const }
      : { text: 'В РАМКАХ ПЛАНА', status: 'ok' as const };
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

  readonly visibleTransactions = computed(() => {
    const all = this.transactionsWithCategory();
    return this.showAllTransactions() ? all : all.slice(0, this.RECENT_LIMIT);
  });

  readonly hasMoreTransactions = computed(() => {
    return this.transactionsWithCategory().length > this.RECENT_LIMIT;
  });

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

  // Goal form
  goalName = '';
  goalTarget = '';

  // Transaction form
  txTitle = '';
  txAmount = '';
  txType: 'expense' | 'income' = 'expense';
  txCategoryId = '';

  // Limit form
  limitMonthly = '';
  limitWeekly = '';

  // ─── Lifecycle ───

  ngOnInit(): void {
    this.financeService.loadBalance();
    this.financeService.loadCategories();
    this.financeService.loadTransactions();
    this.financeService.loadSavingsGoals();
    this.financeService.loadLimits();
    this.financeService.loadChartData(this.activeChartTab());
  }

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  // ─── Transactions view ───

  toggleAllTransactions(): void {
    this.showAllTransactions.update((v) => !v);
  }

  // ─── Chart ───

  setChartTab(tab: 'weekly' | 'monthly'): void {
    this.activeChartTab.set(tab);
    this.financeService.loadChartData(tab);
    this.chart?.destroy();
    this.createChart();
  }

  // ─── Formatters ───

  formatRub(kopecks: number): string {
    const abs = Math.abs(kopecks);
    const rub = Math.floor(abs / 100);
    const kop = abs % 100;
    return rub.toLocaleString('ru-RU') + ',' + kop.toString().padStart(2, '0') + ' \u20BD';
  }

  formatAmount(amount: number): string {
    const sign = amount < 0 ? '\u2212' : '+';
    return sign + this.formatRub(amount);
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
    this.financeService.adjustBalance(Math.round(val * 100));
    this.showBalanceDialog.set(false);
  }

  // ─── Category dialog ───

  openCategoryDialog(): void {
    this.categoryName = '';
    this.categorySelectedIcon = 'restaurant';
    this.categorySelectedColorIdx = 0;
    this.categoryWeeklyLimit = '';
    this.categoryMonthlyLimit = '';
    this.showCategoryDialog.set(true);
  }

  saveCategory(): void {
    const name = this.categoryName.trim();
    if (!name) return;
    const c = this.colorOptions[this.categorySelectedColorIdx];
    const wl = parseFloat(this.categoryWeeklyLimit.replace(',', '.'));
    const ml = parseFloat(this.categoryMonthlyLimit.replace(',', '.'));
    this.financeService.createCategory({
      name,
      icon: this.categorySelectedIcon,
      bg: c.bg,
      color: c.color,
      weeklyLimit: !isNaN(wl) && wl > 0 ? Math.round(wl * 100) : undefined,
      monthlyLimit: !isNaN(ml) && ml > 0 ? Math.round(ml * 100) : undefined,
    });
    this.showCategoryDialog.set(false);
  }

  // ─── Goal dialog ───

  openGoalDialog(): void {
    this.goalName = '';
    this.goalTarget = '';
    this.showGoalDialog.set(true);
  }

  saveGoal(): void {
    const name = this.goalName.trim();
    const target = parseFloat(this.goalTarget.replace(',', '.'));
    if (!name || isNaN(target) || target <= 0) return;
    this.financeService.createSavingsGoal({
      name,
      target: Math.round(target * 100),
    });
    this.showGoalDialog.set(false);
  }

  // ─── Transaction dialog ───

  openTransactionDialog(): void {
    this.txTitle = '';
    this.txAmount = '';
    this.txType = 'expense';
    this.txCategoryId = this.categories()[0]?.id ?? '';
    this.showTransactionDialog.set(true);
  }

  saveTransaction(): void {
    const title = this.txTitle.trim();
    const val = parseFloat(this.txAmount.replace(',', '.'));
    if (!title || isNaN(val) || val <= 0 || !this.txCategoryId) return;

    const kopecks = Math.round(val * 100);
    const amount = this.txType === 'expense' ? -kopecks : kopecks;

    this.financeService.createTransaction({
      categoryId: this.txCategoryId,
      title,
      amount,
    });
    this.showTransactionDialog.set(false);
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
    this.showLimitDialog.set(false);
    this.chart?.destroy();
    this.createChart();
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

  onBackdropClick(dialog: 'balance' | 'category' | 'goal' | 'transaction' | 'limit' | 'history'): void {
    switch (dialog) {
      case 'balance': this.showBalanceDialog.set(false); break;
      case 'category': this.showCategoryDialog.set(false); break;
      case 'goal': this.showGoalDialog.set(false); break;
      case 'transaction': this.showTransactionDialog.set(false); break;
      case 'limit': this.showLimitDialog.set(false); break;
      case 'history': this.showHistoryDialog.set(false); break;
    }
  }

  stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

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

    const isWeekly = this.activeChartTab() === 'weekly';
    const chartData = this.financeService.chartData();

    const labels = chartData.map(p => p.label);
    const data = chartData.map(p => p.value);

    const datasets: any[] = [
      {
        data,
        borderColor: '#facc15',
        backgroundColor: 'rgba(250, 204, 21, 0.12)',
        borderWidth: 3,
        pointBackgroundColor: '#facc15',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: true,
      },
    ];

    // Add dashed limit line if limit is set
    const limit = isWeekly ? this.weeklyLimit() : this.monthlyLimit();
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
}
