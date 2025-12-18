import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Item, CreateItemCommand, UpdateItemCommand, ItemQuery } from '../models/item.model';

/**
 * Items Service
 * Manages menu item operations based on backend-swagger.json API specification
 */
@Injectable({
  providedIn: 'root'
})
export class ItemsService {
  constructor(private api: ApiService) {}

  /**
   * Get items with optional filters
   * GET /items?menuId={menuId} OR GET /items?category={category} OR GET /items
   * 
   * @param query - Query parameters (all optional - can fetch all items)
   * @returns Observable<Item[]>
   */
  getItems(query: ItemQuery): Observable<Item[]> {
    const params: any = {};
    
    if (query.menuId) {
      params.menuId = query.menuId;
    }

    if (query.placeId) {
      params.placeId = query.placeId;
    }

    if (query.branchId) {
      params.branchId = query.branchId;
    }
    
    if (query.category) {
      params.category = query.category;
    }
    
    if (query.isAvailable !== undefined) {
      params.isAvailable = query.isAvailable.toString();
    }
    
    if (query.search) {
      params.search = query.search;
    }

    console.log('params', params);
    return this.api.get<Item[]>('/items', params);
  }

  /**
   * Get item by ID
   * GET /itemDetail?id={id}
   * 
   * @param id - Item ID
   * @returns Observable<Item>
   */
  getItemById(id: string): Observable<Item> {
    return this.api.get<Item>('/itemDetail', { id });
  }

  /**
   * Create new item
   * POST /items
   * 
   * @param command - Create item command
   * @returns Observable<Item>
   */
  createItem(command: CreateItemCommand): Observable<Item> {
    return this.api.post<Item>('/items', command);
  }

  /**
   * Update item
   * PUT /items
   * 
   * @param command - Update item command (must include id)
   * @returns Observable<Item>
   */
  updateItem(command: UpdateItemCommand): Observable<Item> {
    return this.api.put<Item>('/items', command);
  }

  /**
   * Update item by ID (using itemDetail endpoint)
   * PUT /itemDetail?id={id}
   * 
   * @param id - Item ID
   * @param command - Update item command (id will be taken from query parameter)
   * @returns Observable<Item>
   */
  updateItemById(id: string, command: Omit<UpdateItemCommand, 'id'>): Observable<Item> {
    const updateCommand: UpdateItemCommand = {
      ...command,
      id
    };
    // Append query parameter to endpoint URL
    return this.api.put<Item>(`/itemDetail?id=${id}`, updateCommand);
  }

  /**
   * Delete item
   * DELETE /items?id={id}
   * 
   * @param id - Item ID
   * @returns Observable<any>
   */
  deleteItem(id: string): Observable<any> {
    // Append query parameter to endpoint URL
    return this.api.delete<any>(`/items?id=${id}`);
  }

  /**
   * Delete item by ID (using itemDetail endpoint)
   * DELETE /itemDetail?id={id}
   * 
   * @param id - Item ID
   * @returns Observable<any>
   */
  deleteItemById(id: string): Observable<any> {
    // Append query parameter to endpoint URL
    return this.api.delete<any>(`/itemDetail?id=${id}`);
  }

  /**
   * Get items by menu ID
   * Convenience method for GET /items?menuId={menuId}
   * 
   * @param menuId - Menu ID
   * @returns Observable<Item[]>
   */
  getItemsByMenuId(
    menuId: string,
    extras?: Pick<ItemQuery, 'placeId' | 'branchId' | 'isAvailable'>
  ): Observable<Item[]> {
    return this.getItems({
      menuId,
      placeId: extras?.placeId,
      branchId: extras?.branchId,
      isAvailable: extras?.isAvailable
    });
  }

  /**
   * Get items by category
   * Convenience method for GET /items?category={category}
   * 
   * @param category - Category name
   * @returns Observable<Item[]>
   */
  getItemsByCategory(category: string): Observable<Item[]> {
    return this.getItems({ category });
  }

  /**
   * Search items by name or description
   * GET /items?menuId={menuId}&search={search} OR GET /items?search={search}
   * 
   * @param searchTerm - Search term
   * @param menuId - Optional Menu ID
   * @returns Observable<Item[]>
   */
  searchItems(searchTerm: string, menuId?: string): Observable<Item[]> {
    return this.getItems({ menuId, search: searchTerm });
  }

  /**
   * Get available items only
   * GET /items?menuId={menuId}&isAvailable=true OR GET /items?isAvailable=true
   * 
   * @param menuId - Optional Menu ID
   * @returns Observable<Item[]>
   */
  getAvailableItems(menuId?: string): Observable<Item[]> {
    return this.getItems({ menuId, isAvailable: true });
  }
}

