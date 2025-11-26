import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { 
  KitchenOrder, 
  KitchenOrderStatus, 
  KitchenOrderItem, 
  BatchCookingItem,
  KitchenMessage,
  Recipe
} from '../../../models/product.model';
import { Subject, interval, takeUntil } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';

@Component({
  selector: 'app-kitchen-display',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './kitchen-display.component.html',
  styleUrls: ['./kitchen-display.component.scss']
})
export class KitchenDisplayComponent implements OnInit, OnDestroy {
  orders: KitchenOrder[] = [];
  filteredOrders: KitchenOrder[] = [];
  batchCookingItems: BatchCookingItem[] = [];
  
  statusFilter = new FormControl('all');
  stationFilter = new FormControl('all');
  viewMode = new FormControl('orders'); // 'orders' | 'batch'
  
  KitchenOrderStatus = KitchenOrderStatus;
  
  isLoading: boolean = false;
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
  private refreshInterval$ = interval(5000); // Refresh every 5 seconds

  // Mock data for development
  private mockOrders: KitchenOrder[] = [
    {
      id: '1',
      orderNumber: 'ORD-001',
      saleId: 'sale-1',
      tableNumber: '5',
      orderType: 'DINE_IN',
      items: [
        {
          id: 'item-1',
          productId: '1',
          productName: 'Grilled Chicken',
          quantity: 2,
          modifiers: ['Extra sauce', 'No onions'],
          specialInstructions: 'Well done',
          status: KitchenOrderStatus.NEW,
          station: 'Grill',
          cookingTime: 12,
          prepTime: 5,
          temperature: '375°F',
          allergens: ['None'],
          dietaryInfo: ['Gluten Free'],
          recipe: {
            id: 'r1',
            productId: '1',
            name: 'Grilled Chicken',
            instructions: ['Season chicken with salt and pepper', 'Grill at 375°F for 12 minutes', 'Check internal temperature reaches 165°F'],
            cookingTime: 12,
            prepTime: 5,
            temperature: '375°F',
            ingredients: [
              { name: 'Chicken Breast', quantity: '8', unit: 'oz' },
              { name: 'Olive Oil', quantity: '2', unit: 'tbsp' },
              { name: 'Salt', quantity: '1', unit: 'tsp' }
            ]
          },
          isLowStock: false
        },
        {
          id: 'item-2',
          productId: '2',
          productName: 'Caesar Salad',
          quantity: 1,
          status: KitchenOrderStatus.NEW,
          station: 'Salad',
          prepTime: 3,
          allergens: ['Dairy', 'Eggs'],
          dietaryInfo: ['Contains Nuts'],
          isLowStock: true,
          stockAlert: 'Low on croutons'
        }
      ],
      status: KitchenOrderStatus.NEW,
      specialInstructions: 'Customer has allergy to nuts',
      createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      estimatedTime: 15,
      priority: 'NORMAL',
      serverName: 'John',
      customerName: 'Table 5'
    },
    {
      id: '2',
      orderNumber: 'ORD-002',
      saleId: 'sale-2',
      orderType: 'TAKEOUT',
      items: [
        {
          id: 'item-3',
          productId: '3',
          productName: 'Margherita Pizza',
          quantity: 1,
          modifiers: ['Extra cheese'],
          status: KitchenOrderStatus.IN_PROGRESS,
          station: 'Pizza',
          cookingTime: 8,
          prepTime: 5,
          temperature: '450°F',
          allergens: ['Dairy', 'Gluten'],
          recipe: {
            id: 'r3',
            productId: '3',
            name: 'Margherita Pizza',
            instructions: ['Preheat oven to 450°F', 'Spread sauce on dough', 'Add mozzarella and basil', 'Bake for 8 minutes'],
            cookingTime: 8,
            prepTime: 5,
            temperature: '450°F',
            ingredients: [
              { name: 'Pizza Dough', quantity: '1', unit: 'ball' },
              { name: 'Tomato Sauce', quantity: '4', unit: 'oz' },
              { name: 'Mozzarella', quantity: '6', unit: 'oz' }
            ]
          }
        }
      ],
      status: KitchenOrderStatus.IN_PROGRESS,
      createdAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      startedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      estimatedTime: 12,
      priority: 'URGENT',
      customerName: 'Takeout - Jane'
    },
    {
      id: '3',
      orderNumber: 'ORD-003',
      saleId: 'sale-3',
      tableNumber: '12',
      orderType: 'DINE_IN',
      items: [
        {
          id: 'item-4',
          productId: '4',
          productName: 'Chocolate Cake',
          quantity: 1,
          status: KitchenOrderStatus.READY,
          station: 'Dessert'
        }
      ],
      status: KitchenOrderStatus.READY,
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      startedAt: new Date(Date.now() - 840000).toISOString(),
      readyAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      estimatedTime: 5,
      priority: 'NORMAL',
      serverName: 'Sarah',
      customerName: 'Table 12'
    },
    {
      id: '4',
      orderNumber: 'ORD-004',
      saleId: 'sale-4',
      tableNumber: '13',
      orderType: 'DINE_IN',
      items: [
        {
          id: 'item-5',
          productId: '5',
          productName: 'Ice Cream',
          quantity: 1,
          status: KitchenOrderStatus.READY,
          station: 'Dessert'
        }
      ],
      status: KitchenOrderStatus.READY,
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      startedAt: new Date(Date.now() - 840000).toISOString(),
      readyAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      estimatedTime: 5,
      priority: 'NORMAL',
      serverName: 'Sarah',
      customerName: 'Table 13'
    },
    {
      id: '5',
      orderNumber: 'ORD-005',
      saleId: 'sale-5',
      tableNumber: '14',
      orderType: 'DINE_IN',
      items: [
        {
          id: 'item-6',
          productId: '6',
          productName: 'Ice Cream',
          quantity: 1,
          status: KitchenOrderStatus.READY,
          station: 'Dessert'
        }
      ],
      status: KitchenOrderStatus.READY,
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      startedAt: new Date(Date.now() - 840000).toISOString(),
      readyAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      estimatedTime: 5,
      priority: 'NORMAL',
      serverName: 'Sarah',
      customerName: 'Table 14'
    },
    {
      id: '6',
      orderNumber: 'ORD-006',
      saleId: 'sale-6',
      tableNumber: '15',
      orderType: 'DINE_IN',
      items: [
        {
          id: 'item-7',
          productId: '7',
          productName: 'Ice Cream',
          quantity: 1,
          status: KitchenOrderStatus.READY,
          station: 'Dessert'
        }
      ],
      status: KitchenOrderStatus.READY,
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      startedAt: new Date(Date.now() - 840000).toISOString(),
      readyAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      estimatedTime: 5,
      priority: 'NORMAL',
      serverName: 'Sarah',
      customerName: 'Table 15'
    },
    {
      id: '7',
      orderNumber: 'ORD-007',
      saleId: 'sale-7',
      tableNumber: '16',
      orderType: 'DINE_IN',
      items: [
        {
          id: 'item-8',
          productId: '8',
          productName: 'Ice Cream',
          quantity: 1,
          status: KitchenOrderStatus.READY,
          station: 'Dessert'
        }
      ],
      status: KitchenOrderStatus.READY,
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      startedAt: new Date(Date.now() - 840000).toISOString(),
      readyAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      estimatedTime: 5,
      priority: 'NORMAL',
      serverName: 'Sarah',
      customerName: 'Table 16'  
    },
    {
      id: '8',
      orderNumber: 'ORD-008',
      saleId: 'sale-8',
      tableNumber: '17',
      orderType: 'DINE_IN',
      items: [
        {
          id: 'item-9',
          productId: '9',
          productName: 'Ice Cream',
          quantity: 1,
          status: KitchenOrderStatus.READY,
          station: 'Dessert'
        }
      ],
      status: KitchenOrderStatus.READY,
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      startedAt: new Date(Date.now() - 840000).toISOString(),
      readyAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      estimatedTime: 5,
      priority: 'NORMAL',
      serverName: 'Sarah',
      customerName: 'Table 17'
    },
    {
      id: '9',
      orderNumber: 'ORD-009',
      saleId: 'sale-9',
      tableNumber: '18',
      orderType: 'DINE_IN',
      items: [
        {
          id: 'item-10',
          productId: '10',
          productName: 'Ice Cream',
          quantity: 1,
          status: KitchenOrderStatus.READY,
          station: 'Dessert'
        }
      ],
      status: KitchenOrderStatus.READY,
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      startedAt: new Date(Date.now() - 840000).toISOString(),
      readyAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      estimatedTime: 5,
      priority: 'NORMAL',
      serverName: 'Sarah',
      customerName: 'Table 18'
    }
  ];

