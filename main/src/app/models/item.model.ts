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
 * Item Ingredient - References a Product (from inventory) used in this Item
 */
export interface ItemIngredient {
  productId: string; // ID of the Product (inventory item) used as ingredient
  productName?: string; // Name for display purposes
  quantity: number; // Quantity needed
  unit: 'ml' | 'g' | 'kg' | 'l' | 'piece' | 'cup' | 'tbsp' | 'tsp' | 'oz' | 'lb'; // Unit of measurement
}

export interface Item {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string; // Legacy: category name (deprecated, use categoryId instead)
  categoryId?: string; // Preferred: Category ID from the categories entity
  imageUrl?: string;
  isAvailable: boolean;
  preparationTime?: number;
  ingredients?: string[]; // Legacy: simple string array for display
  recipe?: ItemIngredient[]; // New: structured recipe with Product references, quantities, and units
  specs?: ItemSpecs;
  menuId: string;
  addonGroups?: ItemAddonGroup[];
  addonGroupIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateItemCommand {
  name: string;
  description?: string;
  price: number;
  category?: string; // Legacy: category name (deprecated, use categoryId instead)
  categoryId?: string; // Preferred: Category ID from the categories entity
  imageUrl?: string;
  isAvailable?: boolean;
  preparationTime?: number;
  ingredients?: string[]; // Legacy: simple string array
  recipe?: ItemIngredient[]; // New: structured recipe with Product references
  specs?: ItemSpecs;
  addonGroups?: ItemAddonGroup[];
  addonGroupIds?: string[];
  menuId?: string; // Optional - backend may require it depending on implementation
}

export interface UpdateItemCommand {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  category?: string; // Legacy: category name (deprecated, use categoryId instead)
  categoryId?: string; // Preferred: Category ID from the categories entity
  imageUrl?: string;
  isAvailable?: boolean;
  preparationTime?: number;
  ingredients?: string[]; // Legacy: simple string array
  recipe?: ItemIngredient[]; // New: structured recipe with Product references
  specs?: ItemSpecs;
  addonGroups?: ItemAddonGroup[];
  addonGroupIds?: string[];
}

export interface ItemQuery {
  menuId?: string;
  category?: string;
  isAvailable?: boolean;
  search?: string;
}

