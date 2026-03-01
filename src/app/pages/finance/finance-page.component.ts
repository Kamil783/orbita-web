import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// ─── Models ───

export interface Category {
  id: string;
  name: string;
  icon: string;
  bg: string;
  color: string;
}

export interface Transaction {
  id: string;
  categoryId: string;
  title: string;
  date: string;
  amount: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
}

// ─── Predefined icon palette for category picker ───

export const ICON_OPTIONS: { icon: string; label: string }[] = [
  { icon: 'restaurant', label: 'Еда' },
  { icon: 'shopping_bag', label: 'Покупки' },
  { icon: 'directions_car', label: 'Транспорт' },
  { icon: 'home', label: 'Жильё' },
  { icon: 'local_hospital', label: 'Здоровье' },
  { icon: 'school', label: 'Образование' },
  { icon: 'sports_esports', label: 'Развлечения' },
  { icon: 'checkroom', label: 'Одежда' },
  { icon: 'pets', label: 'Питомцы' },
  { icon: 'flight', label: 'Путешествия' },
  { icon: 'payments', label: 'Зарплата' },
  { icon: 'savings', label: 'Накопления' },
  { icon: 'subscriptions', label: 'Подписки' },
  { icon: 'fitness_center', label: 'Спорт' },
  { icon: 'coffee', label: 'Кофе' },
  { icon: 'redeem', label: 'Подарки' },
];

const COLOR_OPTIONS: { bg: string; color: string }[] = [
  { bg: '#fff7ed', color: '#ea580c' },
  { bg: '#eff6ff', color: '#2563eb' },
  { bg: '#f0fdf4', color: '#16a34a' },
  { bg: '#faf5ff', color: '#9333ea' },
  { bg: '#fefce8', color: '#a16207' },
  { bg: '#fef2f2', color: '#dc2626' },
  { bg: '#f0f9ff', color: '#0891b2' },
  { bg: '#fdf2f8', color: '#db2777' },
];

let nextId = 1;
function uid(): string {
  return 'fin_' + nextId++;
}

@Component({
  selector: 'app-finance-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent, FormsModule],
  templateUrl: './finance-page.component.html',
  styleUrl: './finance-page.component.scss',
})
export class FinancePageComponent implements AfterViewInit, OnDestroy {
  readonly title = 'Финансы';
  readonly iconOptions = ICON_OPTIONS;
  readonly colorOptions = COLOR_OPTIONS;

  @ViewChild('spendingChart') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  readonly activeChartTab = signal<'weekly' | 'monthly'>('weekly');

  // ─── State ───

  readonly balance = signal(1245000); // in kopecks
  readonly categories = signal<Category[]>([
    { id: 'cat_food', name: 'Еда', icon: 'restaurant', bg: '#fff7ed', color: '#ea580c' },
    { id: 'cat_transport', name: 'Транспорт', icon: 'directions_car', bg: '#eff6ff', color: '#2563eb' },
    { id: 'cat_income', name: 'Доход', icon: 'payments', bg: '#f0fdf4', color: '#16a34a' },
    { id: 'cat_shopping', name: 'Покупки', icon: 'shopping_bag', bg: '#faf5ff', color: '#9333ea' },
    { id: 'cat_housing', name: 'Жильё', icon: 'home', bg: '#fefce8', color: '#a16207' },
  ]);

  readonly transactions = signal<Transaction[]>([
    { id: uid(), categoryId: 'cat_food', title: 'Кофейня Starbucks', date: 'Сегодня \u2022 9:45', amount: -540 },
    { id: uid(), categoryId: 'cat_transport', title: 'Поездка Uber', date: 'Вчера \u2022 18:12', amount: -2410 },
    { id: uid(), categoryId: 'cat_income', title: 'Оплата от клиента', date: '24 янв \u2022 11:30', amount: 120000 },
    { id: uid(), categoryId: 'cat_shopping', title: 'Apple Store', date: '22 янв \u2022 14:20', amount: -15900 },
    { id: uid(), categoryId: 'cat_housing', title: 'Аренда квартиры', date: '18 янв \u2022 10:00', amount: -185000 },
  ]);

  readonly savingsGoals = signal<SavingsGoal[]>([
    { id: uid(), name: 'Фонд отпуска', target: 500000, current: 325000 },
  ]);

  // ─── Computed ───

  readonly monthlySpend = computed(() => {
    return this.transactions()
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  });

  readonly categorySpending = computed(() => {
    const cats = this.categories();
    const txs = this.transactions();
    return cats
      .map((cat) => {
        const total = txs
          .filter((t) => t.categoryId === cat.id && t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return { ...cat, total };
      })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
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

  // ─── Dialogs ───

  readonly showBalanceDialog = signal(false);
  readonly showCategoryDialog = signal(false);
  readonly showGoalDialog = signal(false);
  readonly showTransactionDialog = signal(false);

  // Balance form
  balanceAmount = '';

  // Category form
  categoryName = '';
  categorySelectedIcon = 'restaurant';
  categorySelectedColorIdx = 0;

  // Goal form
  goalName = '';
  goalTarget = '';

  // Transaction form
  txTitle = '';
  txAmount = '';
  txType: 'expense' | 'income' = 'expense';
  txCategoryId = '';

  // ─── Lifecycle ───

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  // ─── Chart ───

  setChartTab(tab: 'weekly' | 'monthly'): void {
    this.activeChartTab.set(tab);
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
    this.balance.update((b) => b + Math.round(val * 100));
    this.showBalanceDialog.set(false);
  }

  // ─── Category dialog ───

  openCategoryDialog(): void {
    this.categoryName = '';
    this.categorySelectedIcon = 'restaurant';
    this.categorySelectedColorIdx = 0;
    this.showCategoryDialog.set(true);
  }

  saveCategory(): void {
    const name = this.categoryName.trim();
    if (!name) return;
    const c = this.colorOptions[this.categorySelectedColorIdx];
    const cat: Category = {
      id: uid(),
      name,
      icon: this.categorySelectedIcon,
      bg: c.bg,
      color: c.color,
    };
    this.categories.update((list) => [...list, cat]);
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
    const goal: SavingsGoal = {
      id: uid(),
      name,
      target: Math.round(target * 100),
      current: 0,
    };
    this.savingsGoals.update((list) => [...list, goal]);
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

    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const dateStr = `Сегодня \u2022 ${hours}:${mins}`;

    const tx: Transaction = { id: uid(), categoryId: this.txCategoryId, title, date: dateStr, amount };
    this.transactions.update((list) => [tx, ...list]);
    this.balance.update((b) => b + amount);
    this.showTransactionDialog.set(false);
  }

  // ─── Dialog backdrop ───

  onBackdropClick(dialog: 'balance' | 'category' | 'goal' | 'transaction'): void {
    switch (dialog) {
      case 'balance':
        this.showBalanceDialog.set(false);
        break;
      case 'category':
        this.showCategoryDialog.set(false);
        break;
      case 'goal':
        this.showGoalDialog.set(false);
        break;
      case 'transaction':
        this.showTransactionDialog.set(false);
        break;
    }
  }

  stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  // ─── Chart ───

  private createChart(): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) return;

    const isWeekly = this.activeChartTab() === 'weekly';

    const labels = isWeekly
      ? ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4']
      : ['Сен', 'Окт', 'Ноя', 'Дек', 'Янв', 'Фев'];

    const data = isWeekly ? [480, 620, 350, 655] : [1800, 2200, 1950, 2400, 2100, 2105];

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
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
        ],
      },
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
