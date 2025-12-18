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
  menuId?: string; // Optional - menu can be derived from placeId
  placeId: string; // Required - categories are linked to place
  branchId?: string | null; // Optional - if provided, category is branch-specific; if null, shared across all branches
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
  menuId?: string; // Optional - menu can be derived from placeId
  placeId: string; // Required - categories are linked to place
  branchId?: string | null; // Optional - if provided, category is branch-specific; if null/undefined, shared across all branches
}

export interface UpdateCategoryCommand {
  id: string; // Required - ID of the category to update
  name?: string;
  description?: string;
  imageUrl?: string; // format: uri
  displayOrder?: number; // integer, minimum: 0
  isActive?: boolean;
  placeId?: string; // Optional on update, but should be provided if changing place
  branchId?: string | null; // Optional - if provided, category is branch-specific; if null, shared across all branches
}

export interface CategoryQuery {
  menuId?: string;
  placeId?: string;
  branchId?: string;
  isActive?: boolean;
  search?: string;
}

