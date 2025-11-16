import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { Recipe, RecipeIngredient } from '../../../models/product.model';

@Component({
  selector: 'app-cookbook',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './cookbook.component.html',
  styleUrls: ['./cookbook.component.scss']
})
export class CookbookComponent implements OnInit {
  recipes: Recipe[] = [];
  filteredRecipes: Recipe[] = [];
  selectedRecipe: Recipe | null = null;
  
  searchControl = new FormControl('');
  categoryFilter = new FormControl('all');
  stationFilter = new FormControl('all');
  
  categories: string[] = ['all', 'Appetizers', 'Main Courses', 'Desserts', 'Beverages', 'Salads', 'Soups'];
  stations: string[] = ['all', 'Grill', 'Salad', 'Pizza', 'Dessert', 'Beverages'];
  
  isLoading: boolean = false;
  viewMode: 'grid' | 'list' = 'grid';

  // Mock recipes data
  private mockRecipes: Recipe[] = [
    {
      id: 'r1',
      productId: '1',
      name: 'Grilled Chicken',
      instructions: [
        'Preheat grill to 375°F',
        'Season chicken breast with salt, pepper, and olive oil',
        'Grill for 6 minutes on each side',
        'Check internal temperature reaches 165°F',
        'Let rest for 3 minutes before serving'
      ],
      cookingTime: 12,
      prepTime: 5,
      temperature: '375°F',
      ingredients: [
        { name: 'Chicken Breast', quantity: '8', unit: 'oz' },
        { name: 'Olive Oil', quantity: '2', unit: 'tbsp' },
        { name: 'Salt', quantity: '1', unit: 'tsp' },
        { name: 'Black Pepper', quantity: '0.5', unit: 'tsp' }
      ],
      notes: 'Ensure chicken reaches safe internal temperature. Can be marinated for 2-4 hours for better flavor.'
    },
    {
      id: 'r2',
      productId: '2',
      name: 'Caesar Salad',
      instructions: [
        'Wash and dry romaine lettuce',
        'Tear into bite-sized pieces',
        'Prepare Caesar dressing',
        'Toss lettuce with dressing',
        'Add croutons and parmesan cheese',
        'Serve immediately'
      ],
      cookingTime: 0,
      prepTime: 5,
      ingredients: [
        { name: 'Romaine Lettuce', quantity: '1', unit: 'head' },
        { name: 'Caesar Dressing', quantity: '3', unit: 'tbsp' },
        { name: 'Croutons', quantity: '0.5', unit: 'cup' },
        { name: 'Parmesan Cheese', quantity: '2', unit: 'tbsp' }
      ],
      notes: 'Keep lettuce crisp. Add dressing just before serving to prevent wilting.'
    },
    {
      id: 'r3',
      productId: '3',
      name: 'Margherita Pizza',
      instructions: [
        'Preheat oven to 450°F',
        'Roll out pizza dough to 12-inch circle',
        'Spread tomato sauce evenly',
        'Add fresh mozzarella slices',
        'Add fresh basil leaves',
        'Bake for 8-10 minutes until crust is golden',
        'Remove and let cool for 2 minutes'
      ],
      cookingTime: 8,
      prepTime: 5,
      temperature: '450°F',
      ingredients: [
        { name: 'Pizza Dough', quantity: '1', unit: 'ball (12oz)' },
        { name: 'Tomato Sauce', quantity: '4', unit: 'oz' },
        { name: 'Fresh Mozzarella', quantity: '6', unit: 'oz' },
        { name: 'Fresh Basil', quantity: '10', unit: 'leaves' },
        { name: 'Olive Oil', quantity: '1', unit: 'tbsp' }
      ],
      notes: 'Use fresh mozzarella for best results. Add basil after baking to preserve flavor.'
    },
    {
      id: 'r4',
      productId: '4',
      name: 'Chocolate Cake',
      instructions: [
        'Preheat oven to 350°F',
        'Grease and flour cake pan',
        'Mix dry ingredients in large bowl',
        'Mix wet ingredients separately',
        'Combine wet and dry ingredients',
        'Pour into pan and bake for 25-30 minutes',
        'Check with toothpick - should come out clean',
        'Cool completely before frosting'
      ],
      cookingTime: 25,
      prepTime: 15,
      temperature: '350°F',
      ingredients: [
        { name: 'All-Purpose Flour', quantity: '2', unit: 'cups' },
        { name: 'Sugar', quantity: '1.5', unit: 'cups' },
        { name: 'Cocoa Powder', quantity: '0.75', unit: 'cup' },
        { name: 'Eggs', quantity: '2', unit: 'large' },
        { name: 'Butter', quantity: '0.5', unit: 'cup' },
        { name: 'Milk', quantity: '1', unit: 'cup' },
        { name: 'Vanilla Extract', quantity: '1', unit: 'tsp' }
      ],
      notes: 'Do not overmix batter. Cake is done when toothpick comes out clean.'
    },
    {
      id: 'r5',
      productId: '5',
      name: 'Espresso',
      instructions: [
        'Grind coffee beans to fine consistency',
        'Measure 18-20g of coffee',
        'Preheat espresso machine',
        'Tamp coffee grounds evenly',
        'Extract for 25-30 seconds',
        'Should yield 1-2 oz of espresso',
        'Serve immediately'
      ],
      cookingTime: 0,
      prepTime: 2,
      temperature: '195-205°F',
      ingredients: [
        { name: 'Espresso Beans', quantity: '18', unit: 'g' },
        { name: 'Water', quantity: '2', unit: 'oz' }
      ],
      notes: 'Water temperature is critical. Extraction time affects flavor strength.'
    },
    {
      id: 'r6',
      productId: '6',
      name: 'Cappuccino',
      instructions: [
        'Prepare single shot of espresso',
        'Steam milk to 150-160°F',
        'Create microfoam by aerating milk',
        'Pour steamed milk over espresso',
        'Create latte art if desired',
        'Serve immediately'
      ],
      cookingTime: 0,
      prepTime: 3,
      temperature: '150-160°F',
      ingredients: [
        { name: 'Espresso', quantity: '1', unit: 'shot' },
        { name: 'Whole Milk', quantity: '6', unit: 'oz' }
      ],
      notes: 'Milk should be steamed, not boiled. Ratio is 1:3 espresso to milk.'
    }
  ];

