import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { NotificationService } from '../../../services/notification.service';
import { 
  KitchenOrder, 
  KitchenOrderStatus, 
  KitchenOrderItem, 
  BatchCookingItem,
  KitchenMessage,
  Recipe
} from '../../../models/product.model';
import { OrderService } from '../../../services/order.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { Subject, interval, takeUntil } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { RealtimeOrdersService } from '../../../services/realtime-orders.service';
import { TenantContextService } from '../../../services/tenant-context.service';
import { LocalStorageService } from '../../../services/local-storage.service';

@Component({
  selector: 'app-kitchen-display',
  standalone: true,
  imports: [CommonModule, NgIf, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './kitchen-display.component.html',
  styleUrls: ['./kitchen-display.component.scss']
})
export class KitchenDisplayComponent implements OnInit, OnDestroy {
  orders: KitchenOrder[] = [];
  filteredOrders: KitchenOrder[] = [];
  batchCookingItems: BatchCookingItem[] = [];
  
  // History orders
  historyOrders: KitchenOrder[] = [];
  filteredHistoryOrders: KitchenOrder[] = [];
  
  // Tab control
  selectedTabIndex: number = 0; // 0 = Live Board, 1 = Order History
  
  statusFilter = new FormControl('all');
  stationFilter = new FormControl('all');
  viewMode = new FormControl('orders'); // 'orders' | 'batch'
  
  // History filters
  historyStatusFilter = new FormControl('all');
  historyTypeFilter = new FormControl('all');
  historyDateFrom = new FormControl<Date | null>(null);
  historyDateTo = new FormControl<Date | null>(null);
  historySearchFilter = new FormControl('');
  
  KitchenOrderStatus = KitchenOrderStatus;
  
  isLoading: boolean = false;
  isLoadingHistory: boolean = false;
  autoRefresh: boolean = false;
  isFullscreen: boolean = false;
  largeTextMode: boolean = false;
  soundAlerts: boolean = true;
  
  stations: string[] = ['all', 'Grill', 'Salad', 'Pizza', 'Dessert', 'Beverages'];
  
  // Timer tracking
  orderTimers: Map<string, { 
    waitingTime: number; 
    preparingTime: number; 
    waitingSeconds: number;
    preparingSeconds: number;
    estimated: number; 
    isOverdue: boolean;
    isCompleted: boolean;
  }> = new Map();
  private timerInterval$ = interval(1000); // Update every second
  
  // Message dialog
  newMessage: string = '';
  selectedOrderForMessage: KitchenOrder | null = null;
  
  private destroy$ = new Subject<void>();
  private refreshInterval$ = interval(5000);
  private currentPlaceId: string | null = null;
  private currentBranchId: string | null = null;
  private realtimeSubscription: any = null;
  private readonly BRANCH_STORAGE_KEY = 'branchId';

  constructor(
    private orderService: OrderService,
    private notification: NotificationService,
    private dialog: MatDialog,
    private realtimeOrders: RealtimeOrdersService,
    private tenantContext: TenantContextService,
    private localStorage: LocalStorageService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.getBranchId();
    this.getPlaceId();
    this.setupFilters();
    this.setupHistoryFilters();
    this.startTimers();
    
    // Tab changes are handled via onTabChange event
    
    this.viewMode.valueChanges.subscribe(() => {
      if (this.viewMode.value === 'batch') {
        this.updateBatchCookingView();
      }
    });

    this.realtimeOrders.getConnectionStatus$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        if (!status.connected && status.error) {
          console.warn('Real-time connection lost:', status.error);
        }
      });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('kitchen-fullscreen-mode');
    
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
    this.realtimeOrders.disconnectAll();
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getBranchId(): void {
    // Get branchId from route params or localStorage
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const newBranchId = params['branchId'] || params['branch_id'] || null;
      if (newBranchId) {
        if (newBranchId !== this.currentBranchId) {
          this.currentBranchId = newBranchId;
          this.localStorage.setItem(this.BRANCH_STORAGE_KEY, newBranchId);
          if (this.currentPlaceId) {
            this.connectRealtimeOrders();
          }
        }
      } else if (!this.currentBranchId) {
        const storedBranch = this.localStorage.getItem<string>(this.BRANCH_STORAGE_KEY);
        if (storedBranch) {
          this.currentBranchId = storedBranch;
        }
      }
    });

    // If no branchId in route, try localStorage
    if (!this.currentBranchId) {
      this.currentBranchId = this.localStorage.getItem<string>(this.BRANCH_STORAGE_KEY);
    }
  }

  private getPlaceId(): void {
    this.tenantContext.currentPlaceId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(placeId => {
        if (placeId && placeId !== this.currentPlaceId) {
          this.currentPlaceId = placeId;
          this.connectRealtimeOrders();
        } else if (!placeId) {
          this.loadOrders();
        }
      });
  }

  private connectRealtimeOrders(): void {
    if (!this.currentPlaceId) {
      this.loadOrders();
      return;
    }

    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }

    const statuses = ['pending', 'confirmed', 'preparing', 'ready'];

    this.isLoading = true;
    
    // Set a timeout to clear loading state if no data is received within 5 seconds
    const loadingTimeout = setTimeout(() => {
      if (this.isLoading) {
        console.warn('No data received from realtime connection, clearing loading state');
        this.isLoading = false;
      }
    }, 5000);

    this.realtimeSubscription = this.realtimeOrders
      .connectRealtimeOrders(this.currentPlaceId, statuses, this.currentBranchId, 6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          clearTimeout(loadingTimeout);
          this.orders = orders.length
            ? orders.map(order => this.mapOrderToKitchenOrder(order))
            : [];
          
          this.applyFilters();
          
          if (this.viewMode.value === 'batch') {
            this.updateBatchCookingView();
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          clearTimeout(loadingTimeout);
          console.error('Real-time connection error:', error);
          this.isLoading = false;
          this.loadOrders();
        }
      });
  }

  loadOrders(): void {
    this.isLoading = true;
    const query = {
      status: ['pending', 'confirmed', 'preparing', 'ready'] as string[]
    };

    this.orderService.fetchOrders(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (orders) => {
        this.orders = orders.length
          ? orders.map(order => this.mapOrderToKitchenOrder(order))
          : [];
        if (!orders.length) {
          this.notification.info('No active kitchen orders at the moment.');
        }
        this.applyFilters();
        if (this.viewMode.value === 'batch') {
          this.updateBatchCookingView();
        }
        this.isLoading = false;
      },
      error: () => {
        this.orders = [];
        this.applyFilters();
        this.isLoading = false;
        this.notification.error('Failed to load orders from server.');
      }
    });
  }

  private mapOrderToKitchenOrder(order: Order): KitchenOrder {
    const kitchenStatus = this.mapOrderStatusToKitchenStatus(order.status);
    const estimatedMinutes = order.estimatedReadyTime
      ? Math.max(1, Math.round((order.estimatedReadyTime.getTime() - order.createdAt.getTime()) / 60000))
      : 15;

    const items: KitchenOrderItem[] = order.items.map(item => ({
      id: item.id,
      productId: item.item.id,
      productName: item.item.name,
      quantity: item.quantity,
      modifiers: item.selectedAddons?.map(addon => addon.optionName),
      specialInstructions: item.notes,
      status: kitchenStatus
    }));

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      saleId: order.id,
      tableNumber: order.tableId || undefined,
      orderType: this.getKitchenOrderType(order.type, order.tableId),
      items,
      status: kitchenStatus,
      specialInstructions: order.notes,
      createdAt: order.createdAt.toISOString(),
      estimatedTime: estimatedMinutes,
      priority: 'NORMAL',
      serverName: order.customer?.name,
      customerName: order.customer?.name || (order.tableId ? `Table ${order.tableId}` : 'Guest'),
      paymentStatus: this.mapPaymentStatus(order.payment?.status)
    };
  }

  private getKitchenOrderType(type?: Order['type'], tableId?: string | null): KitchenOrder['orderType'] {
    switch (type) {
      case 'dine_in':
        return 'DINE_IN';
      case 'delivery':
        return 'DELIVERY';
      case 'pickup':
      case 'takeout':
        return 'TAKEOUT';
      default:
        return tableId ? 'DINE_IN' : 'TAKEOUT';
    }
  }

  private mapOrderStatusToKitchenStatus(status: OrderStatus): KitchenOrderStatus {
    switch (status) {
      case OrderStatus.PREPARING:
        return KitchenOrderStatus.IN_PROGRESS;
      case OrderStatus.READY:
        return KitchenOrderStatus.READY;
      case OrderStatus.SERVED:
        return KitchenOrderStatus.COMPLETED;
      case OrderStatus.CANCELLED:
        return KitchenOrderStatus.CANCELLED;
      case OrderStatus.CONFIRMED:
      case OrderStatus.PENDING:
      default:
        return KitchenOrderStatus.NEW;
    }
  }

  private mapKitchenStatusToOrderStatus(status: KitchenOrderStatus): OrderStatus {
    switch (status) {
      case KitchenOrderStatus.IN_PROGRESS:
        return OrderStatus.PREPARING;
      case KitchenOrderStatus.READY:
        return OrderStatus.READY;
      case KitchenOrderStatus.COMPLETED:
        return OrderStatus.SERVED;
      case KitchenOrderStatus.CANCELLED:
        return OrderStatus.CANCELLED;
      case KitchenOrderStatus.NEW:
      default:
        return OrderStatus.PENDING;
    }
  }

  private mapPaymentStatus(status?: string): 'PENDING' | 'PAID' | 'PARTIAL' {
    const normalized = status?.toLowerCase();
    switch (normalized) {
      case 'completed':
      case 'paid':
        return 'PAID';
      case 'partial':
      case 'refunded':
        return 'PARTIAL';
      default:
        return 'PENDING';
    }
  }

  setupFilters(): void {
    this.statusFilter.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.stationFilter.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  setupHistoryFilters(): void {
    this.historyStatusFilter.valueChanges.subscribe(() => {
      this.applyHistoryFilters();
    });

    this.historyTypeFilter.valueChanges.subscribe(() => {
      this.applyHistoryFilters();
    });

    this.historyDateFrom.valueChanges.subscribe(() => {
      this.applyHistoryFilters();
    });

    this.historyDateTo.valueChanges.subscribe(() => {
      this.applyHistoryFilters();
    });

    this.historySearchFilter.valueChanges.subscribe(() => {
      this.applyHistoryFilters();
    });
  }

  applyFilters(): void {
    const status = this.statusFilter.value || 'all';
    const station = this.stationFilter.value || 'all';

    this.filteredOrders = this.orders.filter(order => {
      // By default (when 'all'), show only NEW, IN_PROGRESS, and READY (exclude COMPLETED)
      let matchesStatus: boolean;
      if (status === 'all') {
        matchesStatus = order.status === KitchenOrderStatus.NEW || 
                       order.status === KitchenOrderStatus.IN_PROGRESS || 
                       order.status === KitchenOrderStatus.READY;
      } else {
        matchesStatus = order.status === status;
      }
      
      const matchesStation = station === 'all' || 
        order.items.some(item => item.station === station);
      
      return matchesStatus && matchesStation;
    });

    // Sort by priority and creation time
    this.filteredOrders.sort((a, b) => {
      const priorityOrder = { 'RUSH': 0, 'URGENT': 1, 'NORMAL': 2 };
      const priorityDiff = (priorityOrder[a.priority || 'NORMAL'] || 2) - 
                          (priorityOrder[b.priority || 'NORMAL'] || 2);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  loadHistoryOrders(): void {
    if (this.isLoadingHistory) return; // Prevent multiple simultaneous loads
    
    // Don't load if placeId is not available
    if (!this.currentPlaceId) {
      console.warn('Cannot load history orders: placeId is not available');
      this.notification.warning('Please wait for place information to load.');
      return;
    }
    
    this.isLoadingHistory = true;
    
    const query: any = {
      placeId: this.currentPlaceId,
      // Don't filter by status - get all statuses for history
    };

    // Add status filter if not 'all'
    const statusFilter = this.historyStatusFilter.value;
    if (statusFilter && statusFilter !== 'all') {
      // Map KitchenOrderStatus to backend status
      const backendStatus = this.mapKitchenStatusToBackendStatus(statusFilter);
      if (backendStatus) {
        query.status = backendStatus;
      }
    }

    // Add type filter if not 'all'
    const typeFilter = this.historyTypeFilter.value;
    if (typeFilter && typeFilter !== 'all') {
      query.type = typeFilter;
    }

    // Add date range filters
    if (this.historyDateFrom.value) {
      query.dateFrom = this.historyDateFrom.value.toISOString();
    }
    if (this.historyDateTo.value) {
      // Set to end of day
      const endDate = new Date(this.historyDateTo.value);
      endDate.setHours(23, 59, 59, 999);
      query.dateTo = endDate.toISOString();
    }

    // Add search filter
    const searchTerm = this.historySearchFilter.value;
    if (searchTerm && searchTerm.trim()) {
      query.search = searchTerm.trim();
    }

    this.orderService.fetchOrders(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.historyOrders = orders.length
            ? orders.map(order => this.mapOrderToKitchenOrder(order))
            : [];
          this.applyHistoryFilters();
          this.isLoadingHistory = false;
        },
        error: () => {
          this.historyOrders = [];
          this.applyHistoryFilters();
          this.isLoadingHistory = false;
          this.notification.error('Failed to load order history.');
        }
      });
  }

  applyHistoryFilters(): void {
    const status = this.historyStatusFilter.value || 'all';
    const searchTerm = (this.historySearchFilter.value || '').toLowerCase().trim();

    this.filteredHistoryOrders = this.historyOrders.filter(order => {
      let matchesStatus = true;
      if (status !== 'all') {
        matchesStatus = order.status === status;
      }
      let matchesSearch = true;
      if (searchTerm) {
        matchesSearch = 
          order.orderNumber.toLowerCase().includes(searchTerm) ||
          (order.customerName ? order.customerName.toLowerCase().includes(searchTerm) : false) ||
          (order.tableNumber ? order.tableNumber.toLowerCase().includes(searchTerm) : false);
      }

      return matchesStatus && matchesSearch;
    });

    this.filteredHistoryOrders.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  refreshHistory(): void {
    this.loadHistoryOrders();
  }

  private mapKitchenStatusToBackendStatus(kitchenStatus: string): string | null {
    switch (kitchenStatus) {
      case KitchenOrderStatus.NEW:
        return 'pending';
      case KitchenOrderStatus.IN_PROGRESS:
        return 'preparing';
      case KitchenOrderStatus.READY:
        return 'ready';
      case KitchenOrderStatus.COMPLETED:
        return 'completed';
      case KitchenOrderStatus.CANCELLED:
        return 'cancelled';
      default:
        return null;
    }
  }

  updateOrderStatus(order: KitchenOrder, status: KitchenOrderStatus): void {
    const oldStatus = order.status;
    order.status = status;
    
    // Update timestamps optimistically
    if (status === KitchenOrderStatus.IN_PROGRESS && !order.startedAt) {
      order.startedAt = new Date().toISOString();
    } else if (status === KitchenOrderStatus.READY && !order.readyAt) {
      order.readyAt = new Date().toISOString();
    } else if (status === KitchenOrderStatus.COMPLETED && !order.completedAt) {
      order.completedAt = new Date().toISOString();
    }

    order.items.forEach(item => {
      if (status === KitchenOrderStatus.IN_PROGRESS) {
        item.status = KitchenOrderStatus.IN_PROGRESS;
      } else if (status === KitchenOrderStatus.READY) {
        item.status = KitchenOrderStatus.READY;
      } else if (status === KitchenOrderStatus.COMPLETED) {
        item.status = KitchenOrderStatus.COMPLETED;
      }
    });

    const nextStatus = this.mapKitchenStatusToOrderStatus(status);
    this.orderService.updateOrderStatus(order.id, nextStatus).then(() => {
      this.notification.success(`Order ${order.orderNumber} status updated`);
    }).catch(() => {
      order.status = oldStatus;
      this.notification.error('Failed to update order status');
    });
  }

  updateItemStatus(order: KitchenOrder, item: KitchenOrderItem, status: KitchenOrderStatus): void {
    const oldStatus = item.status;
    item.status = status;

    // Check if all items are ready/completed
    const allItemsReady = order.items.every(i => 
      i.status === KitchenOrderStatus.READY || i.status === KitchenOrderStatus.COMPLETED
    );
    
    if (allItemsReady && order.status !== KitchenOrderStatus.READY) {
      this.updateOrderStatus(order, KitchenOrderStatus.READY);
    }

    // Mock API call
    this.notification.info(`${item.productName} status updated`);

    // Real API call (uncomment when backend is ready)
    // this.api.patch(`/kitchen/orders/${order.id}/items/${item.id}/status`, { status }).subscribe({
    //   next: () => {
    //     this.notification.success(`${item.productName} status updated`);
    //   },
    //   error: (error) => {
    //     item.status = oldStatus; // Revert on error
    //     this.notification.error('Failed to update item status');
    //   }
    // });
  }

  getElapsedTime(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return '< 1 min';
    if (diffMins < 60) return `${diffMins} min`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }

  getStatusColor(status: KitchenOrderStatus): string {
    switch (status) {
      case KitchenOrderStatus.NEW:
        return 'primary';
      case KitchenOrderStatus.IN_PROGRESS:
        return 'accent';
      case KitchenOrderStatus.READY:
        return 'warn';
      case KitchenOrderStatus.COMPLETED:
        return 'primary';
      default:
        return '';
    }
  }

  getPriorityColor(priority?: string): string {
    switch (priority) {
      case 'RUSH':
        return 'warn';
      case 'URGENT':
        return 'accent';
      default:
        return 'primary';
    }
  }

  startAutoRefresh(): void {
    this.refreshInterval$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.autoRefresh) {
          this.loadOrders();
        }
      });
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  getOrderTypeLabel(type: string): string {
    switch (type) {
      case 'DINE_IN':
        return 'Dine In';
      case 'TAKEOUT':
        return 'Takeout';
      case 'DELIVERY':
        return 'Delivery';
      default:
        return type;
    }
  }

  // 1. Order Timers & Alerts
  startTimers(): void {
    this.timerInterval$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.orders.forEach(order => {
          const isCompleted = order.status === KitchenOrderStatus.COMPLETED;
          
          // If order is completed, use the last calculated time (timer stops)
          if (isCompleted) {
            const existingTimer = this.orderTimers.get(order.id);
            if (existingTimer) {
              // Keep the last timer values, just mark as completed
              this.orderTimers.set(order.id, {
                ...existingTimer,
                isCompleted: true
              });
            } else {
              // Initialize with final times if not already set
              const waitingMs = order.completedAt ? 
                new Date(order.completedAt).getTime() - new Date(order.createdAt).getTime() :
                Date.now() - new Date(order.createdAt).getTime();
              const waitingSeconds = Math.floor(waitingMs / 1000);
              const waitingTime = Math.floor(waitingSeconds / 60);
              
              let preparingSeconds = 0;
              let preparingTime = 0;
              if (order.startedAt && order.completedAt) {
                const preparingMs = new Date(order.completedAt).getTime() - new Date(order.startedAt).getTime();
                preparingSeconds = Math.floor(preparingMs / 1000);
                preparingTime = Math.floor(preparingSeconds / 60);
              }
              
              this.orderTimers.set(order.id, {
                waitingTime,
                preparingTime,
                waitingSeconds,
                preparingSeconds,
                estimated: order.estimatedTime || 15,
                isOverdue: false,
                isCompleted: true
              });
            }
            return; // Stop timer updates for completed orders
          }
          
          // Calculate waiting time (from order creation)
          const waitingMs = Date.now() - new Date(order.createdAt).getTime();
          const waitingSeconds = Math.floor(waitingMs / 1000);
          const waitingTime = Math.floor(waitingSeconds / 60);
          
          // Calculate preparing time (from when cooking started)
          let preparingSeconds = 0;
          let preparingTime = 0;
          if (order.startedAt) {
            const preparingMs = Date.now() - new Date(order.startedAt).getTime();
            preparingSeconds = Math.floor(preparingMs / 1000);
            preparingTime = Math.floor(preparingSeconds / 60);
          }
          
          const estimated = order.estimatedTime || 15;
          
          // Determine if overdue based on current phase
          let isOverdue = false;
          if (order.status === KitchenOrderStatus.NEW) {
            // Overdue if waiting time exceeds estimated
            isOverdue = waitingTime > estimated;
          } else if (order.status === KitchenOrderStatus.IN_PROGRESS) {
            // Overdue if preparing time exceeds estimated
            isOverdue = preparingTime > estimated;
          }
          
          this.orderTimers.set(order.id, { 
            waitingTime, 
            preparingTime,
            waitingSeconds,
            preparingSeconds,
            estimated, 
            isOverdue,
            isCompleted: false
          });
          
          // Sound alert for overdue orders (play once per minute when overdue)
          if (isOverdue && this.soundAlerts && 
              (order.status === KitchenOrderStatus.NEW || order.status === KitchenOrderStatus.IN_PROGRESS) &&
              waitingSeconds % 60 === 0) {
            this.playAlertSound();
          }
        });
      });
  }

  getTimerDisplay(orderId: string): string {
    const timer = this.orderTimers.get(orderId);
    if (!timer) return '0 min';
    
    if (timer.isCompleted) {
      return 'Completed';
    }
    
    // Show preparing time if order is in progress, otherwise waiting time
    const order = this.orders.find(o => o.id === orderId);
    if (order?.status === KitchenOrderStatus.IN_PROGRESS) {
      return `${timer.preparingTime} min`;
    }
    return `${timer.waitingTime} min`;
  }

  getTimerCountdown(orderId: string): string {
    const timer = this.orderTimers.get(orderId);
    if (!timer) return '00:00';
    
    if (timer.isCompleted) {
      return '00:00';
    }
    
    const order = this.orders.find(o => o.id === orderId);
    const estimated = timer.estimated || 15;
    const estimatedSeconds = estimated * 60;
    
    let remainingSeconds = 0;
    if (order?.status === KitchenOrderStatus.IN_PROGRESS) {
      // Show remaining preparing time
      remainingSeconds = Math.max(0, estimatedSeconds - timer.preparingSeconds);
    } else {
      // Show remaining waiting time
      remainingSeconds = Math.max(0, estimatedSeconds - timer.waitingSeconds);
    }
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  getElapsedTimeFormatted(orderId: string): string {
    const timer = this.orderTimers.get(orderId);
    if (!timer) return '0m';
    
    const order = this.orders.find(o => o.id === orderId);
    let totalSeconds = 0;
    
    if (timer.isCompleted) {
      // Show final preparing time if order was in progress, otherwise total waiting time
      if (order?.startedAt) {
        totalSeconds = timer.preparingSeconds;
      } else {
        totalSeconds = timer.waitingSeconds;
      }
    } else {
      if (order?.status === KitchenOrderStatus.IN_PROGRESS) {
        totalSeconds = timer.preparingSeconds;
      } else {
        totalSeconds = timer.waitingSeconds;
      }
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  getTimerLabel(orderId: string): string {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return 'Timer';
    
    if (order.status === KitchenOrderStatus.COMPLETED) {
      return 'Completed';
    } else if (order.status === KitchenOrderStatus.IN_PROGRESS) {
      return 'Preparing Time';
    } else {
      return 'Waiting Time';
    }
  }

  getRemainingTime(orderId: string): number {
    const timer = this.orderTimers.get(orderId);
    if (!timer) return 0;
    const estimated = timer.estimated || 15;
    
    const order = this.orders.find(o => o.id === orderId);
    if (order?.status === KitchenOrderStatus.IN_PROGRESS) {
      return Math.max(0, estimated - timer.preparingTime);
    }
    return Math.max(0, estimated - timer.waitingTime);
  }

  getTimerProgress(orderId: string): number {
    const timer = this.orderTimers.get(orderId);
    if (!timer) return 0;
    
    if (timer.isCompleted) {
      return 100;
    }
    
    const estimated = timer.estimated || 15;
    const estimatedSeconds = estimated * 60;
    if (estimatedSeconds === 0) return 0;
    
    const order = this.orders.find(o => o.id === orderId);
    let elapsedSeconds = 0;
    
    if (order?.status === KitchenOrderStatus.IN_PROGRESS) {
      elapsedSeconds = timer.preparingSeconds;
    } else {
      elapsedSeconds = timer.waitingSeconds;
    }
    
    return Math.min(100, (elapsedSeconds / estimatedSeconds) * 100);
  }

  isOrderOverdue(orderId: string): boolean {
    return this.orderTimers.get(orderId)?.isOverdue || false;
  }

  playAlertSound(): void {
    // Play alert sound (browser beep)
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OSfTQ8MUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBtpvfDkn00PDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore errors
  }

  // 3. Recipe & Cooking Instructions
  showRecipe(item: KitchenOrderItem): void {
    if (!item.recipe) {
      this.notification.info('No recipe available for this item');
      return;
    }
    // Open recipe dialog or expand in UI
    this.notification.info(`Recipe: ${item.recipe.name}`);
  }

  showRecipeFromBatch(recipe: Recipe | undefined): void {
    if (!recipe) {
      this.notification.info('No recipe available');
      return;
    }
    this.notification.info(`Recipe: ${recipe.name}`);
  }

  // 4. Allergen & Dietary Information
  getAllergenDisplay(item: KitchenOrderItem): string {
    if (!item.allergens || item.allergens.length === 0) return '';
    return item.allergens.join(', ');
  }

  // 6. Batch Cooking View
  updateBatchCookingView(): void {
    const batchMap = new Map<string, BatchCookingItem>();
    
    this.orders.forEach(order => {
      order.items.forEach(item => {
        if (item.status === KitchenOrderStatus.NEW || item.status === KitchenOrderStatus.IN_PROGRESS) {
          const key = `${item.productId}-${item.station || 'default'}`;
          
          if (!batchMap.has(key)) {
            batchMap.set(key, {
              productName: item.productName,
              productId: item.productId,
              totalQuantity: 0,
              orders: [],
              station: item.station,
              recipe: item.recipe,
              allergens: item.allergens
            });
          }
          
          const batchItem = batchMap.get(key)!;
          batchItem.totalQuantity += item.quantity;
          batchItem.orders.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            quantity: item.quantity,
            tableNumber: order.tableNumber,
            specialInstructions: item.specialInstructions
          });
        }
      });
    });
    
    this.batchCookingItems = Array.from(batchMap.values());
  }

  // 7. Order Management
  holdOrder(order: KitchenOrder): void {
    order.isHeld = true;
    order.holdReason = 'Held by kitchen';
    this.notification.info(`Order ${order.orderNumber} is on hold`);
    // this.api.patch(`/kitchen/orders/${order.id}/hold`, { reason: order.holdReason }).subscribe();
  }

  releaseOrder(order: KitchenOrder): void {
    order.isHeld = false;
    order.holdReason = undefined;
    this.notification.info(`Order ${order.orderNumber} released`);
    // this.api.patch(`/kitchen/orders/${order.id}/release`).subscribe();
  }

  cancelOrder(order: KitchenOrder, reason: string): void {
    if (confirm(`Cancel order ${order.orderNumber}?`)) {
      order.status = KitchenOrderStatus.CANCELLED;
      this.notification.warning(`Order ${order.orderNumber} cancelled: ${reason}`);
      // this.api.patch(`/kitchen/orders/${order.id}/cancel`, { reason }).subscribe();
    }
  }

  reprintTicket(order: KitchenOrder): void {
    this.notification.info(`Reprinting ticket for order ${order.orderNumber}`);
    // this.api.post(`/kitchen/orders/${order.id}/reprint`).subscribe();
  }

  // 8. Communication Features
  sendMessage(order: KitchenOrder, message: string): void {
    if (!message.trim()) return;
    
    const newMsg: KitchenMessage = {
      id: Date.now().toString(),
      orderId: order.id,
      from: 'KITCHEN',
      to: order.serverName || 'FOH',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      isRead: false
    };
    
    if (!order.messages) {
      order.messages = [];
    }
    order.messages.push(newMsg);
    this.newMessage = '';
    this.selectedOrderForMessage = null;
    
    this.notification.success('Message sent');
    // this.api.post(`/kitchen/orders/${order.id}/messages`, newMsg).subscribe();
  }

  openMessageDialog(order: KitchenOrder): void {
    this.selectedOrderForMessage = order;
  }

  // 9. Inventory Integration
  checkInventory(item: KitchenOrderItem): void {
    if (item.isLowStock) {
      this.notification.warning(`Low stock alert: ${item.productName} - ${item.stockAlert}`);
    } else {
      this.notification.info(`${item.productName} - Stock OK`);
    }
  }

  // 12. Visual Enhancements
  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      document.body.classList.add('kitchen-fullscreen-mode');
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.body.classList.remove('kitchen-fullscreen-mode');
      document.exitFullscreen().catch(() => {});
    }
  }

  toggleLargeText(): void {
    this.largeTextMode = !this.largeTextMode;
  }

  toggleSoundAlerts(): void {
    this.soundAlerts = !this.soundAlerts;
  }

  onTabChange(event: any): void {
    // Update the selected tab index
    this.selectedTabIndex = event.index;
    
    // Load history orders when switching to history tab
    if (event.index === 1) {
      this.loadHistoryOrders();
    }
  }
}

