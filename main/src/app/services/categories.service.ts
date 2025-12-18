import { Injectable } from '@angular/core';
import { Observable, map, switchMap, combineLatest, of, catchError } from 'rxjs';
import { ApiService } from './api.service';
import { ItemsService } from './items.service';
import { Category, CreateCategoryCommand, UpdateCategoryCommand, CategoryQuery } from '../models/category.model';
import { Item } from '../models/item.model';

/**
 * Categories Service
 * Manages category operations using the /categories API endpoint
 */
@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  constructor(
    private api: ApiService,
    private itemsService: ItemsService
  ) {}

  /**
   * Get all categories with optional filters
   * GET /categories?placeId={placeId}&menuId={menuId}&isActive={isActive}&search={search}
   * 
   * @param query - Query parameters (placeId is required, menuId, isActive, search are optional)
   * @returns Observable<Category[]>
   */
  getCategories(query?: CategoryQuery): Observable<Category[]> {
    const params: any = {};
    
    // placeId is required
    if (query?.placeId) {
      params.placeId = query.placeId;
    } else {
      console.warn('getCategories: placeId is recommended for filtering categories by place');
    }
    
    if (query?.menuId) {
      params.menuId = query.menuId;
    }
    
    if (query?.isActive !== undefined) {
      params.isActive = query.isActive.toString();
    }
    
    if (query?.search) {
      params.search = query.search;
    }

    return this.api.get<Category[]>('/categories', params).pipe(
      map(categories => {
        if (!query) {
          return categories;
        }

        return categories.filter(category => {
          const matchesPlace = query.placeId ? category.placeId === query.placeId : true;
          if (!query.branchId) {
            return matchesPlace;
          }

          return matchesPlace && (!category.branchId || category.branchId === query.branchId);
        });
      })
    );
  }

  /**
   * Get category by ID
   * GET /categories/{id}?placeId={placeId}
   * 
   * @param categoryId - Category ID
   * @param placeId - Place ID (required)
   * @returns Observable<Category>
   */
  getCategoryById(categoryId: string, placeId: string): Observable<Category> {
    const params: any = { placeId };
    return this.api.get<Category>(`/categories/${categoryId}`, params);
  }

  /**
   * Create new category
   * POST /categories
   * 
   * @param command - Create category command (must include placeId)
   * @returns Observable<Category>
   */
  createCategory(command: CreateCategoryCommand): Observable<Category> {
    if (!command.placeId) {
      throw new Error('placeId is required to create a category');
    }
    return this.api.post<Category>('/categories', command);
  }

  /**
   * Update category
   * PUT /categories
   * 
   * @param command - Update category command (must include id and placeId)
   * @returns Observable<Category>
   */
  updateCategory(command: UpdateCategoryCommand): Observable<Category> {
    if (!command.placeId) {
      throw new Error('placeId is required to update a category');
    }
    return this.api.put<Category>('/categories', command);
  }

  /**
   * Update category by ID (using path parameter)
   * PUT /categories/{id}
   * 
   * @param id - Category ID
   * @param command - Update category command (without id, must include placeId)
   * @returns Observable<Category>
   */
  updateCategoryById(id: string, command: Omit<UpdateCategoryCommand, 'id'>): Observable<Category> {
    if (!command.placeId) {
      throw new Error('placeId is required to update a category');
    }
    return this.api.put<Category>(`/categories/${id}`, command);
  }

  /**
   * Delete category
   * DELETE /categories/{id}
   * 
   * @param id - Category ID
   * @returns Observable<any>
   */
  deleteCategory(id: string): Observable<any> {
    return this.api.delete<any>(`/categories/${id}`);
  }

  /**
   * Get categories with item counts
   * Combines category API with items to calculate counts
   * 
   * @param menuId - Menu ID
   * @returns Observable<Category[]>
   */
  getCategoriesWithCounts(
    menuId: string,
    placeId?: string | null,
    branchId?: string | null
  ): Observable<Category[]> {
    const categoryQuery: CategoryQuery = { menuId };
    if (placeId) {
      categoryQuery.placeId = placeId;
    }
    if (branchId) {
      categoryQuery.branchId = branchId;
    }

    return combineLatest([
      this.getCategories(categoryQuery),
      this.itemsService.getItems({
        menuId,
        placeId: placeId ?? undefined,
        branchId: branchId ?? undefined
      })
    ]).pipe(
      map(([categories, items]) => {
        const categoryCountMap = new Map<string, number>();
        
        // Count items per category (by categoryId or category name)
        items.forEach(item => {
          const categoryKey = item.categoryId || item.category;
          if (!categoryKey) {
            return;
          }
          const count = categoryCountMap.get(categoryKey) || 0;
          categoryCountMap.set(categoryKey, count + 1);
        });

        // Add counts to categories
        return categories.map(cat => ({
          ...cat,
          itemCount: categoryCountMap.get(cat.id) || categoryCountMap.get(cat.name) || 0
        }));
      })
    );
  }

  /**
   * Get active categories only
   * GET /categories?menuId={menuId}&isActive=true
   * 
   * @param menuId - Menu ID
   * @returns Observable<Category[]>
   */
  getActiveCategories(menuId?: string): Observable<Category[]> {
    return this.getCategories({ menuId, isActive: true });
  }

  /**
   * Search categories by name or description
   * GET /categories?menuId={menuId}&search={searchTerm}
   * 
   * @param searchTerm - Search term
   * @param menuId - Optional Menu ID
   * @returns Observable<Category[]>
   */
  searchCategories(searchTerm: string, menuId?: string): Observable<Category[]> {
    return this.getCategories({ menuId, search: searchTerm });
  }

  /**
   * Extract unique categories from items
   * 
   * @param items - Array of items
   * @param menuId - Menu ID
   * @param placeId - Place ID (required)
   * @param includeInactive - Whether to include categories with no active items
   * @returns Category[]
   */
  extractCategoriesFromItems(
    items: Item[], 
    menuId: string,
    placeId: string,
    includeInactive: boolean = false
  ): Category[] {
    const categoryMap = new Map<string, { items: Item[] }>();
    
    // Group items by category
    items.forEach(item => {
      // Use categoryId if available, otherwise fall back to category name
      const categoryKey = item.categoryId || item.category;
      if (!categoryKey) {
        return; // Skip items without a category
      }
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, { items: [] });
      }
      categoryMap.get(categoryKey)!.items.push(item);
    });

    // Convert to Category array
    const categories: Category[] = Array.from(categoryMap.entries()).map(([categoryName, data], index) => {
      const activeItems = data.items.filter(item => item.isAvailable);
      // Get placeId from first item (all items should have same placeId)
      const itemPlaceId = data.items[0]?.placeId || placeId;
      return {
        id: this.generateCategoryId(categoryName),
        name: categoryName,
        menuId,
        placeId: itemPlaceId, // Required - categories are linked to place
        itemCount: data.items.length,
        displayOrder: index,
        isActive: activeItems.length > 0
      };
    });

    // Filter out inactive categories if requested
    if (!includeInactive) {
      return categories.filter(c => c.isActive);
    }

    return categories.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  /**
   * Generate a consistent category ID from category name
   * 
   * @param categoryName - Category name
   * @returns string - Generated ID
   */
  private generateCategoryId(categoryName: string): string {
    // Convert to lowercase and replace spaces/special chars with hyphens
    return categoryName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get category icon suggestion based on category name
   * Common category name mappings to Material icons
   * 
   * @param categoryName - Category name
   * @returns string - Material icon name
   */
  getCategoryIcon(categoryName: string): string {
    const name = categoryName.toLowerCase();
    
    const iconMap: Record<string, string> = {
      'appetizers': 'restaurant_menu',
      'starters': 'restaurant_menu',
      'mains': 'dinner_dining',
      'main dishes': 'dinner_dining',
      'entrees': 'dinner_dining',
      'desserts': 'cake',
      'dessert': 'cake',
      'sweets': 'cake',
      'sweet': 'cake',
      'beverages': 'local_drink',
      'drinks': 'local_drink',
      'beverage': 'local_drink',
      'offers': 'local_offer',
      'specials': 'local_offer',
      'promotions': 'local_offer',
      'picks-for-you': 'local_fire_department',
      'recommended': 'local_fire_department',
      'popular': 'local_fire_department',
      'salads': 'eco',
      'soups': 'soup_kitchen',
      'sides': 'lunch_dining',
      'breakfast': 'breakfast_dining',
      'lunch': 'lunch_dining',
      'dinner': 'dinner_dining',
      'snacks': 'fastfood',
      'kids': 'child_care',
      'vegetarian': 'eco',
      'vegan': 'eco',
      'gluten-free': 'allergy',
      'seafood': 'set_meal',
      'pizza': 'local_pizza',
      'burgers': 'lunch_dining',
      'sandwiches': 'lunch_dining',
      'pasta': 'dinner_dining',
      'sushi': 'set_meal',
      'coffee': 'local_cafe',
      'tea': 'local_cafe',
      'alcohol': 'wine_bar',
      'wine': 'wine_bar',
      'beer': 'sports_bar'
    };

    // Check for exact match first
    if (iconMap[name]) {
      return iconMap[name];
    }

    // Check for partial match
    for (const [key, icon] of Object.entries(iconMap)) {
      if (name.includes(key) || key.includes(name)) {
        return icon;
      }
    }

    // Default icon
    return 'restaurant';
  }

  /**
   * Validate category name
   * 
   * @param categoryName - Category name to validate
   * @returns boolean - Whether the category name is valid
   */
  isValidCategoryName(categoryName: string): boolean {
    if (!categoryName) {
      return false;
    }
    const trimmed = categoryName.trim();
    return trimmed.length > 0 && trimmed.length <= 100;
  }

  /**
   * Get default categories (for new menus)
   * Note: This method returns categories without placeId. Use with caution.
   * Consider using getDefaultCategoriesForPlace(placeId) instead.
   * 
   * @returns Category[]
   */
  getDefaultCategories(): Category[] {
    // Return empty array since placeId is required
    // Use getDefaultCategoriesForPlace(placeId) instead
    return [];
  }

  /**
   * Get default categories for a specific place
   * 
   * @param placeId - Place ID (required)
   * @returns Category[]
   */
  getDefaultCategoriesForPlace(placeId: string): Category[] {
    return [
      { id: 'appetizers', name: 'Appetizers', icon: 'restaurant_menu', displayOrder: 1, isActive: true, placeId },
      { id: 'mains', name: 'Main Dishes', icon: 'dinner_dining', displayOrder: 2, isActive: true, placeId },
      { id: 'desserts', name: 'Desserts', icon: 'cake', displayOrder: 3, isActive: true, placeId },
      { id: 'beverages', name: 'Beverages', icon: 'local_drink', displayOrder: 4, isActive: true, placeId }
    ];
  }
}

