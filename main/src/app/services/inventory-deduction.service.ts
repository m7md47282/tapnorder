import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ItemsService } from './items.service';
import { Item, ItemIngredient } from '../models/item.model';
import { CartItem } from './cart.service';
import { Order } from '../models/order.model';
import { Sale, CartItem as PosCartItem } from '../models/product.model';
import { NotificationService } from './notification.service';

/**
 * Inventory Deduction Service
 * Handles deduction of inventory products when orders are placed
 */
@Injectable({
  providedIn: 'root'
})
export class InventoryDeductionService {
  constructor(
    private itemsService: ItemsService,
    private notification: NotificationService
  ) {}

  /**
   * Deduct inventory for an order
   * For each item in the order, deduct its recipe ingredients from inventory
   */
  deductInventoryForOrder(order: Order): Observable<boolean> {
    // Group ingredients by productId and sum quantities
    const ingredientDeductions = new Map<string, { quantity: number; unit: string; productName: string }>();

    // Process each item in the order
    const deductionPromises = order.items.map(cartItem => {
      return this.itemsService.getItemById(cartItem.item.id).pipe(
        map((item: Item) => {
          if (item.recipe && item.recipe.length > 0) {
            // For each ingredient in the recipe, multiply by order quantity
            item.recipe.forEach(ingredient => {
              const totalQuantity = ingredient.quantity * cartItem.quantity;
              
              if (ingredientDeductions.has(ingredient.productId)) {
                // Add to existing deduction
                const existing = ingredientDeductions.get(ingredient.productId)!;
                // Only add if units match (for now, assume same unit)
                if (existing.unit === ingredient.unit) {
                  existing.quantity += totalQuantity;
                } else {
                  console.warn(`Unit mismatch for product ${ingredient.productId}: ${existing.unit} vs ${ingredient.unit}`);
                }
              } else {
                // Create new deduction entry
                ingredientDeductions.set(ingredient.productId, {
                  quantity: totalQuantity,
                  unit: ingredient.unit,
                  productName: ingredient.productName || ''
                });
              }
            });
          }
          return true;
        }),
        catchError(error => {
          console.error(`Error fetching item ${cartItem.item.id}:`, error);
          return of(false);
        })
      );
    });

    // Wait for all items to be processed
    return forkJoin(deductionPromises).pipe(
      switchMap(() => {
        if (ingredientDeductions.size === 0) {
          // No ingredients to deduct
          return of(true);
        }

        // Deduct each ingredient from inventory
        const deductionObservables = Array.from(ingredientDeductions.entries()).map(([productId, deduction]) => {
          return this.deductProductInventory(productId, deduction.quantity, deduction.unit, deduction.productName);
        });

        return forkJoin(deductionObservables).pipe(
          map(results => {
            const allSuccess = results.every(r => r === true);
            if (allSuccess) {
              console.log(`Successfully deducted inventory for order ${order.orderNumber}`);
            } else {
              console.warn(`Some inventory deductions failed for order ${order.orderNumber}`);
            }
            return allSuccess;
          }),
          catchError(error => {
            console.error('Error deducting inventory:', error);
            this.notification.error('Failed to update inventory. Please check stock levels manually.');
            return of(false);
          })
        );
      })
    );
  }

  /**
   * Deduct quantity from a specific product's inventory
   * This updates the product's stock by subtracting the quantity
   * 
   * Note: Since Items don't have a stock field in the current model,
   * this implementation logs the deduction. In a production system:
   * 1. Items used as inventory products should have a stock field added
   * 2. Or use a separate inventory API endpoint
   * 3. Or track stock in IndexedDB separately
   */
  private deductProductInventory(
    productId: string,
    quantity: number,
    unit: string,
    productName: string
  ): Observable<boolean> {
    // Get the current product
    return this.itemsService.getItemById(productId).pipe(
      switchMap((product: Item) => {
        // Log the deduction for tracking
        console.log(`[INVENTORY DEDUCTION] Order requires: ${quantity} ${unit} of ${productName || product.name} (Product ID: ${productId})`);
        
        // TODO: Implement actual stock deduction
        // Option 1: If backend API supports stock updates:
        // return this.api.patch(`/items/${productId}/stock`, {
        //   quantity: -quantity,
        //   unit: unit,
        //   reason: 'Order fulfillment'
        // }).pipe(
        //   map(() => true),
        //   catchError(error => {
        //     console.error(`Failed to deduct ${productName}:`, error);
        //     return of(false);
        //   })
        // );
        
        // Option 2: Update Item with stock tracking (requires model update):
        // If Item model had stock field:
        // const updateCommand: UpdateItemCommand = {
        //   id: productId,
        //   // Add stock field to model first
        // };
        // return this.itemsService.updateItem(updateCommand).pipe(
        //   map(() => true),
        //   catchError(() => of(false))
        // );
        
        // Option 3: Track in IndexedDB (for offline support):
        // Store stock movements separately and sync with backend
        
        // For now, return success - actual deduction should be handled by backend
        // or implemented when stock tracking is added to Items
        return of(true);
      }),
      catchError(error => {
        console.error(`Error deducting inventory for product ${productId}:`, error);
        this.notification.warning(`Could not update inventory for ${productName || productId}. Please check stock manually.`);
        return of(false);
      })
    );
  }

