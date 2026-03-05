import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  FoodEntry,
  MealCategory,
  NutritionGoal,
  DEFAULT_MEAL_CATEGORIES,
  DEFAULT_NUTRITION_GOAL,
} from '../models/health.models';

/**
 * API endpoints:
 *
 * GET    /api/Health/goals                → NutritionGoal         Load daily nutrition goal
 * PUT    /api/Health/goals                → NutritionGoal         Update daily nutrition goal
 *
 * GET    /api/Health/meal-categories      → MealCategory[]        Load meal categories
 * POST   /api/Health/meal-categories      → MealCategory          Create a meal category
 * DELETE /api/Health/meal-categories/:id  → void                  Delete a meal category
 *
 * GET    /api/Health/food-entries?date=YYYY-MM-DD → FoodEntry[]   Load food entries for a date
 * POST   /api/Health/food-entries         → FoodEntry             Create a food entry
 * PUT    /api/Health/food-entries/:id      → FoodEntry             Update a food entry
 * DELETE /api/Health/food-entries/:id      → void                  Delete a food entry
 *
 * POST   /api/Health/ai-analyze           → AiAnalysisResult      Analyze food description with AI
 */

export interface AiAnalysisResult {
  foods: {
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  readonly goal = signal<NutritionGoal>(DEFAULT_NUTRITION_GOAL);
  readonly mealCategories = signal<MealCategory[]>(DEFAULT_MEAL_CATEGORIES);
  readonly foodEntries = signal<FoodEntry[]>([]);

  // ─── Goals ───

  loadGoal(): void {
    this.http.get<NutritionGoal>(`${this.apiUrl}/api/Health/goals`)
      .subscribe(g => this.goal.set(g));
  }

  updateGoal(goal: NutritionGoal): void {
    const backup = this.goal();
    this.goal.set(goal);
    this.http.put<NutritionGoal>(`${this.apiUrl}/api/Health/goals`, goal)
      .subscribe({
        next: updated => this.goal.set(updated),
        error: () => this.goal.set(backup),
      });
  }

  // ─── Meal Categories ───

  loadMealCategories(): void {
    this.http.get<MealCategory[]>(`${this.apiUrl}/api/Health/meal-categories`)
      .subscribe(cats => this.mealCategories.set(cats));
  }

  createMealCategory(dto: Omit<MealCategory, 'id'>): void {
    const tempId = `temp-${Date.now()}`;
    const optimistic: MealCategory = { id: tempId, ...dto };
    this.mealCategories.update(list => [...list, optimistic]);

    this.http.post<MealCategory>(`${this.apiUrl}/api/Health/meal-categories`, dto)
      .subscribe({
        next: created => {
          this.mealCategories.update(list =>
            list.map(c => c.id === tempId ? created : c),
          );
        },
        error: () => {
          this.mealCategories.update(list => list.filter(c => c.id !== tempId));
        },
      });
  }

  deleteMealCategory(id: string): void {
    const backup = this.mealCategories();
    this.mealCategories.update(list => list.filter(c => c.id !== id));
    this.foodEntries.update(list => list.filter(e => e.mealCategoryId !== id));

    this.http.delete(`${this.apiUrl}/api/Health/meal-categories/${id}`)
      .subscribe({
        error: () => this.mealCategories.set(backup),
      });
  }

  // ─── Food Entries ───

  loadFoodEntries(date: string): void {
    this.http.get<FoodEntry[]>(`${this.apiUrl}/api/Health/food-entries`, {
      params: { date },
    }).subscribe(entries => this.foodEntries.set(entries));
  }

  createFoodEntry(dto: Omit<FoodEntry, 'id'>): void {
    const tempId = `temp-${Date.now()}`;
    const optimistic: FoodEntry = { id: tempId, ...dto };
    this.foodEntries.update(list => [...list, optimistic]);

    this.http.post<FoodEntry>(`${this.apiUrl}/api/Health/food-entries`, dto)
      .subscribe({
        next: created => {
          this.foodEntries.update(list =>
            list.map(e => e.id === tempId ? created : e),
          );
        },
        error: () => {
          this.foodEntries.update(list => list.filter(e => e.id !== tempId));
        },
      });
  }

  deleteFoodEntry(id: string): void {
    const backup = this.foodEntries();
    this.foodEntries.update(list => list.filter(e => e.id !== id));

    this.http.delete(`${this.apiUrl}/api/Health/food-entries/${id}`)
      .subscribe({
        error: () => this.foodEntries.set(backup),
      });
  }

  // ─── AI Analysis ───

  analyzeFood(description: string): ReturnType<HttpClient['post']> {
    return this.http.post<AiAnalysisResult>(
      `${this.apiUrl}/api/Health/ai-analyze`,
      { description },
    );
  }
}
