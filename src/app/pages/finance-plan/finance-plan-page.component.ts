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
  PlannedPurchaseAssigneeKind,
  PlannedPurchaseDirection,
  PlannedPurchaseStatus,
  UpdatePlannedPurchaseDto,
} from '../../features/finance/models/finance.models';

type StatusFilter = 'all' | PlannedPurchaseStatus;

interface PurchaseRow {
  id: string;
  title: string;
  direction: PlannedPurchaseDirection;
  amount: number;
  actualAmount: number | null;
  status: PlannedPurchaseStatus;
  note: string;
  assigneeKind: PlannedPurchaseAssigneeKind;
  /** Resolved member when `assigneeKind === 'user'`; otherwise `null`. */
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
  /** Expenses only (active rows, not cancelled), kopecks. */
  expenseTotal: number;
  /** Incomes only (active rows, not cancelled), kopecks. */
  incomeTotal: number;
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
  readonly directionFilter = signal<'all' | PlannedPurchaseDirection>('all');

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
  /**
   * Actual amount (rub, as a string with `,` or `.`). Empty string means
   * "not realised yet" (sent as `null` to the server).
   */
  formActualAmount = '';
  /** Default is expense — matches server's default for `direction: null`. */
  formDirection: PlannedPurchaseDirection = 'expense';
  /** 'user' | 'team' | '' (no selection = unassigned). */
  formAssigneeKind: 'user' | 'team' | '' = '';
  /** Required when formAssigneeKind === 'user', otherwise empty. */
  formAssigneeUserId = '';
  formCategoryId = '';
  formNote = '';

  // ─── Mark-bought confirmation (asks for actual amount) ───
  readonly showMarkBoughtDialog = signal(false);
  readonly markBoughtRow = signal<PurchaseRow | null>(null);
  markBoughtAmountInput = '';

  // ─── Detail dialog (full info on a single planned purchase) ───
  readonly showDetailDialog = signal(false);
  readonly detailRow = signal<PurchaseRow | null>(null);
  readonly detailDayIso = signal<string>(''); // for showing the date in detail dialog

  // ─── Per-user spending breakdown dialog ───
  readonly showBreakdownDialog = signal(false);
  readonly breakdownFromDate = signal('');
  readonly breakdownToDate = signal('');
  readonly breakdownStatus = signal<'all' | 'bought' | 'planned'>('all');

  readonly breakdownStatusOptions: SelectOption[] = [
    { value: 'all', label: 'Все (план + купленные)' },
    { value: 'bought', label: 'Только купленные' },
    { value: 'planned', label: 'Только запланированные' },
  ];

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

  readonly directionFilterOptions: SelectOption[] = [
    { value: 'all', label: 'Доходы и расходы' },
    { value: 'expense', label: 'Только расходы' },
    { value: 'income', label: 'Только доходы' },
  ];

