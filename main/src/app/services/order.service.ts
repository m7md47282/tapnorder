import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { Order, OrderStatus } from '../models/order.model';
import { CartItem } from './cart.service';
import { IndexedDBService } from './indexeddb.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { InventoryDeductionService } from './inventory-deduction.service';
import { environment } from '../../environments/environment';

/**
 * Order Service
 * Manages order creation, retrieval, and status updates
 */
@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$ = this.ordersSubject.asObservable();
  
  private activeOrderSubject = new BehaviorSubject<Order | null>(null);
  public activeOrder$ = this.activeOrderSubject.asObservable();

  constructor(
    private indexedDB: IndexedDBService,
    private api: ApiService,
    private auth: AuthService,
    private inventoryDeduction: InventoryDeductionService
  ) {
    this.loadOrders();
  }

  /**
   * Load orders from IndexedDB
   */
  private async loadOrders(): Promise<void> {
    try {
      // For now, we'll load orders when a guest UUID is available
      // This will be called from the component after UUID is initialized
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  }

  /**
   * Generate order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Create a new order
   */
  async createOrder(
    cartItems: CartItem[],
    placeId: string,
    branchId: string,
    tableId: string | null | undefined,
    guestUuid: string,
    paymentMethod?: string,
    notes?: string,
    currency: string = 'JOD'
  ): Promise<Order> {
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cannot create order with empty cart');
    }

    const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const orderNumber = this.generateOrderNumber();
    
    const order: Order = {
      id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orderNumber,
      guestUuid,
      userId: this.auth.isAuthenticated() ? this.auth.getCurrentUser()?.id : undefined,
      placeId,
      branchId,
      tableId: tableId || null,
      items: [...cartItems],
      status: OrderStatus.PENDING,
      total,
      currency,
      paymentMethod,
      notes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to IndexedDB
    await this.indexedDB.saveOrder(order);

    // Deduct inventory for this order
    this.inventoryDeduction.deductInventoryForOrder(order).subscribe({
      next: (success) => {
        if (success) {
          console.log(`Inventory deducted successfully for order ${order.orderNumber}`);
        } else {
          console.warn(`Inventory deduction had issues for order ${order.orderNumber}`);
        }
      },
      error: (error) => {
        console.error('Error deducting inventory:', error);
        // Don't fail the order creation if inventory deduction fails
        // The order is already saved, inventory can be updated manually
      }
    });

    // TODO: When backend is available, also save to API
    // if (environment.apiUrl && this.auth.isAuthenticated()) {
    //   this.api.post('/orders', order).subscribe();
    // }

    // Update observables
    await this.refreshOrders(guestUuid);

    return order;
  }

  /**
   * Get all orders for a guest UUID
   */
  getOrders(guestUuid: string): Observable<Order[]> {
    return from(this.indexedDB.getOrdersByGuestUuid(guestUuid)).pipe(
      tap(orders => {
        this.ordersSubject.next(orders);
      }),
      catchError(error => {
        console.error('Error fetching orders:', error);
        return of([]);
      })
    );
  }

  /**
   * Get order by ID
   */
  getOrderById(orderId: string): Observable<Order | null> {
    return from(this.indexedDB.getOrderById(orderId)).pipe(
      catchError(error => {
        console.error('Error fetching order:', error);
        return of(null);
      })
    );
  }

  /**
   * Get active order (most recent non-completed order)
   */
  getActiveOrder(guestUuid: string): Observable<Order | null> {
    return from(this.indexedDB.getActiveOrder(guestUuid)).pipe(
      tap(order => {
        this.activeOrderSubject.next(order);
      }),
      catchError(error => {
        console.error('Error fetching active order:', error);
        return of(null);
      })
    );
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.indexedDB.updateOrderStatus(orderId, status);
    
    // Refresh orders
    const order = await this.indexedDB.getOrderById(orderId);
    if (order?.guestUuid) {
      await this.refreshOrders(order.guestUuid);
    }

    // TODO: When backend is available, also update via API
    // if (environment.apiUrl) {
    //   this.api.patch(`/orders/${orderId}/status`, { status }).subscribe();
    // }
  }

  /**
   * Refresh orders list
   */
  private async refreshOrders(guestUuid: string): Promise<void> {
    const orders = await this.indexedDB.getOrdersByGuestUuid(guestUuid);
    this.ordersSubject.next(orders);
    
    const activeOrder = await this.indexedDB.getActiveOrder(guestUuid);
    this.activeOrderSubject.next(activeOrder);
  }

  /**
   * Initialize orders for a guest UUID
   */
  async initializeOrders(guestUuid: string): Promise<void> {
    await this.refreshOrders(guestUuid);
  }
}