  constructor(
    private api: ApiService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadRecipes();
    this.setupFilters();
  }

  loadRecipes(): void {
    this.isLoading = true;

    // Mock API call
    setTimeout(() => {
      this.recipes = this.mockRecipes;
      this.applyFilters();
      this.isLoading = false;
    }, 500);

    // Real API call (uncomment when backend is ready)
    // this.api.get<Recipe[]>('/kitchen/recipes').subscribe({
    //   next: (recipes) => {
    //     this.recipes = recipes;
    //     this.applyFilters();
    //     this.isLoading = false;
    //   },
    //   error: (error) => {
    //     this.notification.error('Failed to load recipes');
    //     this.isLoading = false;
    //   }
    // });
  }

  setupFilters(): void {
    this.searchControl.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.categoryFilter.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.stationFilter.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  applyFilters(): void {
    const search = (this.searchControl.value || '').toLowerCase();
    const category = this.categoryFilter.value || 'all';
    const station = this.stationFilter.value || 'all';

    this.filteredRecipes = this.recipes.filter(recipe => {
      const matchesSearch = !search || 
        recipe.name.toLowerCase().includes(search) ||
        recipe.instructions.some(inst => inst.toLowerCase().includes(search)) ||
        recipe.ingredients.some(ing => ing.name.toLowerCase().includes(search));
      
      // Note: In real implementation, recipes would have category and station properties
      return matchesSearch;
    });

    // Sort alphabetically
    this.filteredRecipes.sort((a, b) => a.name.localeCompare(b.name));
  }

  selectRecipe(recipe: Recipe): void {
    this.selectedRecipe = recipe;
  }

  closeRecipeDetail(): void {
    this.selectedRecipe = null;
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  printRecipe(recipe: Recipe): void {
    this.notification.info(`Printing recipe: ${recipe.name}`);
    // Implement print functionality
    window.print();
  }
}

