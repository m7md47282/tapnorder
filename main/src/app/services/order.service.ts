import { inject, Injectable } from '@angular/core';
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
import { environment } from '../../environments/environment';
import { TenantContextService } from './tenant-context.service';

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
  private tenantContext: TenantContextService = inject(TenantContextService);

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
    private auth: AuthService
    // InventoryDeductionService removed
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
    currency: string = this.tenantContext.getCurrentCurrency()
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
        
        // Try with auth if available, otherwise try without (for guest orders)
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
          
          // Save to IndexedDB for offline access
          await this.indexedDB.saveOrder(createdOrder);
          
          // Update observables
          await this.refreshOrders(guestUuid);
          
          return createdOrder;
        }
      } catch (error) {
        console.error('Failed to create order via API:', error);
        // Don't fall through to local creation - throw error so UI can handle it
        throw new Error(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // If API is not available or order creation failed, create local order as fallback
    // This should only happen in offline scenarios or when API is disabled
    if (!createdOrder) {
      if (!this.hasApiSupport()) {
        // Only create local order if API is not available
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

        await this.indexedDB.saveOrder(createdOrder);
        await this.refreshOrders(guestUuid);
      } else {
        // If API is available but order creation failed, throw error
        throw new Error('Order creation failed. Please try again.');
      }
    }

    // Inventory deduction is now handled by the backend upon order creation/status change.
    // We no longer manually trigger it from the frontend to ensure data integrity and avoid duplicates.

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
   * According to swagger: PUT /orderDetail?id={id}
   * Request body: UpdateOrderStatusRequest { id, status, lastUpdatedBy }
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
        // Build payload according to swagger spec
        // Required fields: id, status, lastUpdatedBy
        const payload = {
          id: orderId,
          status: this.mapClientStatusToBackend(status),
          lastUpdatedBy: options?.lastUpdatedBy || this.auth.getCurrentUser()?.id || 'system'
        };
        
        // Endpoint: PUT /orderDetail?id={id}
        const response = await firstValueFrom(
          this.api.put<OrderApiModel>(`/orderDetail?id=${orderId}`, payload, includeAuth)
        );
        
        if (response) {
          updatedOrder = this.mapOrderDtoToOrder(response);
          
          // Save to IndexedDB for offline access
          await this.indexedDB.saveOrder(updatedOrder);
          
          // Update observables
          if (updatedOrder.guestUuid) {
            await this.refreshOrders(updatedOrder.guestUuid);
          } else {
            const currentOrders = this.ordersSubject.value;
            const index = currentOrders.findIndex(o => o.id === updatedOrder!.id);
            if (index !== -1) {
              const nextOrders = [...currentOrders];
              nextOrders[index] = updatedOrder;
              this.ordersSubject.next(nextOrders);
            }
          }
          
          return; // Success - return early
        }
      } catch (error) {
        console.error('Failed to update order status via API:', error);
        // Don't fall through to local update - throw error so caller can handle it
        throw new Error(`Failed to update order status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // If API is not available, update locally (offline scenario)
    if (!this.hasApiSupport()) {
      await this.indexedDB.updateOrderStatus(orderId, status);
      updatedOrder = await this.indexedDB.getOrderById(orderId);
      
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
    } else {
      // API is available but update failed - throw error
      throw new Error('Order status update failed. Please try again.');
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

    // Build command according to swagger spec
    // Required fields: placeId, customer, items, type, payment, lastUpdatedBy
    const command: CreateOrderCommand = {
      placeId,
      type,
      customer: this.buildCustomerPayload(guestUuid, tableId),
      items,
      payment: {
        method: this.mapPaymentMethod(paymentMethod),
        amount: total,
        status: paymentStatus
      },
      lastUpdatedBy: this.auth.getCurrentUser()?.id || guestUuid || 'guest'
    };

    // Optional fields
    if (source) {
      command.source = source;
    }
    if (tableId) {
      command.tableId = tableId;
    }
    if (notes) {
      command.notes = notes;
    }

    // Note: metadata is not in swagger spec but may be accepted by backend
    // Keeping it for backward compatibility but it's not part of the official schema
    command.metadata = {
      branchId,
      guestUuid,
      currency,
      subtotal,
      total,
      application: source === 'online' ? 'guest_menu' : 'pos'
    };

    return command;
  }

  private mapCartItemToPayload(item: CartItem): OrderItemPayload {
    const addonAdjust = item.addonUnitTotal ?? 0;
    const derivedBase = item.price - addonAdjust;
    const basePrice = item.item?.price ?? (derivedBase !== 0 ? derivedBase : item.price);
    
    // Build payload according to swagger spec
    // Required: itemId, itemName, itemPrice, quantity
    const payload: OrderItemPayload = {
      itemId: item.item.id,
      itemName: item.item.name,
      itemPrice: basePrice,
      quantity: item.quantity
    };

    // Optional fields
    if (item.notes) {
      payload.specialInstructions = item.notes;
    }
    if (item.selectedAddons && item.selectedAddons.length > 0) {
      // Ensure selectedAddons match CartAddonSelection schema
      // Required: groupId, optionId, price, quantity
      // groupName and optionName are required by CartAddonSelection interface
      payload.selectedAddons = item.selectedAddons.map(addon => ({
        groupId: addon.groupId,
        optionId: addon.optionId,
        price: addon.price,
        quantity: addon.quantity,
        groupName: addon.groupName || '',
        optionName: addon.optionName || ''
      }));
    }

    return payload;
  }

  private convertFirestoreTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    
    if (timestamp && typeof timestamp === 'object') {
      if ('_seconds' in timestamp) {
        return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
      }
      if ('seconds' in timestamp) {
        return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
      }
    }
    
    return new Date(timestamp);
  }

  mapOrderDtoToOrder(
    dto: OrderApiModel,
    fallback?: { fallbackCurrency?: string; fallbackGuestUuid?: string; fallbackBranchId?: string }
  ): Order {
    const metadata = dto.metadata || {};
    const orderNumber = dto.orderNumber || (metadata['orderNumber'] as string) || this.generateOrderNumber();
    const id = dto.id || (metadata['orderId'] as string) || orderNumber;
    const backendStatus = dto.status || (metadata['status'] as BackendOrderStatus);
    const status = backendStatus ? this.mapBackendStatusToClient(backendStatus) : OrderStatus.PENDING;
    // Extract tableId from multiple possible locations
    const tableId = dto.tableId ?? 
                    (metadata['tableId'] as string | null) ?? 
                    (metadata['table_id'] as string | null) ?? 
                    (dto as any).table_id ?? 
                    null;
    
    // Debug logging for tableId extraction
    if (dto.id && !tableId && (dto.tableId || metadata['tableId'] || metadata['table_id'])) {
      console.warn(`Order ${dto.id}: tableId found in unexpected location`, {
        'dto.tableId': dto.tableId,
        'metadata.tableId': metadata['tableId'],
        'metadata.table_id': metadata['table_id'],
        'dto.table_id': (dto as any).table_id
      });
    }
    const createdAt = this.convertFirestoreTimestamp(dto.createdAt || metadata['createdAt']);
    const updatedAt = this.convertFirestoreTimestamp(dto.updatedAt || metadata['updatedAt']);

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
      estimatedReadyTime: dto.estimatedReadyTime ? this.convertFirestoreTimestamp(dto.estimatedReadyTime) : undefined,
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

    appendParam('placeId', query.placeId);
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

