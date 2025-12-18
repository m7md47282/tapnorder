import { ItemAddonGroup } from './addon.model';

/**
 * Item Model
 * Based on backend-swagger.json schema definitions
 */

export interface ItemSpecs {
  allergens?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

/**
 * Item Recipe Ingredient - References an Inventory Item
 */
export interface ItemRecipeIngredient {
  inventoryId: string; // Reference to Inventory ID
  ingredientName: string; // Name for display purposes
  quantity: number; // Quantity needed
  unit: 'kilogram' | 'gram' | 'liter' | 'milliliter' | 'piece' | 'cup'; // Unit of measurement
}

export interface Item {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string; // Legacy: category name
  categoryId?: string; // Preferred: Category ID
  imageUrl?: string;
  isAvailable: boolean;
  preparationTime?: number;
  
  // Recipe & Costing (Backend Calculated)
  recipe?: ItemRecipeIngredient[];
  calculatedCost?: number; // Read-only from backend
  availableUnits?: number; // Read-only from backend
  
  ingredients?: string[]; // Legacy: simple string array for display
  specs?: ItemSpecs;
  menuId?: string; // Optional - menu can be derived from placeId
  placeId: string; // Required - items are linked to place
  branchId?: string | null; // Optional - if provided, item is branch-specific; if null, shared across all branches
  addonGroups?: ItemAddonGroup[];
  addonGroupIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateItemCommand {
  name: string;
  description?: string;
  price?: number; // Optional if calculated from recipe
  category?: string;
  categoryId?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  preparationTime?: number;
  ingredients?: string[]; // Legacy
  
  // Recipe Payload
  recipe?: ItemRecipeIngredient[];
  
  specs?: ItemSpecs;
  addonGroups?: ItemAddonGroup[];
  addonGroupIds?: string[];
  menuId?: string; // Optional - menu can be derived from placeId
  placeId: string; // Required - items are linked to place
  branchId?: string | null; // Optional - if provided, item is branch-specific; if null/undefined, shared across all branches
}

export interface UpdateItemCommand {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  categoryId?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  preparationTime?: number;
  ingredients?: string[];
  
  // Recipe Payload
  recipe?: ItemRecipeIngredient[];
  
  specs?: ItemSpecs;
  addonGroups?: ItemAddonGroup[];
  addonGroupIds?: string[];
  placeId?: string; // Optional on update, but should be provided if changing place
  branchId?: string | null; // Optional - if provided, item is branch-specific; if null, shared across all branches
}

export interface ItemQuery {
  menuId?: string;
  placeId?: string;
  branchId?: string;
  category?: string;
  isAvailable?: boolean;
  search?: string;
}
