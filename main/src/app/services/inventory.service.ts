import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { 
  Inventory, 
  CreateInventoryCommand, 
  UpdateInventoryCommand, 
  InventoryAdjustment, 
  InventoryQuery 
} from '../models/inventory.model';

/**
 * Inventory Service
 * Manages inventory operations based on backend-swagger.json API specification
 * Maps to Firebase Functions: inventoryProductsList, inventoryProductsCreate, etc.
 */
@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  constructor(private api: ApiService) {}

  /**
   * Get inventory items with optional filters
   * GET /inventory
   */
  getInventory(query: InventoryQuery): Observable<Inventory[]> {
    // Convert boolean to string for query params if needed by ApiService, 
    // though ApiService usually handles primitives.
    return this.api.get<Inventory[]>('/inventory', query as any);
  }

  /**
   * Create new inventory item
   * POST /inventory
   */
  createInventoryItem(command: CreateInventoryCommand): Observable<Inventory> {
    return this.api.post<Inventory>('/inventory', command);
  }

  /**
   * Update inventory item
   * PUT /inventory
   */
  updateInventoryItem(command: UpdateInventoryCommand): Observable<Inventory> {
    return this.api.put<Inventory>('/inventory', command);
  }

  /**
   * Delete inventory item
   * DELETE /inventory?id={id}
   */
  deleteInventoryItem(id: string): Observable<any> {
    return this.api.delete<any>(`/inventory?id=${id}`);
  }

  /**
   * Adjust inventory stock (add/reduce)
   * POST /inventory/adjust
   */
  adjustInventory(command: InventoryAdjustment): Observable<Inventory> {
    return this.api.post<Inventory>('/inventory/adjust', command);
  }
}