  constructor(
    private api: ApiService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.setupFilters();
    this.startTimers();
    
    // Auto-refresh disabled - will use real-time updates instead
    // if (this.autoRefresh) {
    //   this.startAutoRefresh();
    // }
    
    // Listen for view mode changes
    this.viewMode.valueChanges.subscribe(() => {
      if (this.viewMode.value === 'batch') {
        this.updateBatchCookingView();
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up fullscreen mode class
    document.body.classList.remove('kitchen-fullscreen-mode');
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.isLoading = true;

    // Mock API call
    setTimeout(() => {
      this.orders = this.mockOrders;
      this.applyFilters();
      if (this.viewMode.value === 'batch') {
        this.updateBatchCookingView();
      }
      this.isLoading = false;
    }, 500);

    // Real API call (uncomment when backend is ready)
    // this.api.get<KitchenOrder[]>('/kitchen/orders').subscribe({
    //   next: (orders) => {
    //     this.orders = orders;
    //     this.applyFilters();
    //     this.isLoading = false;
    //   },
    //   error: (error) => {
    //     this.notification.error('Failed to load orders');
    //     this.isLoading = false;
    //   }
    // });
  }

  setupFilters(): void {
    this.statusFilter.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.stationFilter.valueChanges.subscribe(() => {
      this.applyFilters();
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

  updateOrderStatus(order: KitchenOrder, status: KitchenOrderStatus): void {
    const oldStatus = order.status;
    order.status = status;
    
    // Update timestamps
    if (status === KitchenOrderStatus.IN_PROGRESS && !order.startedAt) {
      order.startedAt = new Date().toISOString();
    } else if (status === KitchenOrderStatus.READY && !order.readyAt) {
      order.readyAt = new Date().toISOString();
    } else if (status === KitchenOrderStatus.COMPLETED && !order.completedAt) {
      order.completedAt = new Date().toISOString();
    }

    // Update item statuses
    order.items.forEach(item => {
      if (item.status === KitchenOrderStatus.NEW && status === KitchenOrderStatus.IN_PROGRESS) {
        item.status = KitchenOrderStatus.IN_PROGRESS;
      } else if (status === KitchenOrderStatus.READY) {
        item.status = KitchenOrderStatus.READY;
      } else if (status === KitchenOrderStatus.COMPLETED) {
        item.status = KitchenOrderStatus.COMPLETED;
      }
    });

    // Mock API call
    this.notification.success(`Order ${order.orderNumber} status updated to ${status}`);

    // Real API call (uncomment when backend is ready)
    // this.api.patch(`/kitchen/orders/${order.id}/status`, { status }).subscribe({
    //   next: () => {
    //     this.notification.success(`Order ${order.orderNumber} status updated`);
    //     this.loadOrders();
    //   },
    //   error: (error) => {
    //     order.status = oldStatus; // Revert on error
    //     this.notification.error('Failed to update order status');
    //   }
    // });
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
}

