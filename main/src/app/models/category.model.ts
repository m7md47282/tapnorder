/**
 * Category Model
 * Represents menu item categories
 */

export interface Category {
  id: string; // Required
  name: string; // Required
  description?: string;
  imageUrl?: string; // format: uri
  displayOrder?: number; // integer, minimum: 0
  isActive?: boolean; // Required
  menuId?: string; // Required - Reference to the menu this category belongs to
  itemCount?: number; // Client-side only - Number of items in this category (not from API)
  icon?: string; // Client-side only - Material icon name (not from API)
  createdAt?: string; // Required - format: date-time
  updatedAt?: string; // Required - format: date-time
}

export interface CreateCategoryCommand {
  name: string; // Required
  description?: string;
  imageUrl?: string; // format: uri
  displayOrder?: number; // integer, minimum: 0
  isActive?: boolean; // Default: true
  menuId?: string; // Optional - ID of the menu this category belongs to
}

export interface UpdateCategoryCommand {
  id: string; // Required - ID of the category to update
  name?: string;
  description?: string;
  imageUrl?: string; // format: uri
  displayOrder?: number; // integer, minimum: 0
  isActive?: boolean;
}

export interface CategoryQuery {
  menuId?: string;
  isActive?: boolean;
  search?: string;
}

