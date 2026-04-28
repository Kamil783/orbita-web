import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { ModalOverlayComponent } from '../../shared/ui/modal-overlay/modal-overlay.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DatePickerComponent } from '../../shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { AvatarPipe } from '../../shared/ui/avatar-pipe/avatar.pipe';
import { FinanceService } from '../../features/finance/data/finance.service';
import { NotificationService } from '../../features/notifications/data/notification.service';
import { UserService, User } from '../../features/user/data/user.service';
import {
  PlannedPurchase,
  PlannedPurchaseStatus,
} from '../../features/finance/models/finance.models';

type StatusFilter = 'all' | PlannedPurchaseStatus;

interface PurchaseRow {
  id: string;
  title: string;
  amount: number;
  status: PlannedPurchaseStatus;
  note: string;
  assignee: User | null;
  categoryIcon: string;
  categoryName: string;
  categoryBg: string;
  categoryColor: string;
}

interface DayGroup {
  iso: string;            // YYYY-MM-DD
  day: number;            // 1-31
  dayOfWeek: string;      // 'Пн' .. 'Вс'
  isToday: boolean;
  isPast: boolean;
  total: number;          // kopecks (active only — not cancelled)
  rows: PurchaseRow[];
}

const MONTHS_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const DOW_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

@Component({
  selector: 'app-finance-plan-page',
  standalone: true,
  imports: [
    AppShellComponent,
    TopbarComponent,
    FormsModule,
    ModalOverlayComponent,
    ConfirmDialogComponent,
    DatePickerComponent,
    SelectComponent,
    AvatarPipe,
  ],
  templateUrl: './finance-plan-page.component.html',
  styleUrl: './finance-plan-page.component.scss',
})
export class FinancePlanPageComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly notifications = inject(NotificationService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly title = 'Запланированные покупки';

  // ─── Source data ───
  readonly purchases = this.financeService.plannedPurchases;
  readonly categories = this.financeService.categories;
  readonly members = this.userService.members;

  // ─── View state ───
  private readonly today = new Date();

  readonly viewYear = signal(this.today.getFullYear());
  readonly viewMonth = signal(this.today.getMonth());

  readonly statusFilter = signal<StatusFilter>('all');
  readonly assigneeFilter = signal<string>('');     // user id, '' = all
  readonly categoryFilter = signal<string>('');     // category id, '' = all

  // ─── Dialog state ───
  readonly showFormDialog = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly showDeleteDialog = signal(false);
  readonly deleteTargetId = signal<string | null>(null);
  readonly deleteTargetTitle = signal('');

  // Form fields
  formTitle = '';
  formDate = '';
  formAmount = '';
  formAssigneeId = '';
  formCategoryId = '';
  formNote = '';

  // ─── Computed ───

  readonly monthLabel = computed(() =>
    `${MONTHS_FULL[this.viewMonth()]} ${this.viewYear()}`,
  );

  readonly statusFilterOptions: SelectOption[] = [
    { value: 'all', label: 'Все статусы' },
    { value: 'planned', label: 'Запланировано' },
    { value: 'bought', label: 'Куплено' },
    { value: 'cancelled', label: 'Отменено' },
  ];

  readonly assigneeOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Любой исполнитель' },
    { value: 'unassigned', label: 'Без исполнителя' },
    ...this.members().map(m => ({ value: m.id, label: m.name })),
  ]);

  readonly categoryOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Все категории' },
    ...this.categories().map(c => ({ value: c.id, label: c.name })),
  ]);

  readonly memberOptions = computed<SelectOption[]>(() =>
    this.members().map(m => ({ value: m.id, label: m.name })),
  );

  readonly categorySelectOptions = computed<SelectOption[]>(() =>
    this.categories().map(c => ({ value: c.id, label: c.name })),
  );

  readonly statusValueOptions: SelectOption[] = [
    { value: 'planned', label: 'Запланировано' },
    { value: 'bought', label: 'Куплено' },
    { value: 'cancelled', label: 'Отменено' },
  ];

  /** Purchases in the active month, after filters. */
  private readonly visiblePurchases = computed(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const status = this.statusFilter();
    const assignee = this.assigneeFilter();
    const category = this.categoryFilter();

    return this.purchases().filter(p => {
      const [y, m] = p.date.split('-').map(Number);
      if (y !== year || m - 1 !== month) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (assignee === 'unassigned' && p.assigneeId !== null) return false;
      if (assignee && assignee !== 'unassigned' && p.assigneeId !== assignee) return false;
      if (category && p.categoryId !== category) return false;
      return true;
    });
  });

  /** Purchases for the active month — used for stats (ignores all filters). */
  private readonly monthPurchases = computed(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    return this.purchases().filter(p => {
      const [y, m] = p.date.split('-').map(Number);
      return y === year && m - 1 === month;
    });
  });

  readonly stats = computed(() => {
    const all = this.monthPurchases();
    let plannedTotal = 0;
    let boughtTotal = 0;
    let plannedCount = 0;
    let boughtCount = 0;
    let cancelledCount = 0;

    for (const p of all) {
      if (p.status === 'planned') {
        plannedTotal += p.amount;
        plannedCount++;
      } else if (p.status === 'bought') {
        boughtTotal += p.amount;
        boughtCount++;
      } else {
        cancelledCount++;
      }
    }

    return {
      plannedTotal,
      boughtTotal,
      forecastTotal: plannedTotal + boughtTotal,
      plannedCount,
      boughtCount,
      cancelledCount,
      total: all.length,
    };
  });

  readonly hasActiveFilters = computed(
    () => this.statusFilter() !== 'all' || !!this.assigneeFilter() || !!this.categoryFilter(),
  );

  readonly groups = computed<DayGroup[]>(() => {
    const items = this.visiblePurchases();
    const cats = this.categories();
    const membersMap = this.userService.membersMap();
    const todayIso = this.toIso(new Date());

    const map = new Map<string, PurchaseRow[]>();
    for (const p of items) {
      const list = map.get(p.date) ?? [];
      const cat = p.categoryId ? cats.find(c => c.id === p.categoryId) : undefined;
      list.push({
        id: p.id,
        title: p.title,
        amount: p.amount,
        status: p.status,
        note: p.note,
        assignee: p.assigneeId ? (membersMap.get(p.assigneeId) ?? null) : null,
        categoryIcon: cat?.icon ?? 'shopping_bag',
        categoryName: cat?.name ?? 'Без категории',
        categoryBg: cat?.bg ?? 'var(--surface-muted)',
        categoryColor: cat?.color ?? 'var(--text-500)',
      });
      map.set(p.date, list);
    }

    const groups: DayGroup[] = [];
    for (const [iso, rows] of map) {
      rows.sort((a, b) => {
        // bought first as informational, then planned, then cancelled
        const order: Record<PlannedPurchaseStatus, number> = { planned: 0, bought: 1, cancelled: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return b.amount - a.amount;
      });
      const total = rows
        .filter(r => r.status !== 'cancelled')
        .reduce((s, r) => s + r.amount, 0);
      const [, , dayStr] = iso.split('-');
      const dateObj = new Date(iso + 'T00:00:00');
      groups.push({
        iso,
        day: parseInt(dayStr, 10),
        dayOfWeek: DOW_SHORT[dateObj.getDay()],
        isToday: iso === todayIso,
        isPast: iso < todayIso,
        total,
        rows,
      });
    }

    groups.sort((a, b) => a.iso.localeCompare(b.iso));
    return groups;
  });

  readonly showEmpty = computed(() => this.groups().length === 0);

  readonly isCurrentMonth = computed(() => {
    const now = new Date();
    return this.viewYear() === now.getFullYear() && this.viewMonth() === now.getMonth();
  });

  // ─── Lifecycle ───

  ngOnInit(): void {
    this.financeService.loadPlannedPurchases();
    if (!this.financeService.categories().length) {
      this.financeService.loadCategories();
    }
    if (!this.userService.members().length) {
      this.userService.loadMembers();
    }
  }

  // ─── Month navigation ───

  prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update(y => y - 1);
    } else {
      this.viewMonth.update(m => m - 1);
    }
  }

  nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update(y => y + 1);
    } else {
      this.viewMonth.update(m => m + 1);
    }
  }

  goToCurrentMonth(): void {
    const now = new Date();
    this.viewYear.set(now.getFullYear());
    this.viewMonth.set(now.getMonth());
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.showFormDialog() || this.showDeleteDialog()) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === 'ArrowLeft') this.prevMonth();
    else if (event.key === 'ArrowRight') this.nextMonth();
  }

  // ─── Filters ───

  resetFilters(): void {
    this.statusFilter.set('all');
    this.assigneeFilter.set('');
    this.categoryFilter.set('');
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
  }

  // ─── Form dialog ───

  openCreate(presetDateIso?: string): void {
    this.editingId.set(null);
    this.formTitle = '';
    const now = new Date();
    const sameMonth = this.isCurrentMonth();
    const fallbackDay = sameMonth ? now.getDate() : 1;
    this.formDate = presetDateIso ?? this.toIso(new Date(this.viewYear(), this.viewMonth(), fallbackDay));
    this.formAmount = '';
    this.formAssigneeId = '';
    this.formCategoryId = '';
    this.formNote = '';
    this.showFormDialog.set(true);
  }

  openEdit(row: PurchaseRow): void {
    const item = this.purchases().find(p => p.id === row.id);
    if (!item) return;
    this.editingId.set(item.id);
    this.formTitle = item.title;
    this.formDate = item.date;
    this.formAmount = (item.amount / 100).toString().replace('.', ',');
    this.formAssigneeId = item.assigneeId ?? '';
    this.formCategoryId = item.categoryId ?? '';
    this.formNote = item.note;
    this.showFormDialog.set(true);
  }

  closeFormDialog(): void {
    this.showFormDialog.set(false);
    this.editingId.set(null);
  }

  saveForm(): void {
    const title = this.formTitle.trim();
    if (!title) return;
    if (!this.formDate) return;
    const val = parseFloat(this.formAmount.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) return;

    const amount = Math.round(val * 100);
    const assigneeId = this.formAssigneeId || null;
    const categoryId = this.formCategoryId || null;
    const note = this.formNote.trim();
    const editingId = this.editingId();

    if (editingId) {
      this.financeService.updatePlannedPurchase(editingId, {
        title,
        date: this.formDate,
        amount,
        assigneeId,
        categoryId,
        note,
      });
      this.toast('Покупка обновлена', `${title} · ${this.formatRub(amount)}`);
    } else {
      this.financeService.createPlannedPurchase({
        title,
        date: this.formDate,
        amount,
        assigneeId,
        categoryId,
        note,
      });
      this.toast('Покупка запланирована', `${title} · ${this.formatRub(amount)}`);
    }

    this.closeFormDialog();
  }

  // ─── Status actions ───

  markBought(row: PurchaseRow): void {
    if (row.status === 'bought') return;
    this.financeService.updatePlannedPurchase(row.id, { status: 'bought' });
    this.toast('Отмечено как купленное', row.title);
  }

  markPlanned(row: PurchaseRow): void {
    if (row.status === 'planned') return;
    this.financeService.updatePlannedPurchase(row.id, { status: 'planned' });
    this.toast('Возвращено в план', row.title);
  }

  markCancelled(row: PurchaseRow): void {
    if (row.status === 'cancelled') return;
    this.financeService.updatePlannedPurchase(row.id, { status: 'cancelled' });
    this.toast('Покупка отменена', row.title);
  }

  // ─── Delete ───

  openDelete(row: PurchaseRow): void {
    this.deleteTargetId.set(row.id);
    this.deleteTargetTitle.set(row.title);
    this.showDeleteDialog.set(true);
  }

  confirmDelete(): void {
    const id = this.deleteTargetId();
    const title = this.deleteTargetTitle();
    if (!id) return;
    this.financeService.deletePlannedPurchase(id);
    this.toast('Покупка удалена', title);
    this.cancelDelete();
  }

  cancelDelete(): void {
    this.showDeleteDialog.set(false);
    this.deleteTargetId.set(null);
    this.deleteTargetTitle.set('');
  }

  // ─── Navigation ───

  backToFinance(): void {
    this.router.navigate(['/finance']);
  }

  // ─── Helpers ───

  formatRub(kopecks: number): string {
    const abs = Math.abs(kopecks);
    const rub = Math.floor(abs / 100);
    const kop = abs % 100;
    return rub.toLocaleString('ru-RU') + ',' + kop.toString().padStart(2, '0') + ' ₽';
  }

  formatDayHeading(group: DayGroup): string {
    const date = new Date(group.iso + 'T00:00:00');
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  initialOf(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  statusLabel(status: PlannedPurchaseStatus): string {
    switch (status) {
      case 'planned': return 'Запланировано';
      case 'bought': return 'Куплено';
      case 'cancelled': return 'Отменено';
    }
  }

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private toast(title: string, message = ''): void {
    this.notifications.showToast({ type: 'finance', title, message });
  }
}
