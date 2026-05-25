import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  AdjustBalanceDto,
  BalanceResponse,
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSavingsGoalDto,
  UpdateSavingsGoalDto,
  CreateShoppingListDto,
  CreateShoppingListItemDto,
  CreateTransactionDto,
  FundSavingsGoalDto,
  WithdrawSavingsGoalDto,
  PreviousMonthBalanceResponse,
  SavingsGoal,
  ShoppingList,
  ShoppingListItem,
  SpendingLimits,
  ReorderShoppingListItemsDto,
  ToggleShoppingListItemDto,
  UpdateShoppingListDto,
  UpdateShoppingListItemDto,
  Transaction,
  UpdateTransactionDto,
  RecurringPayment,
  CreateRecurringPaymentDto,
  UpdateRecurringPaymentDto,
  PlannedPurchase,
  CreatePlannedPurchaseDto,
  UpdatePlannedPurchaseDto,
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
 * PATCH    /api/Finance/categories/:id                 → Category                    Update a category. Body: UpdateCategoryDto
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
 * GET    /api/Finance/recurring-payments             → RecurringPayment[]          Load mandatory monthly payments
 * POST   /api/Finance/recurring-payments             → RecurringPayment            Create. Body: CreateRecurringPaymentDto
 * PATCH  /api/Finance/recurring-payments/:id         → RecurringPayment            Update. Body: UpdateRecurringPaymentDto
 * DELETE /api/Finance/recurring-payments/:id         → void                        Delete
 *
 * GET    /api/Finance/planned-purchases              → PlannedPurchase[]           Load planned purchases. Optional `?direction=expense|income` filter.
 * POST   /api/Finance/planned-purchases              → PlannedPurchase             Create. Body: CreatePlannedPurchaseDto
 * PATCH  /api/Finance/planned-purchases/:id          → PlannedPurchase             Update. Body: UpdatePlannedPurchaseDto
 * DELETE /api/Finance/planned-purchases/:id          → void                        Delete
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
  readonly recurringPayments = signal<RecurringPayment[]>([]);

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

  updateCategory(id: string, dto: UpdateCategoryDto): void {
    const backup = this.categories();

    // Optimistic update
    this.categories.update(list =>
      list.map(c => c.id === id ? { ...c, ...dto } : c),
    );

    this.http.patch<Category>(`${this.apiUrl}/api/Finance/categories/${id}`, dto)
      .subscribe({
        next: updated => {
          this.categories.update(list =>
            list.map(c => c.id === id ? updated : c),
          );
        },
        error: () => {
          this.categories.set(backup);
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

  createTransaction(dto: CreateTransactionDto, onSuccess?: (tx: Transaction) => void): void {
    this.http.post<Transaction>(`${this.apiUrl}/api/Finance/transactions`, dto)
      .subscribe(created => {
        this.transactions.update(list => [created, ...list]);
        // Balance is updated server-side; reload to stay in sync
        this.loadBalance();
        onSuccess?.(created);
      });
  }

  updateTransaction(id: string, dto: UpdateTransactionDto): void {
    const backup = this.transactions();

    const patchDto: UpdateTransactionDto = {
      ...dto,
      ...(Object.prototype.hasOwnProperty.call(dto, 'categoryId')
        ? { categoryId: dto.categoryId ?? null }
        : {}),
    };

    this.transactions.update(list =>
      list.map(t => {
        if (t.id !== id) {
          return t;
        }

        return {
          ...t,
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.fromBalance !== undefined ? { fromBalance: dto.fromBalance } : {}),
          ...(dto.date !== undefined ? { date: dto.date } : {}),
          ...(dto.categoryId !== undefined && dto.categoryId !== null
            ? { categoryId: dto.categoryId }
            : {}),
        };
      }),
    );

    this.http.patch<Transaction>(
      `${this.apiUrl}/api/Finance/transactions/${id}`,
      patchDto,
    ).subscribe({
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
          this.loadBalance();
        },
        error: () => {
          this.savingsGoals.update(list =>
            list.map(g => g.id === id ? { ...g, current: g.current - amount } : g),
          );
        },
      });
  }

  withdrawSavingsGoal(id: string, amount: number): void {
    // Optimistic update
    this.savingsGoals.update(list =>
      list.map(g => g.id === id ? { ...g, current: Math.max(0, g.current - amount) } : g),
    );

    this.http.patch<SavingsGoal>(
      `${this.apiUrl}/api/Finance/savings-goals/${id}/withdraw`,
      { amount } as WithdrawSavingsGoalDto,
    ).subscribe({
      next: updated => {
        this.savingsGoals.update(list => list.map(g => g.id === id ? updated : g));
        this.loadBalance();
      },
      error: () => {
        this.savingsGoals.update(list =>
          list.map(g => g.id === id ? { ...g, current: g.current + amount } : g),
        );
      },
    });
  }

  updateSavingsGoal(id: string, dto: UpdateSavingsGoalDto): void {
    const backup = this.savingsGoals();

    this.savingsGoals.update(list =>
      list.map(g => g.id === id ? { ...g, ...dto } : g),
    );

    this.http.patch<SavingsGoal>(`${this.apiUrl}/api/Finance/savings-goals/${id}/details`, dto)
      .subscribe({
        next: updated => {
          this.savingsGoals.update(list => list.map(g => g.id === id ? updated : g));
        },
        error: () => {
          this.savingsGoals.set(backup);
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

  // ─── Shopping lists ───

  readonly shoppingLists = signal<ShoppingList[]>([]);

  loadShoppingLists(): void {
    this.http.get<ShoppingList[]>(`${this.apiUrl}/api/Finance/shopping-lists`)
      .subscribe(lists => {
        this.shoppingLists.set(lists);
      });
  }

  /**
   * Create a shopping list. `fromBalance` chooses the wallet:
   *   `false` → personal список,
   *   `true`  → shared список.
   * The server is responsible for mapping the boolean to `listType`
   * ('personal' / 'shared'). Team lists are managed elsewhere and are not
   * created via this method.
   */
  createShoppingList(name: string, fromBalance: boolean): void {
    this.http.post<ShoppingList>(
      `${this.apiUrl}/api/Finance/shopping-lists`,
      { name, fromBalance } as CreateShoppingListDto,
    ).subscribe(created => {
      this.shoppingLists.update(lists => [...lists, created]);
    });
  }

  updateShoppingList(id: string, dto: UpdateShoppingListDto): void {
    const backup = this.shoppingLists();

    this.shoppingLists.update(lists =>
      lists.map(l => l.id === id ? { ...l, ...dto } : l),
    );

    this.http.patch<ShoppingList>(`${this.apiUrl}/api/Finance/shopping-lists/${id}`, dto)
      .subscribe({
        next: updated => {
          this.shoppingLists.update(lists => lists.map(l => l.id === id ? updated : l));
        },
        error: () => {
          this.shoppingLists.set(backup);
        },
      });
  }

  deleteShoppingList(id: string): void {
    const backup = this.shoppingLists();
    this.shoppingLists.update(lists => lists.filter(l => l.id !== id));

    this.http.delete(`${this.apiUrl}/api/Finance/shopping-lists/${id}`)
      .subscribe({
        error: () => {
          this.shoppingLists.set(backup);
        },
      });
  }

  addShoppingListItem(listId: string, name: string, price: number | null): void {
    this.http.post<ShoppingListItem>(
      `${this.apiUrl}/api/Finance/shopping-lists/${listId}/items`,
      { name, price } as CreateShoppingListItemDto,
    ).subscribe(created => {
      this.shoppingLists.update(lists =>
        lists.map(l => l.id === listId ? { ...l, items: [...l.items, created] } : l),
      );
    });
  }

  updateShoppingListItem(listId: string, itemId: string, dto: UpdateShoppingListItemDto): void {
    const backup = this.shoppingLists();

    this.shoppingLists.update(lists =>
      lists.map(l => l.id === listId
        ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, ...dto } : i) }
        : l),
    );

    this.http.patch<ShoppingListItem>(
      `${this.apiUrl}/api/Finance/shopping-lists/${listId}/items/${itemId}/details`,
      dto,
    ).subscribe({
      next: updated => {
        this.shoppingLists.update(lists =>
          lists.map(l => l.id === listId
            ? { ...l, items: l.items.map(i => i.id === itemId ? updated : i) }
            : l),
        );
      },
      error: () => {
        this.shoppingLists.set(backup);
      },
    });
  }

  reorderShoppingListItems(listId: string, itemIds: string[]): void {
    const backup = this.shoppingLists();

    // Optimistic reorder
    this.shoppingLists.update(lists =>
      lists.map(l => {
        if (l.id !== listId) return l;
        const byId = new Map(l.items.map(i => [i.id, i]));
        const reordered = itemIds
          .map((id, idx) => {
            const it = byId.get(id);
            return it ? { ...it, order: idx } : null;
          })
          .filter((i): i is ShoppingListItem => i !== null);
        return { ...l, items: reordered };
      }),
    );

    this.http.put(
      `${this.apiUrl}/api/Finance/shopping-lists/${listId}/items/reorder`,
      { itemIds } as ReorderShoppingListItemsDto,
    ).subscribe({
      error: () => {
        this.shoppingLists.set(backup);
      },
    });
  }

  removeShoppingListItem(listId: string, itemId: string): void {
    const backup = this.shoppingLists();
    this.shoppingLists.update(lists =>
      lists.map(l => l.id === listId ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l),
    );

    this.http.delete(`${this.apiUrl}/api/Finance/shopping-lists/${listId}/items/${itemId}`)
      .subscribe({
        error: () => {
          this.shoppingLists.set(backup);
        },
      });
  }

  toggleShoppingListItem(listId: string, itemId: string): void {
    const list = this.shoppingLists().find(l => l.id === listId);
    const item = list?.items.find(i => i.id === itemId);
    if (!item) return;

    const newBought = !item.bought;

    // Optimistic update
    this.shoppingLists.update(lists =>
      lists.map(l => l.id === listId
        ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, bought: newBought } : i) }
        : l),
    );

    this.http.patch<ShoppingListItem>(
      `${this.apiUrl}/api/Finance/shopping-lists/${listId}/items/${itemId}`,
      { bought: newBought } as ToggleShoppingListItemDto,
    ).subscribe({
      next: updated => {
        this.shoppingLists.update(lists =>
          lists.map(l => l.id === listId
            ? { ...l, items: l.items.map(i => i.id === itemId ? updated : i) }
            : l),
        );
        this.loadTransactions();
        this.loadBalance();
      },
      error: () => {
        // Rollback
        this.shoppingLists.update(lists =>
          lists.map(l => l.id === listId
            ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, bought: !newBought } : i) }
            : l),
        );
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

  // ─── Recurring (mandatory) payments ───

  loadRecurringPayments(): void {
    this.http.get<RecurringPayment[]>(`${this.apiUrl}/api/Finance/recurring-payments`)
      .subscribe(list => {
        this.recurringPayments.set(list);
      });
  }

  createRecurringPayment(dto: CreateRecurringPaymentDto): void {
    this.http.post<RecurringPayment>(`${this.apiUrl}/api/Finance/recurring-payments`, dto)
      .subscribe(created => {
        this.recurringPayments.update(list => [...list, created]);
      });
  }

  updateRecurringPayment(id: string, dto: UpdateRecurringPaymentDto): void {
    this.http.patch<RecurringPayment>(`${this.apiUrl}/api/Finance/recurring-payments/${id}`, dto)
      .subscribe(updated => {
        this.recurringPayments.update(list =>
          list.map(p => p.id === id ? updated : p),
        );
      });
  }

  deleteRecurringPayment(id: string): void {
    const backup = this.recurringPayments();
    this.recurringPayments.update(list => list.filter(p => p.id !== id));
    this.http.delete(`${this.apiUrl}/api/Finance/recurring-payments/${id}`).subscribe({
      error: () => this.recurringPayments.set(backup),
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

  // ─── Planned purchases ───

  readonly plannedPurchases = signal<PlannedPurchase[]>([]);

  loadPlannedPurchases(): void {
    this.http.get<PlannedPurchase[]>(`${this.apiUrl}/api/Finance/planned-purchases`)
      .subscribe(list => {
        this.plannedPurchases.set(list);
      });
  }

  createPlannedPurchase(dto: CreatePlannedPurchaseDto): void {
    this.http.post<PlannedPurchase>(`${this.apiUrl}/api/Finance/planned-purchases`, dto)
      .subscribe(created => {
        this.plannedPurchases.update(list => [...list, created]);
      });
  }

  updatePlannedPurchase(id: string, dto: UpdatePlannedPurchaseDto): void {
    const backup = this.plannedPurchases();

    // Optimistic update
    this.plannedPurchases.update(list =>
      list.map(p => p.id === id
        ? {
            ...p,
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.date !== undefined ? { date: dto.date } : {}),
            // `direction: null` on the wire means "don't touch", so we only
            // apply real values here.
            ...(dto.direction != null ? { direction: dto.direction } : {}),
            ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
            ...(dto.actualAmount !== undefined ? { actualAmount: dto.actualAmount } : {}),
            ...(dto.assigneeKind !== undefined ? { assigneeKind: dto.assigneeKind } : {}),
            ...(dto.assigneeUserId !== undefined ? { assigneeUserId: dto.assigneeUserId } : {}),
            ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
            ...(dto.note !== undefined ? { note: dto.note ?? '' } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          }
        : p,
      ),
    );

    this.http.patch<PlannedPurchase>(`${this.apiUrl}/api/Finance/planned-purchases/${id}`, dto)
      .subscribe({
        next: updated => {
          this.plannedPurchases.update(list => list.map(p => p.id === id ? updated : p));
        },
        error: () => {
          this.plannedPurchases.set(backup);
        },
      });
  }

  deletePlannedPurchase(id: string): void {
    const backup = this.plannedPurchases();
    this.plannedPurchases.update(list => list.filter(p => p.id !== id));

    this.http.delete(`${this.apiUrl}/api/Finance/planned-purchases/${id}`)
      .subscribe({
        error: () => {
          this.plannedPurchases.set(backup);
        },
      });
  }

}
