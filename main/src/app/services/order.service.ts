import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, of, firstValueFrom } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import {
  Order,
  OrderStatus,
  BackendOrderStatus,
  OrderApiModel,
  CreateOrderCommand,
  OrderItemPayload,
  OrderQuery,
  OrderType,
  OrderSource,
  OrderPaymentMethod,
  OrderCustomer
} from '../models/order.model';
import { CartItem, CartAddonSelection } from './cart.service';

interface CreateOrderContext {
  cartItems: CartItem[];
  placeId: string;
  branchId: string;
  tableId?: string | null;
  guestUuid: string;
  paymentMethod?: string;
  notes?: string;
  currency: string;
  total: number;
  subtotal: number;
}
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

  private readonly backendToClientStatusMap: Record<BackendOrderStatus, OrderStatus> = {
    pending: OrderStatus.PENDING,
    confirmed: OrderStatus.CONFIRMED,
    preparing: OrderStatus.PREPARING,
    ready: OrderStatus.READY,
    completed: OrderStatus.SERVED,
    cancelled: OrderStatus.CANCELLED
  };

  private readonly clientToBackendStatusMap: Record<OrderStatus, BackendOrderStatus> = {
    [OrderStatus.PENDING]: 'pending',
    [OrderStatus.CONFIRMED]: 'confirmed',
    [OrderStatus.PREPARING]: 'preparing',
    [OrderStatus.READY]: 'ready',
    [OrderStatus.SERVED]: 'completed',
    [OrderStatus.CANCELLED]: 'cancelled'
  };

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
   * Generate a local identifier for offline flows
   */
  private generateLocalId(prefix: string = 'order'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

    const { subtotal, total } = this.calculateCartTotals(cartItems);
    let createdOrder: Order | null = null;

    if (this.hasApiSupport()) {
      try {
        const payload = this.buildCreateOrderCommand({
          cartItems,
          placeId,
          branchId,
          tableId,
          guestUuid,
          paymentMethod,
          notes,
          currency,
          total,
          subtotal
        });
        const includeAuth = this.auth.isAuthenticated();
        const response = await firstValueFrom(
          this.api.post<OrderApiModel>('/orders', payload, includeAuth)
        );
        if (response) {
          createdOrder = this.mapOrderDtoToOrder(response, {
            fallbackCurrency: currency,
            fallbackGuestUuid: guestUuid,
            fallbackBranchId: branchId
          });
        }
      } catch (error) {
        console.warn('Failed to create order via API:', error);
      }
    }

    if (!createdOrder) {
      createdOrder = {
        id: this.generateLocalId('order'),
        orderNumber: this.generateOrderNumber(),
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
        updatedAt: new Date(),
        subtotal,
        type: this.getOrderType(tableId),
        source: this.getOrderSource(),
        customer: this.buildCustomerPayload(guestUuid, tableId),
        payment: {
          method: this.mapPaymentMethod(paymentMethod),
          amount: total,
          status: this.auth.isAuthenticated() ? 'completed' : 'pending'
        }
      };
    }

    await this.indexedDB.saveOrder(createdOrder);

    this.inventoryDeduction.deductInventoryForOrder(createdOrder).subscribe({
      next: (success) => {
        const message = success
          ? `Inventory deducted successfully for order ${createdOrder?.orderNumber}`
          : `Inventory deduction had issues for order ${createdOrder?.orderNumber}`;
        console[success ? 'log' : 'warn'](message);
      },
      error: (error) => {
        console.error('Error deducting inventory:', error);
        // Don't fail the order creation if inventory deduction fails
        // The order is already saved, inventory can be updated manually
      }
    });

    // Update observables
    await this.refreshOrders(guestUuid);

    return createdOrder;
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
  getOrderById(
    orderId: string,
    options?: { includeAuth?: boolean; guestUuid?: string }
  ): Observable<Order | null> {
    const includeAuth = options?.includeAuth ?? this.auth.isAuthenticated();
    const guestUuid = options?.guestUuid;

    if (!this.hasApiSupport()) {
      return from(this.indexedDB.getOrderById(orderId)).pipe(
        catchError(error => {
          console.error('Error fetching order:', error);
          return of(null);
        })
      );
    }

    return this.fetchOrderByIdFromApi(orderId, includeAuth, guestUuid).pipe(
      catchError(error => {
        if (includeAuth) {
          // Retry without auth for guest contexts
          return this.fetchOrderByIdFromApi(orderId, false, guestUuid);
        }
        console.error('Error fetching order from API:', error);
        return of(null);
      }),
      switchMap(order => {
        if (order) {
          // Cache for offline access
          this.indexedDB.saveOrder(order).catch(() => {});
          return of(order);
        }
        return from(this.indexedDB.getOrderById(orderId));
      }),
      catchError(error => {
        console.error('Error retrieving order:', error);
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
   * Fetch orders from backend (staff dashboards, kitchen screens, etc.)
   */
  fetchOrders(query: OrderQuery = {}, includeAuth: boolean = true): Observable<Order[]> {
    if (!this.hasApiSupport()) {
      return of([]);
    }

    return this.api.get<OrderApiModel[]>(
      '/orders',
      this.normalizeOrderQuery(query),
      includeAuth
    ).pipe(
      map(orderList => Array.isArray(orderList) ? orderList : []),
      map(orderList => orderList.map(dto => this.mapOrderDtoToOrder(dto))),
      catchError(error => {
        console.error('Error fetching orders from API:', error);
        return of([]);
      })
    );
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    options?: { lastUpdatedBy?: string; includeAuth?: boolean }
  ): Promise<void> {
    const includeAuth = options?.includeAuth ?? this.auth.isAuthenticated();
    let updatedOrder: Order | null = null;

    if (this.hasApiSupport()) {
      try {
        const payload = {
          id: orderId,
          status: this.mapClientStatusToBackend(status),
          lastUpdatedBy: options?.lastUpdatedBy || this.auth.getCurrentUser()?.id || 'system'
        };
        const response = await firstValueFrom(
          this.api.put<OrderApiModel>(`/orderDetail?id=${orderId}`, payload, includeAuth)
        );
        if (response) {
          updatedOrder = this.mapOrderDtoToOrder(response);
          await this.indexedDB.saveOrder(updatedOrder);
        }
      } catch (error) {
        console.warn('Failed to update order status via API:', error);
      }
    }

    if (!updatedOrder) {
      await this.indexedDB.updateOrderStatus(orderId, status);
      updatedOrder = await this.indexedDB.getOrderById(orderId);
    }

    if (updatedOrder?.guestUuid) {
      await this.refreshOrders(updatedOrder.guestUuid);
    } else if (updatedOrder) {
      const currentOrders = this.ordersSubject.value;
      const index = currentOrders.findIndex(o => o.id === updatedOrder!.id);
      if (index !== -1) {
        const nextOrders = [...currentOrders];
        nextOrders[index] = updatedOrder;
        this.ordersSubject.next(nextOrders);
      }
    }
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

  /**
   * Helpers
   */
  private hasApiSupport(): boolean {
    return !!environment?.apiUrl;
  }

  private calculateCartTotals(cartItems: CartItem[]): { subtotal: number; total: number } {
    const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const subtotal = cartItems.reduce((sum, item) => {
      const addonAdjust = item.addonUnitTotal ?? 0;
      const derivedBase = item.price - addonAdjust;
      const basePrice = item.item?.price ?? derivedBase;
      return sum + Math.max(basePrice || 0, 0) * item.quantity;
    }, 0);
    return { subtotal, total };
  }

  private buildCreateOrderCommand(context: CreateOrderContext): CreateOrderCommand {
    const { cartItems, placeId, tableId, guestUuid, paymentMethod, notes, currency, total, subtotal, branchId } = context;
    const type = this.getOrderType(tableId);
    const source = this.getOrderSource();

    const items: OrderItemPayload[] = cartItems.map(item => this.mapCartItemToPayload(item));

    const paymentStatus = this.auth.isAuthenticated() ? 'completed' : 'pending';

    return {
      placeId,
      type,
      customer: this.buildCustomerPayload(guestUuid, tableId),
      items,
      payment: {
        method: this.mapPaymentMethod(paymentMethod),
        amount: total,
        status: paymentStatus
      },
      source,
      tableId: tableId || undefined,
      notes,
      lastUpdatedBy: this.auth.getCurrentUser()?.id || guestUuid || 'guest',
      metadata: {
        branchId,
        guestUuid,
        currency,
        subtotal,
        total,
        application: source === 'online' ? 'guest_menu' : 'pos'
      }
    };
  }

  private mapCartItemToPayload(item: CartItem): OrderItemPayload {
    const addonAdjust = item.addonUnitTotal ?? 0;
    const derivedBase = item.price - addonAdjust;
    const basePrice = item.item?.price ?? (derivedBase !== 0 ? derivedBase : item.price);
    return {
      itemId: item.item.id,
      itemName: item.item.name,
      itemPrice: basePrice,
      quantity: item.quantity,
      specialInstructions: item.notes,
      selectedAddons: item.selectedAddons?.map(addon => ({ ...addon })) || []
    };
  }

  private mapOrderDtoToOrder(
    dto: OrderApiModel,
    fallback?: { fallbackCurrency?: string; fallbackGuestUuid?: string; fallbackBranchId?: string }
  ): Order {
    const metadata = dto.metadata || {};
    const orderNumber = dto.orderNumber || (metadata['orderNumber'] as string) || this.generateOrderNumber();
    const id = dto.id || (metadata['orderId'] as string) || orderNumber;
    const backendStatus = dto.status || (metadata['status'] as BackendOrderStatus);
    const status = backendStatus ? this.mapBackendStatusToClient(backendStatus) : OrderStatus.PENDING;
    const tableId = dto.tableId ?? (metadata['tableId'] as string | null) ?? null;
    const createdAt =
      dto.createdAt ? new Date(dto.createdAt) :
      (metadata['createdAt'] ? new Date(metadata['createdAt']) : new Date());
    const updatedAt =
      dto.updatedAt ? new Date(dto.updatedAt) :
      (metadata['updatedAt'] ? new Date(metadata['updatedAt']) : new Date());

    const items = Array.isArray(dto.items)
      ? dto.items.map((item, index) => this.mapOrderItemDtoToCartItem(item, index, orderNumber))
      : [];
    const total = dto.total ?? items.reduce((sum, item) => sum + item.subtotal, 0);
    const currency = (metadata['currency'] as string) || fallback?.fallbackCurrency || 'JOD';
    const guestUuid = (metadata['guestUuid'] as string) || fallback?.fallbackGuestUuid;
    const branchId = (metadata['branchId'] as string) || fallback?.fallbackBranchId || '';

    return {
      id,
      orderNumber,
      guestUuid,
      userId: dto.customer?.id,
      placeId: dto.placeId,
      branchId,
      tableId,
      items,
      status,
      total,
      currency,
      paymentMethod: dto.payment?.method,
      notes: metadata['notes'] as string | undefined,
      createdAt,
      updatedAt,
      estimatedReadyTime: dto.estimatedReadyTime ? new Date(dto.estimatedReadyTime) : undefined,
      type: dto.type,
      customer: dto.customer,
      payment: dto.payment,
      source: dto.source,
      subtotal: dto.subtotal,
      tax: dto.tax,
      discount: dto.discount,
      metadata: dto.metadata
    };
  }

  private mapOrderItemDtoToCartItem(
    orderItem: OrderApiModel['items'][number],
    index: number,
    orderNumber: string
  ): CartItem {
    const addonUnitTotal = this.calculateAddonUnitTotal(orderItem.selectedAddons);
    const unitPrice = (orderItem.itemPrice || 0) + addonUnitTotal;
    const subtotal = orderItem.totalPrice ?? unitPrice * orderItem.quantity;
    const id = orderItem.id || `${orderNumber}-item-${index}`;
    const quantity = orderItem.quantity || 1;

    // Minimal menu item representation for UI compatibility
    const menuItem = {
      id: orderItem.itemId,
      name: orderItem.itemName,
      description: orderItem.specialInstructions,
      price: orderItem.itemPrice,
      originalPrice: orderItem.itemPrice,
      image: '/assets/images/products/product-1.png',
      category: 'orders',
      badge: undefined,
      badgeColor: undefined,
      rating: 0,
      isTopRated: false
    } as CartItem['item'];

    return {
      id,
      item: menuItem,
      quantity,
      notes: orderItem.specialInstructions,
      price: unitPrice,
      subtotal,
      selectedAddons: orderItem.selectedAddons?.map(addon => ({ ...addon })) || [],
      addonUnitTotal
    };
  }

  private calculateAddonUnitTotal(addons?: CartAddonSelection[]): number {
    if (!addons || addons.length === 0) {
      return 0;
    }
    return addons.reduce((sum, addon) => sum + addon.price * addon.quantity, 0);
  }

  private mapBackendStatusToClient(status: BackendOrderStatus): OrderStatus {
    return this.backendToClientStatusMap[status] ?? OrderStatus.PENDING;
  }

  private mapClientStatusToBackend(status: OrderStatus): BackendOrderStatus {
    return this.clientToBackendStatusMap[status] ?? 'pending';
  }

  private fetchOrderByIdFromApi(
    orderId: string,
    includeAuth: boolean,
    guestUuid?: string
  ): Observable<Order | null> {
    if (!this.hasApiSupport()) {
      return of(null);
    }

    return this.api.get<OrderApiModel>('/orderDetail', { id: orderId }, includeAuth).pipe(
      map(order => order ? this.mapOrderDtoToOrder(order, { fallbackGuestUuid: guestUuid }) : null)
    );
  }

  private normalizeOrderQuery(query: OrderQuery): Record<string, string> {
    const params: Record<string, string> = {};

    const appendParam = (key: string, value?: string | string[]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        params[key] = value.join(',');
      } else if (value) {
        params[key] = value;
      }
    };

    appendParam('place_id', query.placeId);
    appendParam('status', query.status);
    appendParam('type', query.type);
    appendParam('customer_id', query.customerId);
    appendParam('date_from', query.dateFrom);
    appendParam('date_to', query.dateTo);
    appendParam('order_number', query.orderNumber);
    appendParam('source', query.source);
    if (query.search) {
      appendParam('search', query.search);
      appendParam('q', query.search);
    }

    return params;
  }

  private mapPaymentMethod(method?: string): OrderPaymentMethod {
    const normalized = method?.toLowerCase();
    switch (normalized) {
      case 'cash':
        return 'cash';
      case 'card':
      case 'credit':
      case 'debit':
        return 'card';
      case 'wallet':
      case 'digital_wallet':
      case 'apple_pay':
      case 'google_pay':
        return 'digital_wallet';
      default:
        return this.auth.isAuthenticated() ? 'cash' : 'online';
    }
  }

  private buildCustomerPayload(guestUuid: string, tableId?: string | null): OrderCustomer {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser) {
      return {
        id: currentUser.id,
        name: currentUser.username,
        email: currentUser.email,
        isGuest: false
      };
    }
    return {
      id: guestUuid,
      name: tableId ? `Table ${tableId}` : 'Guest',
      isGuest: true
    };
  }

  private getOrderType(tableId?: string | null): OrderType {
    return tableId ? 'dine_in' : 'takeout';
  }

  private getOrderSource(): OrderSource {
    return this.auth.isAuthenticated() ? 'pos' : 'online';
  }
}

