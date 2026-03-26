import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  AdjustBalanceDto,
  BalanceResponse,
  Category,
  ChartDataPoint,
  CreateCategoryDto,
  CreateSavingsGoalDto,
  CreateTransactionDto,
  FundSavingsGoalDto,
  PreviousMonthBalanceResponse,
  SavingsGoal,
  SpendingLimits,
  Transaction,
  UpdateTransactionDto,
} from '../models/finance.models';

/**
 * API endpoints:
 *
 * GET    /api/Finance/balance                        → BalanceResponse             Load current balance
 * GET    /api/Finance/balance/previous-month         → PreviousMonthBalanceResponse Load balance at end of previous month
 * PATCH  /api/Finance/balance                        → BalanceResponse             Adjust balance. Body: AdjustBalanceDto { amount }
 *
 * GET    /api/Finance/categories                     → Category[]                  Load all categories
 * POST   /api/Finance/categories                     → Category                    Create a category. Body: CreateCategoryDto
 *
 * GET    /api/Finance/transactions                   → Transaction[]               Load all transactions
 * POST   /api/Finance/transactions                   → Transaction                 Create a transaction. Body: CreateTransactionDto
 * PATCH  /api/Finance/transactions/:id               → Transaction                 Update a transaction. Body: UpdateTransactionDto
 * DELETE /api/Finance/transactions/:id               → void                        Delete a transaction
 *
 * GET    /api/Finance/savings-goals                  → SavingsGoal[]               Load all savings goals
 * POST   /api/Finance/savings-goals                  → SavingsGoal                 Create a savings goal. Body: CreateSavingsGoalDto
 * PATCH  /api/Finance/savings-goals/:id              → SavingsGoal                 Fund a savings goal. Body: FundSavingsGoalDto
 * DELETE /api/Finance/savings-goals/:id              → void                        Delete a savings goal
 *
 * GET    /api/Finance/limits                         → SpendingLimits              Load spending limits
 * PUT    /api/Finance/limits                         → SpendingLimits              Update spending limits. Body: SpendingLimits
 *
 * GET    /api/Finance/chart-data?period=weekly|monthly → ChartDataPoint[]          Load chart data for the given period
 */

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  // ─── State ───

  readonly balance = signal(0);
  readonly previousMonthBalance = signal<number | null>(null);
  readonly categories = signal<Category[]>([]);

  readonly transactions = signal<Transaction[]>([]);
  readonly savingsGoals = signal<SavingsGoal[]>([]);
  readonly limits = signal<SpendingLimits>({ monthlyLimit: 0, weeklyLimit: 0 });
  readonly chartData = signal<ChartDataPoint[]>([]);

  // ─── Balance ───

  loadBalance(): void {
    this.http.get<BalanceResponse>(`${this.apiUrl}/api/Finance/balance`)
      .subscribe(res => {
        this.balance.set(res.balance);
      });
  }

  loadPreviousMonthBalance(): void {
    this.http.get<PreviousMonthBalanceResponse>(`${this.apiUrl}/api/Finance/balance/previous-month`)
      .subscribe(res => {
        this.previousMonthBalance.set(res.balance);
      });
  }

  adjustBalance(amount: number): void {
    // Optimistic update
    this.balance.update(b => b + amount);

    this.http.patch<BalanceResponse>(`${this.apiUrl}/api/Finance/balance`, { amount } as AdjustBalanceDto)
      .subscribe({
        next: res => {
          this.balance.set(res.balance);
        },
        error: () => {
          // Rollback
          this.balance.update(b => b - amount);
        },
      });
  }

  // ─── Categories ───

  loadCategories(): void {
    this.http.get<Category[]>(`${this.apiUrl}/api/Finance/categories`)
      .subscribe(cats => {
        this.categories.set(cats);
      });
  }

  createCategory(dto: CreateCategoryDto): void {
    const tempId = `temp-${Date.now()}`;
    const optimistic: Category = { id: tempId, ...dto };

    // Optimistic update
    this.categories.update(list => [...list, optimistic]);

    this.http.post<Category>(`${this.apiUrl}/api/Finance/categories`, dto)
      .subscribe({
        next: created => {
          this.categories.update(list =>
            list.map(c => c.id === tempId ? created : c),
          );
        },
        error: () => {
          this.categories.update(list => list.filter(c => c.id !== tempId));
        },
      });
  }

  // ─── Transactions ───

  loadTransactions(): void {
    this.http.get<Transaction[]>(`${this.apiUrl}/api/Finance/transactions`)
      .subscribe(txs => {
        this.transactions.set(txs);
      });
  }

  createTransaction(dto: CreateTransactionDto): void {
    this.http.post<Transaction>(`${this.apiUrl}/api/Finance/transactions`, dto)
      .subscribe(created => {
        this.transactions.update(list => [created, ...list]);
        // Balance is updated server-side; reload to stay in sync
        this.loadBalance();
      });
  }

  updateTransaction(id: string, dto: UpdateTransactionDto): void {
    const backup = this.transactions();

    // Optimistic update
    this.transactions.update(list =>
      list.map(t => t.id === id ? { ...t, ...dto } : t),
    );

    this.http.patch<Transaction>(`${this.apiUrl}/api/Finance/transactions/${id}`, dto)
      .subscribe({
        next: updated => {
          this.transactions.update(list =>
            list.map(t => t.id === id ? updated : t),
          );
          this.loadBalance();
        },
        error: () => {
          this.transactions.set(backup);
        },
      });
  }

  deleteTransaction(id: string): void {
    const backup = this.transactions();

    // Optimistic update
    this.transactions.update(list => list.filter(t => t.id !== id));

    this.http.delete(`${this.apiUrl}/api/Finance/transactions/${id}`)
      .subscribe({
        next: () => {
          this.loadBalance();
        },
        error: () => {
          this.transactions.set(backup);
        },
      });
  }

  // ─── Savings goals ───

  loadSavingsGoals(): void {
    this.http.get<SavingsGoal[]>(`${this.apiUrl}/api/Finance/savings-goals`)
      .subscribe(goals => {
        this.savingsGoals.set(goals);
      });
  }

  createSavingsGoal(dto: CreateSavingsGoalDto): void {
    this.http.post<SavingsGoal>(`${this.apiUrl}/api/Finance/savings-goals`, dto)
      .subscribe(created => {
        this.savingsGoals.update(list => [...list, created]);
      });
  }

  fundSavingsGoal(id: string, amount: number): void {
    // Optimistic update
    this.savingsGoals.update(list =>
      list.map(g => g.id === id ? { ...g, current: g.current + amount } : g),
    );

    this.http.patch<SavingsGoal>(`${this.apiUrl}/api/Finance/savings-goals/${id}`, { amount } as FundSavingsGoalDto)
      .subscribe({
        next: updated => {
          this.savingsGoals.update(list => list.map(g => g.id === id ? updated : g));
        },
        error: () => {
          this.savingsGoals.update(list =>
            list.map(g => g.id === id ? { ...g, current: g.current - amount } : g),
          );
        },
      });
  }

  deleteSavingsGoal(id: string): void {
    const backup = this.savingsGoals();

    this.savingsGoals.update(list => list.filter(g => g.id !== id));

    this.http.delete(`${this.apiUrl}/api/Finance/savings-goals/${id}`)
      .subscribe({
        error: () => {
          this.savingsGoals.set(backup);
        },
      });
  }

  // ─── Limits ───

  loadLimits(): void {
    this.http.get<SpendingLimits>(`${this.apiUrl}/api/Finance/limits`)
      .subscribe(limits => {
        this.limits.set(limits);
      });
  }

  updateLimits(limits: SpendingLimits): void {
    const backup = this.limits();

    // Optimistic update
    this.limits.set(limits);

    this.http.put<SpendingLimits>(`${this.apiUrl}/api/Finance/limits`, limits)
      .subscribe({
        next: updated => {
          this.limits.set(updated);
        },
        error: () => {
          this.limits.set(backup);
        },
      });
  }

  // ─── Chart data ───

  loadChartData(period: 'weekly' | 'monthly'): void {
    this.http.get<ChartDataPoint[]>(`${this.apiUrl}/api/Finance/chart-data`, {
      params: { period },
    }).subscribe(data => {
      this.chartData.set(data);
    });
  }
}
