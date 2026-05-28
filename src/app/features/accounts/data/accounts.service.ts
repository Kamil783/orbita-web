import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  Account,
  AccountsTotal,
  CreateAccountDto,
  Currency,
  UpdateAccountDto,
} from '../models/account.models';

/**
 * API endpoints:
 *
 * GET    /api/Currencies            → Currency[]        All known currencies with current rates.
 *
 * GET    /api/Accounts              → Account[]         Team's accounts.
 * POST   /api/Accounts              → Account           Body: CreateAccountDto. Validates that currencyCode exists.
 * PATCH  /api/Accounts/:id          → Account           Body: UpdateAccountDto. PATCH semantics — `null` means "don't touch".
 * DELETE /api/Accounts/:id          → void              Delete.
 *
 * GET    /api/Accounts/total        → AccountsTotal     Per-account RUB conversion + totalRub.
 *                                                       Accounts whose currency has no rate get convertedRub=null
 *                                                       and are excluded from totalRub.
 */

const EXCLUDED_STORAGE_KEY = 'orbita.accounts.excludedIds';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  // ─── Server state ───
  readonly currencies = signal<Currency[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly total = signal<AccountsTotal | null>(null);

  /**
   * Account ids the user has toggled OFF from the "общий баланс" calculation.
   * Persisted in localStorage so the preference survives reloads. Server-side
   * total still includes everything; we recompute the effective total on the
   * client below.
   */
  readonly excludedIds = signal<Set<string>>(this.loadExcluded());

  // ─── Computed ───

  /** Look up by code: `currencyMap().get('USD')`. */
  readonly currencyMap = computed(() => {
    const map = new Map<string, Currency>();
    for (const c of this.currencies()) map.set(c.code, c);
    return map;
  });

  /**
   * Effective total in RUB, with the user's exclusions applied.
   * Falls back to the server's `totalRub` when nothing is excluded.
   */
  readonly effectiveTotalRub = computed(() => {
    const t = this.total();
    if (!t) return 0;
    const excluded = this.excludedIds();
    if (excluded.size === 0) return t.totalRub;
    let sum = 0;
    for (const item of t.items) {
      if (excluded.has(item.id)) continue;
      if (item.convertedRub == null) continue;
      sum += item.convertedRub;
    }
    return sum;
  });

  /** Count of accounts that contribute to `effectiveTotalRub`. */
  readonly effectiveCount = computed(() => {
    const t = this.total();
    if (!t) return 0;
    const excluded = this.excludedIds();
    let n = 0;
    for (const item of t.items) {
      if (excluded.has(item.id)) continue;
      if (item.convertedRub == null) continue;
      n++;
    }
    return n;
  });

  // ─── Loaders ───

  loadCurrencies(): void {
    this.http.get<Currency[]>(`${this.apiUrl}/api/Currencies`)
      .subscribe(list => this.currencies.set(list));
  }

  loadAccounts(): void {
    this.http.get<Account[]>(`${this.apiUrl}/api/Accounts`)
      .subscribe(list => this.accounts.set(list));
  }

  loadTotal(): void {
    this.http.get<AccountsTotal>(`${this.apiUrl}/api/Accounts/total`)
      .subscribe(total => this.total.set(total));
  }

  /** One call to refresh everything — used after CRUD operations. */
  refresh(): void {
    this.loadAccounts();
    this.loadTotal();
  }

  // ─── CRUD ───

  createAccount(dto: CreateAccountDto, onSuccess?: (created: Account) => void): void {
    this.http.post<Account>(`${this.apiUrl}/api/Accounts`, dto)
      .subscribe(created => {
        this.accounts.update(list => [...list, created]);
        this.loadTotal();
        onSuccess?.(created);
      });
  }

  updateAccount(id: string, dto: UpdateAccountDto): void {
    const backup = this.accounts();
    this.accounts.update(list => list.map(a => a.id === id
      ? {
          ...a,
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.currencyCode !== undefined ? { currencyCode: dto.currencyCode } : {}),
          ...(dto.balance !== undefined ? { balance: dto.balance } : {}),
        }
      : a,
    ));

    this.http.patch<Account>(`${this.apiUrl}/api/Accounts/${id}`, dto).subscribe({
      next: updated => {
        this.accounts.update(list => list.map(a => a.id === id ? updated : a));
        this.loadTotal();
      },
      error: () => this.accounts.set(backup),
    });
  }

  deleteAccount(id: string): void {
    const backup = this.accounts();
    this.accounts.update(list => list.filter(a => a.id !== id));
    // Also drop from exclusions if it was there.
    this.excludedIds.update(set => {
      if (!set.has(id)) return set;
      const next = new Set(set);
      next.delete(id);
      this.persistExcluded(next);
      return next;
    });

    this.http.delete(`${this.apiUrl}/api/Accounts/${id}`).subscribe({
      next: () => this.loadTotal(),
      error: () => this.accounts.set(backup),
    });
  }

  // ─── Exclusion toggle (client-only) ───

  toggleIncluded(id: string): void {
    this.excludedIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      this.persistExcluded(next);
      return next;
    });
  }

  isIncluded(id: string): boolean {
    return !this.excludedIds().has(id);
  }

  // ─── localStorage persistence ───

  private loadExcluded(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(EXCLUDED_STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
    } catch {
      return new Set();
    }
  }

  private persistExcluded(set: Set<string>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(EXCLUDED_STORAGE_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }
}
