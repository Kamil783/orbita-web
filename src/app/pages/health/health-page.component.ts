import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { HealthService, AiAnalysisResult } from '../../features/health/data/health.service';
import {
  FoodEntry,
  MealCategory,
  NutritionGoal,
  MEAL_ICON_OPTIONS,
} from '../../features/health/models/health.models';

@Component({
  selector: 'app-health-page',
  standalone: true,
  imports: [CommonModule, AppShellComponent, TopbarComponent, FormsModule],
  templateUrl: './health-page.component.html',
  styleUrl: './health-page.component.scss',
})
export class HealthPageComponent implements OnInit {
  private readonly healthService = inject(HealthService);

  readonly title = 'Здоровье';
  readonly mealIconOptions = MEAL_ICON_OPTIONS;

  // ─── State ───

  readonly goal = this.healthService.goal;
  readonly mealCategories = this.healthService.mealCategories;
  readonly foodEntries = this.healthService.foodEntries;

  // ─── Current date ───

  readonly currentDate = signal(new Date());

  readonly formattedDate = computed(() => {
    const d = this.currentDate();
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    const dateStr = `${d.getDate()} ${months[d.getMonth()]}`;
    return isToday ? `Сегодня, ${dateStr}` : dateStr;
  });

  // ─── Computed nutrition totals ───

  readonly totals = computed(() => {
    const entries = this.foodEntries();
    return {
      calories: entries.reduce((s, e) => s + e.calories, 0),
      protein: entries.reduce((s, e) => s + e.protein, 0),
      carbs: entries.reduce((s, e) => s + e.carbs, 0),
      fat: entries.reduce((s, e) => s + e.fat, 0),
      fiber: entries.reduce((s, e) => s + e.fiber, 0),
    };
  });

  readonly caloriesLeft = computed(() => Math.max(0, this.goal().calories - this.totals().calories));

  readonly sortedMealCategories = computed(() => {
    return [...this.mealCategories()].sort((a, b) => a.order - b.order);
  });

  // ─── Grouped entries by meal category ───

  readonly mealGroups = computed(() => {
    const cats = this.sortedMealCategories();
    const entries = this.foodEntries();
    return cats.map(cat => ({
      ...cat,
      entries: entries.filter(e => e.mealCategoryId === cat.id),
      totalCalories: entries
        .filter(e => e.mealCategoryId === cat.id)
        .reduce((s, e) => s + e.calories, 0),
    }));
  });

  // ─── Ring calculations ───

  calorieRingOffset(): number {
    const g = this.goal().calories;
    if (g <= 0) return 364.42;
    const pct = Math.min(1, this.totals().calories / g);
    return 364.42 * (1 - pct);
  }

  macroRingOffset(current: number, goalVal: number): number {
    if (goalVal <= 0) return 263.89;
    const pct = Math.min(1, current / goalVal);
    return 263.89 * (1 - pct);
  }

  // ─── Dialogs ───

  readonly showFoodDialog = signal(false);
  readonly showGoalDialog = signal(false);
  readonly showCategoryDialog = signal(false);
  readonly showAiDialog = signal(false);
  readonly showDeleteCategoryConfirm = signal(false);
  readonly deleteCategoryTarget = signal<MealCategory | null>(null);

  // Food form
  foodName = '';
  foodPortion = '';
  foodCalories = '';
  foodProtein = '';
  foodCarbs = '';
  foodFat = '';
  foodFiber = '';
  foodMealCategoryId = '';

  // Goal form
  goalCalories = '';
  goalProtein = '';
  goalCarbs = '';
  goalFat = '';
  goalFiber = '';

  // Category form
  newCategoryName = '';
  newCategoryIcon = 'restaurant';

  // AI form
  aiDescription = '';
  readonly aiLoading = signal(false);
  readonly aiResult = signal<AiAnalysisResult | null>(null);
  readonly aiError = signal('');

  // ─── Lifecycle ───

  ngOnInit(): void {
    this.healthService.loadGoal();
    this.healthService.loadMealCategories();
    this.loadEntriesForDate();
  }

  // ─── Date navigation ───

  prevDay(): void {
    const d = new Date(this.currentDate());
    d.setDate(d.getDate() - 1);
    this.currentDate.set(d);
    this.loadEntriesForDate();
  }

  nextDay(): void {
    const d = new Date(this.currentDate());
    d.setDate(d.getDate() + 1);
    this.currentDate.set(d);
    this.loadEntriesForDate();
  }

  private loadEntriesForDate(): void {
    const d = this.currentDate();
    const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    this.healthService.loadFoodEntries(dateStr);
  }