  readonly assigneeOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Любой исполнитель' },
    { value: 'unassigned', label: 'Без исполнителя' },
    { value: 'team', label: 'Команда' },
    ...this.members().map(m => ({ value: m.id, label: m.name })),
  ]);

  readonly categoryOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Все категории' },
    ...this.categories().map(c => ({ value: c.id, label: c.name })),
  ]);

  // Only real members — the "kind" toggle covers the 'unassigned' / 'team'
  // cases, so the user-picker just needs the list of teammates.
  readonly memberOptions = computed<SelectOption[]>(() =>
    this.members().map(m => ({ value: m.id, label: m.name })),
  );

  readonly categorySelectOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Без категории' },
    ...this.categories().map(c => ({ value: c.id, label: c.name })),
  ]);

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
    const direction = this.directionFilter();

    return this.purchases().filter(p => {
      const [y, m] = p.date.split('-').map(Number);
      if (y !== year || m - 1 !== month) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (direction !== 'all' && p.direction !== direction) return false;
      // Assignee filter: '' = any, 'unassigned' = no kind, 'team' = team kind,
      // anything else = specific user id (only matches when kind === 'user').
      if (assignee === 'unassigned' && p.assigneeKind !== null) return false;
      if (assignee === 'team' && p.assigneeKind !== 'team') return false;
      if (
        assignee && assignee !== 'unassigned' && assignee !== 'team'
        && (p.assigneeKind !== 'user' || p.assigneeUserId !== assignee)
      ) return false;
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
    // Direction-aware buckets. For realised entries we use actualAmount when
    // present; for still-planned ones the planned amount.
    let plannedExpense = 0;
    let plannedIncome = 0;
    let boughtExpense = 0;
    let boughtIncome = 0;
    let plannedCount = 0;
    let boughtCount = 0;
    let cancelledCount = 0;
    // Variance for realised expense rows: sum of (actual − planned).
    // Positive = perezhgli (overspend); negative = saved.
    let expenseVariance = 0;

    for (const p of all) {
      const value = p.actualAmount ?? p.amount;
      const isIncome = p.direction === 'income';
      if (p.status === 'planned') {
        if (isIncome) plannedIncome += value; else plannedExpense += value;
        plannedCount++;
      } else if (p.status === 'bought') {
        if (isIncome) boughtIncome += value; else boughtExpense += value;
        boughtCount++;
        if (!isIncome && p.actualAmount !== null) {
          expenseVariance += p.actualAmount - p.amount;
        }
      } else {
        cancelledCount++;
      }
    }

    const plannedTotalExpense = plannedExpense + boughtExpense; // forecast outflow
    const plannedTotalIncome = plannedIncome + boughtIncome;    // forecast inflow

    return {
      plannedExpense,
      plannedIncome,
      boughtExpense,
      boughtIncome,
      /** Forecasted total expense for the month (planned + already bought). */
      forecastExpense: plannedTotalExpense,
      /** Forecasted total income for the month. */
      forecastIncome: plannedTotalIncome,
      /** Net = income − expense. */
      forecastNet: plannedTotalIncome - plannedTotalExpense,
      /**
       * Total saved (negative) or overspent (positive) on already-bought
       * expense rows: Σ(actual − planned). Zero when nothing realised yet.
       */
      expenseVariance,
      plannedCount,
      boughtCount,
      cancelledCount,
      total: all.length,
    };
  });

  readonly hasActiveFilters = computed(
    () => this.statusFilter() !== 'all'
      || this.directionFilter() !== 'all'
      || !!this.assigneeFilter()
      || !!this.categoryFilter(),
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
        direction: p.direction,
        amount: p.amount,
        actualAmount: p.actualAmount,
        status: p.status,
        note: p.note,
        assigneeKind: p.assigneeKind,
        assignee: p.assigneeKind === 'user' && p.assigneeUserId
          ? (membersMap.get(p.assigneeUserId) ?? null)
          : null,
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
      // Use actualAmount when set (status==='bought'), otherwise the planned
      // amount. Cancelled rows are dropped from totals.
      const effective = (r: PurchaseRow): number => r.actualAmount ?? r.amount;
      let expenseTotal = 0;
      let incomeTotal = 0;
      for (const r of rows) {
        if (r.status === 'cancelled') continue;
        if (r.direction === 'income') incomeTotal += effective(r);
        else expenseTotal += effective(r);
      }
      const [, , dayStr] = iso.split('-');
      const dateObj = new Date(iso + 'T00:00:00');
      groups.push({
        iso,
        day: parseInt(dayStr, 10),
        dayOfWeek: DOW_SHORT[dateObj.getDay()],
        isToday: iso === todayIso,
        isPast: iso < todayIso,
        expenseTotal,
        incomeTotal,
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

  // ─── Per-user breakdown ───

  readonly breakdownRows = computed(() => {
    const from = this.breakdownFromDate();
    const to = this.breakdownToDate();
    const status = this.breakdownStatus();
    const membersMap = this.userService.membersMap();
    const members = this.members();

    // Build a lookup: userId -> { count, total } over filtered purchases.
    // Team purchases and unassigned purchases get their own rows.
    const stats = new Map<string, { count: number; total: number }>();
    let unassignedCount = 0;
    let unassignedTotal = 0;
    let teamCount = 0;
    let teamTotal = 0;

    for (const p of this.purchases()) {
      if (from && p.date < from) continue;
      if (to && p.date > to) continue;
      if (status === 'bought' && p.status !== 'bought') continue;
      if (status === 'planned' && p.status !== 'planned') continue;
      if (status === 'all' && p.status === 'cancelled') continue;
      // Breakdown is about "who spends" — only expenses are aggregated here.
      if (p.direction === 'income') continue;

      const value = p.actualAmount ?? p.amount;
      if (p.assigneeKind === 'team') {
        teamCount++;
        teamTotal += value;
        continue;
      }
      if (p.assigneeKind === null || !p.assigneeUserId) {
        unassignedCount++;
        unassignedTotal += value;
        continue;
      }
      const cur = stats.get(p.assigneeUserId) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += value;
      stats.set(p.assigneeUserId, cur);
    }

    const rows = members.map((m) => {
      const s = stats.get(m.id) ?? { count: 0, total: 0 };
      return {
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        count: s.count,
        total: s.total,
      };
    });

    if (teamCount > 0) {
      rows.push({
        id: '__team__',
        name: 'Команда',
        avatar: undefined,
        count: teamCount,
        total: teamTotal,
      });
    }

    if (unassignedCount > 0) {
      rows.push({
        id: '__unassigned__',
        name: 'Не назначено',
        avatar: undefined,
        count: unassignedCount,
        total: unassignedTotal,
      });
    }

    rows.sort((a, b) => b.total - a.total);
    return rows;
  });

  readonly breakdownGrandTotal = computed(() =>
    this.breakdownRows().reduce((s, r) => s + r.total, 0),
  );

  readonly breakdownMaxTotal = computed(() =>
    this.breakdownRows().reduce((m, r) => Math.max(m, r.total), 0),
  );

  /** Use Math from template for percentage bar width. */
  barWidth(value: number): number {
    const max = this.breakdownMaxTotal();
    if (max <= 0) return 0;
    return Math.round((value / max) * 100);
  }

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
    this.directionFilter.set('all');
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
  }

  // ─── Detail dialog ───

  openDetail(row: PurchaseRow, group: DayGroup): void {
    this.detailRow.set(row);
    this.detailDayIso.set(group.iso);
    this.showDetailDialog.set(true);
  }

  closeDetail(): void {
    this.showDetailDialog.set(false);
    this.detailRow.set(null);
  }

  /** Re-resolve the detail row from latest data (e.g. after status change). */
  private refreshDetail(): void {
    const cur = this.detailRow();
    if (!cur) return;
    for (const g of this.groups()) {
      const found = g.rows.find(r => r.id === cur.id);
      if (found) {
        this.detailRow.set(found);
        this.detailDayIso.set(g.iso);
        return;
      }
    }
  }

  detailEdit(): void {
    const r = this.detailRow();
    if (!r) return;
    this.closeDetail();
    this.openEdit(r);
  }

  detailDelete(): void {
    const r = this.detailRow();
    if (!r) return;
    this.closeDetail();
    this.openDelete(r);
  }

  detailMarkBought(): void {
    const r = this.detailRow();
    if (!r) return;
    // Close the detail card first so the mark-bought prompt isn't stacked on
    // top of it. The prompt handles the actual PATCH itself.
    this.closeDetail();
    this.markBought(r);
  }

  detailMarkCancelled(): void {
    const r = this.detailRow();
    if (!r) return;
    this.markCancelled(r);
    this.refreshDetail();
  }

  detailMarkPlanned(): void {
    const r = this.detailRow();
    if (!r) return;
    this.markPlanned(r);
    this.refreshDetail();
  }

  /** Format ISO date as "27 апреля 2026, понедельник". */
  formatLongDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    }).format(d);
  }

  // ─── Breakdown dialog ───

  openBreakdownDialog(): void {
    // Default range = current viewed month
    const y = this.viewYear();
    const m = this.viewMonth();
    const first = this.toIso(new Date(y, m, 1));
    const last = this.toIso(new Date(y, m + 1, 0));
    this.breakdownFromDate.set(first);
    this.breakdownToDate.set(last);
    this.breakdownStatus.set('all');
    this.showBreakdownDialog.set(true);
  }

  closeBreakdownDialog(): void {
    this.showBreakdownDialog.set(false);
  }

  setBreakdownStatus(value: string): void {
    this.breakdownStatus.set(value as 'all' | 'bought' | 'planned');
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
    this.formActualAmount = '';
    this.formDirection = 'expense';
    this.formAssigneeKind = '';
    this.formAssigneeUserId = '';
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
    this.formActualAmount = item.actualAmount !== null
      ? (item.actualAmount / 100).toString().replace('.', ',')
      : '';
    this.formDirection = item.direction;
    this.formAssigneeKind = item.assigneeKind ?? '';
    this.formAssigneeUserId = item.assigneeKind === 'user' ? (item.assigneeUserId ?? '') : '';
    this.formCategoryId = item.categoryId ?? '';
    this.formNote = item.note ?? '';
    this.showFormDialog.set(true);
  }

  setFormDirection(direction: PlannedPurchaseDirection): void {
    this.formDirection = direction;
  }

  /** Called when the kind toggle changes — clears stale user selection. */
  setFormAssigneeKind(kind: 'user' | 'team' | ''): void {
    this.formAssigneeKind = kind;
    if (kind !== 'user') this.formAssigneeUserId = '';
  }

  setDirectionFilter(value: string): void {
    this.directionFilter.set(value as 'all' | PlannedPurchaseDirection);
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
    const categoryId = this.formCategoryId || null;
    const note = this.formNote.trim();
    const editingId = this.editingId();

    // Build the assignee payload following the server contract:
    //   kind 'team' | null → userId must be null
    //   kind 'user'        → userId is required (guard below)
    const kind: PlannedPurchaseAssigneeKind = this.formAssigneeKind === ''
      ? null
      : this.formAssigneeKind;
    let assigneeUserId: string | null;
    if (kind === 'user') {
      assigneeUserId = this.formAssigneeUserId || null;
      // No user picked while kind === 'user' → bail; UI already shows the user
      // dropdown, the user just hasn't chosen yet.
      if (!assigneeUserId) return;
    } else {
      assigneeUserId = null;
    }

    const direction = this.formDirection;
    const isIncome = direction === 'income';

    // Parse actualAmount: empty → null (not realised), otherwise kopecks.
    let actualAmount: number | null = null;
    const actualRaw = this.formActualAmount.replace(',', '.').trim();
    if (actualRaw !== '') {
      const av = parseFloat(actualRaw);
      if (Number.isFinite(av) && av > 0) actualAmount = Math.round(av * 100);
    }

    if (editingId) {
      this.financeService.updatePlannedPurchase(editingId, {
        title,
        date: this.formDate,
        direction,
        amount,
        actualAmount,
        assigneeKind: kind,
        assigneeUserId,
        categoryId,
        note: note || null,
      });
      this.toast(
        isIncome ? 'Доход обновлён' : 'Покупка обновлена',
        `${title} · ${this.formatRub(amount)}`,
      );
    } else {
      this.financeService.createPlannedPurchase({
        title,
        date: this.formDate,
        direction,
        amount,
        actualAmount,
        assigneeKind: kind,
        assigneeUserId,
        categoryId,
        note: note || null,
      });
      this.toast(
        isIncome ? 'Доход запланирован' : 'Покупка запланирована',
        `${title} · ${this.formatRub(amount)}`,
      );
    }

    this.closeFormDialog();
  }

  // ─── Status actions ───

  /**
   * Build a PATCH payload that **only** changes status (+ optional actualAmount).
   * The new server contract treats `null` as a reset, and our DTOs would
   * normally omit unrelated fields. But some bindings round-trip missing
   * nullable fields back to `null` and silently drop the assignee /
   * category / note. To be safe we explicitly pass through the current
   * values of every field the server might otherwise wipe.
   */
  private preservedPatch(row: PurchaseRow): UpdatePlannedPurchaseDto {
    return {
      assigneeKind: row.assigneeKind,
      assigneeUserId: row.assigneeKind === 'user'
        ? this.purchases().find(p => p.id === row.id)?.assigneeUserId ?? null
        : null,
      categoryId: this.purchases().find(p => p.id === row.id)?.categoryId ?? null,
      note: row.note ? row.note : null,
    };
  }

  /**
   * Open a small dialog asking for the real-life amount before flipping the
   * row to `bought`. Pre-fills the input with the planned (or previously
   * recorded actual) amount so users can confirm with one tap if it matched.
   */
  markBought(row: PurchaseRow): void {
    if (row.status === 'bought') return;
    this.markBoughtRow.set(row);
    const initial = row.actualAmount ?? row.amount;
    this.markBoughtAmountInput = (initial / 100).toString().replace('.', ',');
    this.showMarkBoughtDialog.set(true);
  }

  cancelMarkBought(): void {
    this.showMarkBoughtDialog.set(false);
    this.markBoughtRow.set(null);
    this.markBoughtAmountInput = '';
  }

  confirmMarkBought(): void {
    const row = this.markBoughtRow();
    if (!row) return;

    // Parse the actual amount; fall back to plan if empty/invalid.
    const raw = this.markBoughtAmountInput.replace(',', '.').trim();
    let actual = row.amount;
    if (raw !== '') {
      const v = parseFloat(raw);
      if (Number.isFinite(v) && v > 0) actual = Math.round(v * 100);
    }

    this.financeService.updatePlannedPurchase(row.id, {
      ...this.preservedPatch(row),
      status: 'bought',
      actualAmount: actual,
    });

    const variance = actual - row.amount;
    let message = row.title;
    if (variance !== 0) {
      const sign = variance > 0 ? 'перерасход' : 'экономия';
      message = `${row.title} · ${sign} ${this.formatRub(Math.abs(variance))}`;
    }
    this.toast(
      row.direction === 'income' ? 'Доход получен' : 'Отмечено как купленное',
      message,
    );

    this.cancelMarkBought();
  }

  markPlanned(row: PurchaseRow): void {
    if (row.status === 'planned') return;
    // Roll back the realised state: clear actualAmount and return to planned.
    this.financeService.updatePlannedPurchase(row.id, {
      ...this.preservedPatch(row),
      status: 'planned',
      actualAmount: null,
    });
    this.toast('Возвращено в план', row.title);
  }

  markCancelled(row: PurchaseRow): void {
    if (row.status === 'cancelled') return;
    this.financeService.updatePlannedPurchase(row.id, {
      ...this.preservedPatch(row),
      status: 'cancelled',
    });
    this.toast(
      row.direction === 'income' ? 'Доход отменён' : 'Покупка отменена',
      row.title,
    );
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