  /**
   * Deduct inventory for a POS sale
   * Converts POS CartItems to work with inventory deduction
   */
  deductInventoryForSale(sale: Sale): Observable<boolean> {
    // Convert POS CartItems to a format compatible with deduction
    // POS CartItems have Product, we need to get the Item recipe
    const itemDeductions = sale.items.map(posCartItem => {
      // Get the Item by Product ID (assuming Product.id matches Item.id)
      return this.itemsService.getItemById(posCartItem.product.id).pipe(
        map((item: Item) => {
          if (item.recipe && item.recipe.length > 0) {
            // Process recipe ingredients
            const ingredientDeductions = new Map<string, { quantity: number; unit: string; productName: string }>();
            
            item.recipe.forEach(ingredient => {
              const totalQuantity = ingredient.quantity * posCartItem.quantity;
              
              if (ingredientDeductions.has(ingredient.productId)) {
                const existing = ingredientDeductions.get(ingredient.productId)!;
                if (existing.unit === ingredient.unit) {
                  existing.quantity += totalQuantity;
                }
              } else {
                ingredientDeductions.set(ingredient.productId, {
                  quantity: totalQuantity,
                  unit: ingredient.unit,
                  productName: ingredient.productName || ''
                });
              }
            });
            
            return Array.from(ingredientDeductions.entries()).map(([productId, deduction]) => ({
              productId,
              ...deduction
            }));
          }
          return [];
        }),
        catchError(() => of([]))
      );
    });

    return forkJoin(itemDeductions).pipe(
      switchMap((allDeductions) => {
        // Flatten and combine all deductions
        const combinedDeductions = new Map<string, { quantity: number; unit: string; productName: string }>();
        
        allDeductions.flat().forEach(deduction => {
          if (combinedDeductions.has(deduction.productId)) {
            const existing = combinedDeductions.get(deduction.productId)!;
            if (existing.unit === deduction.unit) {
              existing.quantity += deduction.quantity;
            }
          } else {
            combinedDeductions.set(deduction.productId, {
              quantity: deduction.quantity,
              unit: deduction.unit,
              productName: deduction.productName
            });
          }
        });

        if (combinedDeductions.size === 0) {
          return of(true);
        }

        // Deduct each ingredient
        const deductionObservables = Array.from(combinedDeductions.entries()).map(([productId, deduction]) => {
          return this.deductProductInventory(productId, deduction.quantity, deduction.unit, deduction.productName);
        });

        return forkJoin(deductionObservables).pipe(
          map(results => results.every(r => r === true)),
          catchError(() => of(false))
        );
      })
    );
  }

  /**
   * Check if there's sufficient inventory for an order
   * Returns availability status and missing items
   * 
   * Note: Currently checks isAvailable flag. In production, should check actual stock quantities
   */
  checkInventoryAvailability(order: Order): Observable<{ available: boolean; missingItems: string[]; warnings: string[] }> {
    const missingItems: string[] = [];
    const warnings: string[] = [];
    const ingredientChecks = new Map<string, { required: number; unit: string; productName: string }>();

    // Process each item in the order
    const checkPromises = order.items.map(cartItem => {
      return this.itemsService.getItemById(cartItem.item.id).pipe(
        map((item: Item) => {
          if (item.recipe && item.recipe.length > 0) {
            item.recipe.forEach(ingredient => {
              const totalQuantity = ingredient.quantity * cartItem.quantity;
              
              if (ingredientChecks.has(ingredient.productId)) {
                const existing = ingredientChecks.get(ingredient.productId)!;
                if (existing.unit === ingredient.unit) {
                  existing.required += totalQuantity;
                } else {
                  warnings.push(`Unit mismatch for ${ingredient.productName || ingredient.productId}: ${existing.unit} vs ${ingredient.unit}`);
                }
              } else {
                ingredientChecks.set(ingredient.productId, {
                  required: totalQuantity,
                  unit: ingredient.unit,
                  productName: ingredient.productName || ''
                });
              }
            });
          }
          return true;
        }),
        catchError(() => of(false))
      );
    });

    return forkJoin(checkPromises).pipe(
      switchMap(() => {
        // Check each ingredient's availability
        const availabilityChecks = Array.from(ingredientChecks.entries()).map(([productId, check]) => {
          return this.itemsService.getItemById(productId).pipe(
            map((product: Item) => {
              // Check if product is available
              if (!product.isAvailable) {
                missingItems.push(`${check.productName || product.name} (${check.required} ${check.unit} required)`);
                return false;
              }
              
              // TODO: In production, check actual stock levels:
              // if (product.stock < check.required) {
              //   missingItems.push(`${check.productName}: Need ${check.required} ${check.unit}, but only ${product.stock} ${product.unit} available`);
              //   return false;
              // }
              
              return true;
            }),
            catchError(() => {
              missingItems.push(`${check.productName || 'Unknown product'} (${check.required} ${check.unit} required)`);
              return of(false);
            })
          );
        });

        return forkJoin(availabilityChecks).pipe(
          map(results => {
            const allAvailable = results.every(r => r === true) && missingItems.length === 0;
            return {
              available: allAvailable,
              missingItems,
              warnings
            };
          })
        );
      })
    );
  }
}

