import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
} from '@angular/core';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface Transaction {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  date: string;
  amount: number;
}

@Component({
  selector: 'app-finance-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent],
  templateUrl: './finance-page.component.html',
  styleUrl: './finance-page.component.scss',
})
export class FinancePageComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly title = 'Финансы';

  @ViewChild('spendingChart') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  readonly activeChartTab = signal<'weekly' | 'monthly'>('weekly');

  readonly transactions: Transaction[] = [
    {
      icon: 'restaurant',
      iconBg: '#fff7ed',
      iconColor: '#ea580c',
      title: 'Кофейня Starbucks',
      date: 'Сегодня \u2022 9:45',
      amount: -540,
    },
    {
      icon: 'directions_car',
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
      title: 'Поездка Uber',
      date: 'Вчера \u2022 18:12',
      amount: -2410,
    },
    {
      icon: 'payments',
      iconBg: '#f0fdf4',
      iconColor: '#16a34a',
      title: 'Оплата от клиента',
      date: '24 янв \u2022 11:30',
      amount: 120000,
    },
    {
      icon: 'shopping_bag',
      iconBg: '#faf5ff',
      iconColor: '#9333ea',
      title: 'Apple Store',
      date: '22 янв \u2022 14:20',
      amount: -15900,
    },
    {
      icon: 'home',
      iconBg: '#fefce8',
      iconColor: '#a16207',
      title: 'Аренда квартиры',
      date: '18 янв \u2022 10:00',
      amount: -185000,
    },
  ];

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  setChartTab(tab: 'weekly' | 'monthly'): void {
    this.activeChartTab.set(tab);
    this.chart?.destroy();
    this.createChart();
  }

  formatAmount(amount: number): string {
    const abs = Math.abs(amount);
    const rub = Math.floor(abs / 100);
    const kop = abs % 100;
    const formatted = rub.toLocaleString('ru-RU') + ',' + kop.toString().padStart(2, '0');
    return (amount < 0 ? '\u2212' : '+') + formatted + ' \u20BD';
  }

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
