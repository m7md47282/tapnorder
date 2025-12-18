/**
 * Inventory Model
 * Matches backend-swagger.json schemas
 */

export interface Inventory {
  id: string;
  placeId: string;
  branchId?: string;
  ingredientName: string;
  unit: 'kilogram' | 'gram' | 'liter' | 'milliliter' | 'piece' | 'cup';
  currentQuantity: number;
  costPerUnit: number;
  minStockLevel?: number;
  supplier?: string;
  lastRestocked?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateInventoryCommand {
  placeId: string;
  branchId?: string;
  ingredientName: string;
  unit: 'kilogram' | 'gram' | 'liter' | 'milliliter' | 'piece' | 'cup';
  currentQuantity: number;
  costPerUnit: number;
  minStockLevel?: number;
  supplier?: string;
  notes?: string;
}

export interface UpdateInventoryCommand {
  id: string;
  ingredientName?: string;
  unit?: 'kilogram' | 'gram' | 'liter' | 'milliliter' | 'piece' | 'cup';
  currentQuantity?: number;
  costPerUnit?: number;
  minStockLevel?: number;
  supplier?: string;
  lastRestocked?: string;
  notes?: string;
}

export interface InventoryAdjustment {
  inventoryId: string;
  quantity: number; // Positive for adding, negative for reducing
  reason: 'restock' | 'adjustment' | 'waste' | 'damage' | 'other';
  notes?: string;
  adjustedBy?: string;
}

export interface InventoryQuery {
  placeId?: string;
  branchId?: string;
  ingredientName?: string;
  unit?: string;
  lowStock?: boolean;
  search?: string;
}

