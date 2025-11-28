/**
 * Shared addon-related models used across menu items, carts, and orders.
 */

export type AddonSelectionType = 'single' | 'multiple' | 'quantity';

export interface AddonOption {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable?: boolean;
  imageUrl?: string;
  maxQuantity?: number;
  defaultQuantity?: number;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}

export interface AddonGroup {
  id: string;
  name: string;
  description?: string;
  selectionType: AddonSelectionType;
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
  isActive?: boolean;
  menuId?: string;
  placeId?: string;
  appliesToCategoryIds?: string[];
  appliesToItemIds?: string[];
  options: AddonOption[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Item-level view of an addon group. It allows partial overrides of the base group
 * (for example, item-specific pricing or enforcing different limits).
 */
export interface ItemAddonGroup extends Omit<AddonGroup, 'id'> {
  groupId?: string;
  overrides?: {
    minSelect?: number;
    maxSelect?: number;
    isRequired?: boolean;
  };
}

export interface AddonGroupQuery {
  placeId?: string;
  menuId?: string;
  categoryId?: string;
  itemId?: string;
  isActive?: boolean;
  search?: string;
}

export type CreateAddonGroupCommand = Omit<AddonGroup, 'id' | 'createdAt' | 'updatedAt'>;

export interface UpdateAddonGroupCommand extends CreateAddonGroupCommand {
  id: string;
}

