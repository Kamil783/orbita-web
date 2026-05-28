import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { ModalOverlayComponent } from '../../shared/ui/modal-overlay/modal-overlay.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { AccountsService } from '../../features/accounts/data/accounts.service';
import { NotificationService } from '../../features/notifications/data/notification.service';
import {
  Account,
  AccountsTotalItem,
  CurrencyKind,
} from '../../features/accounts/models/account.models';

interface AccountRow {
  id: string;
  name: string;
  currencyCode: string;
  currencyName: string;
  kind: CurrencyKind;
  balance: number;
  convertedRub: number | null;
  rateToRub: number | null;
  nominal: number;
  rateFetchedAt: number | null;
  included: boolean;
  hasRate: boolean;
}

@Component({
  selector: 'app-accounts-page',
  standalone: true,
  imports: [
    AppShellComponent,
    TopbarComponent,
    ModalOverlayComponent,
    ConfirmDialogComponent,
    SelectComponent,
    FormsModule,
  ],
  templateUrl: './accounts-page.component.html',
  styleUrl: './accounts-page.component.scss',
})
export class AccountsPageComponent implements OnInit {
  private readonly accountsService = inject(AccountsService);
  private readonly notifications = inject(NotificationService);

  readonly title = 'Счета';

  // ─── Server state ───
  readonly currencies = this.accountsService.currencies;
  readonly accounts = this.accountsService.accounts;
  readonly total = this.accountsService.total;
  readonly effectiveTotalRub = this.accountsService.effectiveTotalRub;
  readonly effectiveCount = this.accountsService.effectiveCount;

  // ─── Currency picker options for forms ───
  readonly currencyOptions = computed<SelectOption[]>(() =>
    this.currencies().map(c => ({
      value: c.code,
      label: `${c.code} · ${c.name}`,
    })),
  );

  // ─── Dialog state ───
  readonly showFormDialog = signal(false);
  readonly editingId = signal<string | null>(null);
  formName = '';
  formCurrencyCode = '';
  formBalance = '';

  readonly showDeleteDialog = signal(false);
  readonly deleteTargetId = signal<string | null>(null);
  readonly deleteTargetName = signal('');

  // ─── Derived view rows ───
  readonly rows = computed<AccountRow[]>(() => {
    const accounts = this.accounts();
    const total = this.total();
    const currencies = this.accountsService.currencyMap();
    const excluded = this.accountsService.excludedIds();
    const itemsById = new Map<string, AccountsTotalItem>();
    if (total) for (const it of total.items) itemsById.set(it.id, it);

    return accounts.map(a => {
      const cur = currencies.get(a.currencyCode);
      const item = itemsById.get(a.id);
      const convertedRub = item ? item.convertedRub : null;
      return {
        id: a.id,
        name: a.name,
        currencyCode: a.currencyCode,
        currencyName: cur?.name ?? a.currencyCode,
        kind: cur?.kind ?? 'fiat',
        balance: a.balance,
        convertedRub,
        rateToRub: cur?.rateToRub ?? null,
        nominal: cur?.nominal ?? 1,
        rateFetchedAt: cur?.rateFetchedAt ?? null,
        included: !excluded.has(a.id),
        hasRate: convertedRub != null,
      };
    });
  });

  /** All-time totals breakdown for the hero card. */
  readonly summary = computed(() => {
    const rows = this.rows();
    const included = rows.filter(r => r.included && r.hasRate);
    const excluded = rows.filter(r => !r.included);
    const noRate = rows.filter(r => !r.hasRate);
    return {
      includedSum: included.reduce((s, r) => s + (r.convertedRub ?? 0), 0),
      includedCount: included.length,
      excludedSum: excluded
        .filter(r => r.hasRate)
        .reduce((s, r) => s + (r.convertedRub ?? 0), 0),
      excludedCount: excluded.length,
      noRateCount: noRate.length,
      totalAccounts: rows.length,
    };
  });

  // ─── Lifecycle ───

  ngOnInit(): void {
    this.accountsService.loadCurrencies();
    this.accountsService.loadAccounts();
    this.accountsService.loadTotal();
  }

  // ─── Toggle inclusion ───

  toggleIncluded(row: AccountRow): void {
    this.accountsService.toggleIncluded(row.id);
  }

  // ─── Create / edit dialog ───

  openCreate(): void {
    this.editingId.set(null);
    this.formName = '';
    // Pre-select the first currency (server should always return RUB at least).
    this.formCurrencyCode = this.currencies()[0]?.code ?? '';
    this.formBalance = '';
    this.showFormDialog.set(true);
  }

  openEdit(row: AccountRow): void {
    this.editingId.set(row.id);
    this.formName = row.name;
    this.formCurrencyCode = row.currencyCode;
    this.formBalance = row.balance.toString().replace('.', ',');
    this.showFormDialog.set(true);
  }

  closeFormDialog(): void {
    this.showFormDialog.set(false);
  }

  saveForm(): void {
    const name = this.formName.trim();
    if (!name || !this.formCurrencyCode) return;
    const balance = parseFloat(this.formBalance.replace(',', '.').trim() || '0');
    if (!Number.isFinite(balance)) return;

    const editingId = this.editingId();
    if (editingId) {
      this.accountsService.updateAccount(editingId, {
        name,
        currencyCode: this.formCurrencyCode,
        balance,
      });
      this.toast('Счёт обновлён', `${name} · ${this.formCurrencyCode}`);
    } else {
      this.accountsService.createAccount(
        { name, currencyCode: this.formCurrencyCode, balance },
        (created) => this.toast('Счёт создан', `${created.name} · ${created.currencyCode}`),
      );
    }
    this.closeFormDialog();
  }

  // ─── Delete dialog ───

  openDelete(row: AccountRow): void {
    this.deleteTargetId.set(row.id);
    this.deleteTargetName.set(row.name);
    this.showDeleteDialog.set(true);
  }

  cancelDelete(): void {
    this.showDeleteDialog.set(false);
    this.deleteTargetId.set(null);
  }

  confirmDelete(): void {
    const id = this.deleteTargetId();
    const name = this.deleteTargetName();
    if (!id) return;
    this.accountsService.deleteAccount(id);
    this.toast('Счёт удалён', name);
    this.cancelDelete();
  }

  // ─── Formatters ───

  /**
   * Format an amount in its native currency. Crypto and exotic currencies may
   * need 4–8 digits; fiat usually 2. We use up to 8 if needed and trim
   * trailing zeros via toLocaleString.
   */
  formatBalance(value: number, currencyCode: string): string {
    const kind = this.accountsService.currencyMap().get(currencyCode)?.kind ?? 'fiat';
    const max = kind === 'crypto' ? 8 : 2;
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: max,
    }).format(value) + ' ' + currencyCode;
  }

  formatRub(value: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatRateAgeNote(ts: number | null): string {
    if (!ts) return '';
    const diffMs = Date.now() - ts;
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'обновлён только что';
    if (minutes < 60) return `обновлён ${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `обновлён ${hours} ч назад`;
    const days = Math.floor(hours / 24);
    return `обновлён ${days} дн назад`;
  }

  formatRate(row: AccountRow): string {
    if (row.rateToRub == null) return 'курс не найден';
    // Rate is RUB-for-nominal-units, so per 1 unit = rate / nominal.
    const perOne = row.rateToRub / (row.nominal || 1);
    const fmt = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
    return `1 ${row.currencyCode} ≈ ${fmt.format(perOne)} ₽`;
  }

  private toast(title: string, message = ''): void {
    this.notifications.showToast({ type: 'finance', title, message });
  }
}