  // ─── Food dialog ───

  openFoodDialog(mealCategoryId?: string): void {
    this.foodName = '';
    this.foodPortion = '';
    this.foodCalories = '';
    this.foodProtein = '';
    this.foodCarbs = '';
    this.foodFat = '';
    this.foodFiber = '';
    this.foodMealCategoryId = mealCategoryId || this.sortedMealCategories()[0]?.id || '';
    this.showFoodDialog.set(true);
  }

  saveFood(): void {
    const name = this.foodName.trim();
    if (!name || !this.foodMealCategoryId) return;

    const parse = (v: string) => {
      const n = parseFloat(v.replace(',', '.'));
      return isNaN(n) ? 0 : Math.round(n * 10) / 10;
    };

    this.healthService.createFoodEntry({
      mealCategoryId: this.foodMealCategoryId,
      name,
      portion: this.foodPortion.trim(),
      calories: parse(this.foodCalories),
      protein: parse(this.foodProtein),
      carbs: parse(this.foodCarbs),
      fat: parse(this.foodFat),
      fiber: parse(this.foodFiber),
      timestamp: this.currentDate().getTime(),
    });
    this.showFoodDialog.set(false);
  }

  deleteFood(id: string): void {
    this.healthService.deleteFoodEntry(id);
  }

  // ─── Goal dialog ───

  openGoalDialog(): void {
    const g = this.goal();
    this.goalCalories = g.calories.toString();
    this.goalProtein = g.protein.toString();
    this.goalCarbs = g.carbs.toString();
    this.goalFat = g.fat.toString();
    this.goalFiber = g.fiber.toString();
    this.showGoalDialog.set(true);
  }

  saveGoal(): void {
    const parse = (v: string) => {
      const n = parseFloat(v.replace(',', '.'));
      return isNaN(n) || n <= 0 ? 0 : Math.round(n);
    };

    this.healthService.updateGoal({
      calories: parse(this.goalCalories),
      protein: parse(this.goalProtein),
      carbs: parse(this.goalCarbs),
      fat: parse(this.goalFat),
      fiber: parse(this.goalFiber),
    });
    this.showGoalDialog.set(false);
  }

  // ─── Category management ───

  openCategoryDialog(): void {
    this.newCategoryName = '';
    this.newCategoryIcon = 'restaurant';
    this.showCategoryDialog.set(true);
  }

  saveCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;

    this.healthService.createMealCategory({
      name,
      icon: this.newCategoryIcon,
      order: this.mealCategories().length,
    });
    this.showCategoryDialog.set(false);
  }

  confirmDeleteCategory(cat: MealCategory): void {
    this.deleteCategoryTarget.set(cat);
    this.showDeleteCategoryConfirm.set(true);
  }

  deleteCategory(): void {
    const cat = this.deleteCategoryTarget();
    if (cat) {
      this.healthService.deleteMealCategory(cat.id);
    }
    this.showDeleteCategoryConfirm.set(false);
    this.deleteCategoryTarget.set(null);
  }

  // ─── AI dialog ───

  openAiDialog(): void {
    this.aiDescription = '';
    this.aiResult.set(null);
    this.aiError.set('');
    this.aiLoading.set(false);
    this.showAiDialog.set(true);
  }

  analyzeWithAi(): void {
    const desc = this.aiDescription.trim();
    if (!desc) return;

    this.aiLoading.set(true);
    this.aiError.set('');
    this.aiResult.set(null);

    this.healthService.analyzeFood(desc).subscribe({
      next: (result: unknown) => {
        this.aiResult.set(result as AiAnalysisResult);
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiError.set('Не удалось проанализировать. Попробуйте снова.');
        this.aiLoading.set(false);
      },
    });
  }

  addAiFood(food: AiAnalysisResult['foods'][0], mealCategoryId: string): void {
    this.healthService.createFoodEntry({
      mealCategoryId,
      name: food.name,
      portion: food.portion,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      timestamp: this.currentDate().getTime(),
    });
  }

  // ─── Dialog backdrop ───

  onBackdropClick(dialog: 'food' | 'goal' | 'category' | 'ai' | 'deleteCategory'): void {
    switch (dialog) {
      case 'food': this.showFoodDialog.set(false); break;
      case 'goal': this.showGoalDialog.set(false); break;
      case 'category': this.showCategoryDialog.set(false); break;
      case 'ai': this.showAiDialog.set(false); break;
      case 'deleteCategory': this.showDeleteCategoryConfirm.set(false); break;
    }
  }

  stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }
}
