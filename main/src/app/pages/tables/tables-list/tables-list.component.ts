import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { Table, TableStatus, Sale } from '../../../models/product.model';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { RealtimeOrdersService } from '../../../services/realtime-orders.service';
import { TenantContextService } from '../../../services/tenant-context.service';
import { OrderService } from '../../../services/order.service';
import { Order, OrderStatus } from '../../../models/order.model';
import { TableService } from '../../../services/table.service';
import { MatDialog } from '@angular/material/dialog';
import { TableFormDialogComponent, TableFormData } from '../table-form-dialog/table-form-dialog.component';
import { LocalStorageService } from '../../../services/local-storage.service';
import { AuthService } from '../../../services/auth.service';
import { UserRole } from '../../../models/user.model';

@Component({
  selector: 'app-tables-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './tables-list.component.html',
  styleUrls: ['./tables-list.component.scss']
})
export class TablesListComponent implements OnInit, OnDestroy {
  tables: Table[] = [];
  filteredTables: Table[] = [];
  selectedTable: Table | null = null;
  showTableDetails: boolean = false;
  
  statusFilter: TableStatus | 'all' = 'all';
  searchTerm: string = '';
  
  isLoading: boolean = false;
  autoRefresh: boolean = false;
  
  TableStatus = TableStatus;
  OrderStatus = OrderStatus;
  
  private readonly ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY
  ] as const;
  
  private readonly MONITORED_ORDER_STATUSES: readonly OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.CANCELLED
  ] as const;
  
  private destroy$ = new Subject<void>();
  private currentPlaceId: string | null = null;
  private currentBranchId: string | null = null;
  private realtimeSubscription: any = null;
  private ordersMap: Map<string, Order> = new Map();

  constructor(
    private api: ApiService,
    private notification: NotificationService,
    private router: Router,
    private realtimeOrders: RealtimeOrdersService,
    private tenantContext: TenantContextService,
    private orderService: OrderService,
    private tableService: TableService,
    private dialog: MatDialog,
    private localStorage: LocalStorageService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.getPlaceId();
  }

  ngOnDestroy(): void {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
    this.realtimeOrders.disconnectAll();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getPlaceId(): void {
    this.tenantContext.currentPlaceId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(placeId => {
        if (placeId && placeId !== this.currentPlaceId) {
          this.currentPlaceId = placeId;
          const currentPlace = this.localStorage.getCurrentPlace<{ branchId?: string }>();
          this.currentBranchId = this.localStorage.getItem('pos_branchId') || 
                                  currentPlace?.branchId || 
                                  null;
          this.loadTables();
          this.connectRealtimeOrders();
        } else if (!placeId) {
          this.currentPlaceId = this.localStorage.getCurrentPlaceId();
          this.currentBranchId = this.localStorage.getItem('pos_branchId') || null;
          this.loadTables();
        }
      });
  }

  private connectRealtimeOrders(): void {
    if (!this.currentPlaceId) {
      return;
    }

    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }

    const statuses = this.MONITORED_ORDER_STATUSES.map(s => s.toLowerCase());
    
    this.realtimeSubscription = this.realtimeOrders
      .connectRealtimeOrders(this.currentPlaceId, statuses, this.currentBranchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          orders.forEach(order => {
            this.ordersMap.set(order.id, order);
          });
          this.updateTablesWithOrders(orders);
        },
        error: (error) => {
          setTimeout(() => {
            if (this.currentPlaceId) {
              this.loadOrdersForTables();
            }
          }, 2000);
        }
      });

    this.realtimeOrders.getOrderUpdate$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(order => {
        this.ordersMap.set(order.id, order);
        this.updateTablesWithOrders([order]);
      });
  }

  private updateTablesWithOrders(orders: Order[]): void {
    orders.forEach(order => {
      this.ordersMap.set(order.id, order);
    });

    this.tables.forEach(table => {
      console.log('table', table);
      const tableOrders = Array.from(this.ordersMap.values()).filter(order => {
        console.log('order', order);
        if (!order.tableId) return false;
        const orderTableId = String(order.tableId).trim();
        const tableId = String(table.id).trim();
        return orderTableId === tableId;
      });

      const activeOrders = tableOrders.filter(order => 
        this.ACTIVE_ORDER_STATUSES.includes(order.status)
      );

      if (activeOrders.length > 0) {
        const mostRecentActiveOrder = activeOrders.reduce((latest, current) => {
          const latestDate = latest.createdAt instanceof Date ? latest.createdAt : new Date(latest.createdAt);
          const currentDate = current.createdAt instanceof Date ? current.createdAt : new Date(current.createdAt);
          return currentDate > latestDate ? current : latest;
        });

        const previousStatus = table.status;
        table.status = TableStatus.OCCUPIED;
        table.currentOrderId = mostRecentActiveOrder.id;
        table.seatedAt = mostRecentActiveOrder.createdAt instanceof Date 
          ? mostRecentActiveOrder.createdAt.toISOString() 
          : (typeof mostRecentActiveOrder.createdAt === 'string' 
              ? mostRecentActiveOrder.createdAt 
              : new Date().toISOString());
        
        table.currentOrder = {
          saleNumber: mostRecentActiveOrder.orderNumber,
          items: mostRecentActiveOrder.items.map(item => {
            const itemPrice = (item as any).itemPrice || (item as any).price || 0;
            const totalPrice = (item as any).totalPrice || (itemPrice * item.quantity);
            return {
              product: (item as any).item || (item as any).product || {} as any,
              quantity: item.quantity,
              price: itemPrice,
              subtotal: totalPrice,
              total: totalPrice,
              tax: 0,
              discount: 0
            };
          }),
          subtotal: mostRecentActiveOrder.subtotal || 0,
          tax: mostRecentActiveOrder.tax || 0,
          discount: mostRecentActiveOrder.discount || 0,
          total: mostRecentActiveOrder.total,
          paymentMethod: this.mapPaymentMethod(mostRecentActiveOrder.paymentMethod),
          status: this.mapOrderStatusToSaleStatus(mostRecentActiveOrder.status),
          cashierId: mostRecentActiveOrder.userId || '',
          cashierName: mostRecentActiveOrder.customer?.name || 'Guest'
        };
        
        if (previousStatus !== TableStatus.OCCUPIED) {
          this.tableService.updateTableStatus(table.id, TableStatus.OCCUPIED).subscribe({
            next: (updatedTable) => {
              const index = this.tables.findIndex(t => t.id === table.id);
              if (index !== -1) {
                this.tables[index] = { ...this.tables[index], ...updatedTable };
                // Update selectedTable if it's the same table
                if (this.selectedTable?.id === table.id) {
                  this.selectedTable = this.tables[index];
                }
                this.filterTables();
              }
            },
            error: (err) => {}
          });
        } else {
          const index = this.tables.findIndex(t => t.id === table.id);
          if (index !== -1) {
            this.tables[index] = table;
            // Update selectedTable if it's the same table
            if (this.selectedTable?.id === table.id) {
              this.selectedTable = this.tables[index];
            }
            this.filterTables();
          }
        }
      } else if (tableOrders.length > 0) {
        if (table.status === TableStatus.OCCUPIED) {
          table.status = TableStatus.CLEANING;
          table.currentOrderId = undefined;
          table.currentOrder = undefined;
          table.seatedAt = undefined;
          
          this.tableService.updateTableStatus(table.id, TableStatus.CLEANING).subscribe({
            next: (updatedTable) => {
              const index = this.tables.findIndex(t => t.id === table.id);
              if (index !== -1) {
                this.tables[index] = { ...this.tables[index], ...updatedTable };
                // Update selectedTable if it's the same table
                if (this.selectedTable?.id === table.id) {
                  this.selectedTable = this.tables[index];
                }
                this.filterTables();
              }
            },
            error: (err) => {}
          });
        }
      } else if (tableOrders.length === 0 && table.status === TableStatus.OCCUPIED) {
        table.status = TableStatus.CLEANING;
        table.currentOrderId = undefined;
        table.currentOrder = undefined;
        table.seatedAt = undefined;
        
        this.tableService.updateTableStatus(table.id, TableStatus.CLEANING).subscribe({
          next: (updatedTable) => {
            const index = this.tables.findIndex(t => t.id === table.id);
            if (index !== -1) {
              this.tables[index] = { ...this.tables[index], ...updatedTable };
              // Update selectedTable if it's the same table
              if (this.selectedTable?.id === table.id) {
                this.selectedTable = this.tables[index];
              }
              this.filterTables();
            }
          },
          error: (err) => {}
        });
      }
    });
    
    this.filterTables();
  }

  private mapPaymentMethod(method?: string): any {
    switch (method?.toLowerCase()) {
      case 'cash': return 'CASH';
      case 'card': return 'CARD';
      case 'digital_wallet': return 'MOBILE_PAYMENT';
      default: return 'CASH';
    }
  }

  private mapOrderStatusToSaleStatus(status: OrderStatus | string): any {
    switch (status) {
      case OrderStatus.PENDING: return 'PENDING';
      case OrderStatus.CONFIRMED: return 'CONFIRMED';
      case OrderStatus.PREPARING: return 'PREPARING';
      case OrderStatus.READY: return 'READY';
      case OrderStatus.SERVED: return 'COMPLETED';
      case OrderStatus.CANCELLED: return 'CANCELLED';
      default: return 'PENDING';
    }
  }

  loadTables(): void {
    if (!this.currentPlaceId) {
      this.isLoading = false;
      this.tables = [];
      this.filterTables();
      return;
    }

    this.isLoading = true;
    
    const query: any = {
      placeId: this.currentPlaceId,
      isActive: true
    };

    if (this.currentBranchId) {
      query.branchId = this.currentBranchId;
    }

    this.tableService.getTables(query).subscribe({
      next: (tables) => {
        this.tables = tables;
        
        if (this.currentPlaceId) {
          setTimeout(() => {
            this.loadOrdersForTables();
          }, 500);
        }
        
        this.filterTables();
        this.isLoading = false;
      },
      error: (error) => {
        this.notification.error('Failed to load tables');
        this.tables = [];
        this.filterTables();
        this.isLoading = false;
      }
    });
  }

  private loadOrdersForTables(): void {
    if (!this.currentPlaceId) return;

    const query = {
      placeId: this.currentPlaceId
    };

    this.orderService.fetchOrders(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          orders.forEach(order => {
            this.ordersMap.set(order.id, order);
          });
          this.updateTablesWithOrders(orders);
        },
        error: (error) => {}
      });
  }

  refreshTableStatuses(): void {
    if (!this.currentPlaceId) {
      return;
    }
    
    setTimeout(() => {
      this.loadOrdersForTables();
    }, 1000);
  }

  private loadTableOrders(table: Table): void {
    if (!this.currentPlaceId || !table.id) return;

    const query = {
      placeId: this.currentPlaceId
    };

    this.orderService.fetchOrders(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          // Filter orders for this specific table
          const tableOrders = orders.filter(order => {
            if (!order.tableId) return false;
            const orderTableId = String(order.tableId).trim();
            const tableId = String(table.id).trim();
            return orderTableId === tableId;
          });

          // Update ordersMap
          tableOrders.forEach(order => {
            this.ordersMap.set(order.id, order);
          });

          // Update the selected table with the latest order information
          if (tableOrders.length > 0) {
            const activeOrders = tableOrders.filter(order => 
              this.ACTIVE_ORDER_STATUSES.includes(order.status)
            );

            if (activeOrders.length > 0) {
              // Get the most recent active order
              const mostRecentActiveOrder = activeOrders.reduce((latest, current) => {
                const latestDate = latest.createdAt instanceof Date ? latest.createdAt : new Date(latest.createdAt);
                const currentDate = current.createdAt instanceof Date ? current.createdAt : new Date(current.createdAt);
                return currentDate > latestDate ? current : latest;
              });

              // Update the table in the tables array first
              const tableIndex = this.tables.findIndex(t => t.id === table.id);
              if (tableIndex !== -1) {
                const updatedTable = {
                  ...this.tables[tableIndex],
                  status: TableStatus.OCCUPIED,
                  currentOrderId: mostRecentActiveOrder.id,
                  seatedAt: mostRecentActiveOrder.createdAt instanceof Date 
                    ? mostRecentActiveOrder.createdAt.toISOString() 
                    : (typeof mostRecentActiveOrder.createdAt === 'string' 
                        ? mostRecentActiveOrder.createdAt 
                        : new Date().toISOString()),
                  currentOrder: {
                    saleNumber: mostRecentActiveOrder.orderNumber,
                    items: mostRecentActiveOrder.items.map(item => {
                      const itemPrice = (item as any).itemPrice || (item as any).price || 0;
                      const totalPrice = (item as any).totalPrice || (itemPrice * item.quantity);
                      return {
                        product: (item as any).item || (item as any).product || {} as any,
                        quantity: item.quantity,
                        price: itemPrice,
                        subtotal: totalPrice,
                        total: totalPrice,
                        tax: 0,
                        discount: 0
                      };
                    }),
                    subtotal: mostRecentActiveOrder.subtotal || 0,
                    tax: mostRecentActiveOrder.tax || 0,
                    discount: mostRecentActiveOrder.discount || 0,
                    total: mostRecentActiveOrder.total,
                    paymentMethod: this.mapPaymentMethod(mostRecentActiveOrder.paymentMethod),
                    status: this.mapOrderStatusToSaleStatus(mostRecentActiveOrder.status),
                    cashierId: mostRecentActiveOrder.userId || '',
                    cashierName: mostRecentActiveOrder.customer?.name || 'Guest'
                  }
                };
                
                this.tables[tableIndex] = updatedTable;
                
                // Update selectedTable to point to the updated table
                if (this.selectedTable && this.selectedTable.id === table.id) {
                  this.selectedTable = updatedTable;
                }
              }
            } else {
              // No active orders, but there are orders (likely completed/cancelled)
              const tableIndex = this.tables.findIndex(t => t.id === table.id);
              if (tableIndex !== -1 && this.tables[tableIndex].status === TableStatus.OCCUPIED) {
                const updatedTable = {
                  ...this.tables[tableIndex],
                  status: TableStatus.CLEANING,
                  currentOrderId: undefined,
                  currentOrder: undefined,
                  seatedAt: undefined
                };
                this.tables[tableIndex] = updatedTable;
                
                // Update selectedTable to point to the updated table
                if (this.selectedTable && this.selectedTable.id === table.id) {
                  this.selectedTable = updatedTable;
                }
              }
            }
          } else {
            // No orders found for this table
            const tableIndex = this.tables.findIndex(t => t.id === table.id);
            if (tableIndex !== -1) {
              const updatedTable = {
                ...this.tables[tableIndex],
                status: TableStatus.AVAILABLE,
                currentOrderId: undefined,
                currentOrder: undefined,
                seatedAt: undefined
              };
              this.tables[tableIndex] = updatedTable;
              
              // Update selectedTable to point to the updated table
              if (this.selectedTable && this.selectedTable.id === table.id) {
                this.selectedTable = updatedTable;
              }
            }
          }
        },
        error: (error) => {
          console.error('Error loading table orders:', error);
        }
      });
  }

  filterTables(): void {
    let filtered = this.tables;

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === this.statusFilter);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.tableNumber.toLowerCase().includes(term) ||
        t.location?.toLowerCase().includes(term) ||
        t.serverName?.toLowerCase().includes(term)
      );
    }

    this.filteredTables = filtered;
  }

  onStatusFilterChange(status: TableStatus | 'all'): void {
    this.statusFilter = status;
    this.filterTables();
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.filterTables();
  }

  getStatusColor(status: TableStatus): string {
    const colors: Record<TableStatus, string> = {
      [TableStatus.AVAILABLE]: 'primary',
      [TableStatus.OCCUPIED]: 'warn',
      [TableStatus.RESERVED]: 'accent',
      [TableStatus.CLEANING]: '',
      [TableStatus.OUT_OF_SERVICE]: 'warn'
    };
    return colors[status] || '';
  }

  getStatusIcon(status: TableStatus): string {
    const icons: Record<TableStatus, string> = {
      [TableStatus.AVAILABLE]: 'check_circle',
      [TableStatus.OCCUPIED]: 'restaurant',
      [TableStatus.RESERVED]: 'event',
      [TableStatus.CLEANING]: 'cleaning_services',
      [TableStatus.OUT_OF_SERVICE]: 'block'
    };
    return icons[status] || 'help';
  }

  openTableDetails(table: Table): void {
    this.selectedTable = table;
    this.showTableDetails = true;
    console.log('Modal opened - selectedTable:', this.selectedTable);
    // Fetch fresh orders for this table when modal opens
    this.loadTableOrders(table);
  }

  closeTableDetails(): void {
    this.showTableDetails = false;
    this.selectedTable = null;
  }

  openPOSForTable(table: Table): void {
    this.router.navigate(['/pos'], { queryParams: { tableId: table.id, tableNumber: table.tableNumber } });
  }

  getSeatedTime(table: Table): string {
    if (!table.seatedAt) return '';
    const seated = new Date(table.seatedAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - seated.getTime()) / 60000);
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    }
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  getReservationTime(table: Table): string {
    if (!table.reservationTime) return '';
    const reservation = new Date(table.reservationTime);
    return reservation.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  isAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    return user.role === UserRole.SUPER_ADMIN || user.role === UserRole.RESTAURANT_MANAGER;
  }

  getAvailableStatuses(): TableStatus[] {
    return [
      TableStatus.AVAILABLE,
      TableStatus.OCCUPIED,
      TableStatus.RESERVED,
      TableStatus.CLEANING,
      TableStatus.OUT_OF_SERVICE
    ];
  }

  updateTableStatusInModal(newStatus: TableStatus): void {
    if (!this.selectedTable) return;

    // Prevent changing status if table is occupied and has active orders
    if (this.selectedTable.status === TableStatus.OCCUPIED && 
        newStatus !== TableStatus.OCCUPIED && 
        this.selectedTable.currentOrder) {
      this.notification.warning('Cannot change status: Table has an active order');
      return;
    }

    this.tableService.updateTableStatus(this.selectedTable.id, newStatus).subscribe({
      next: (updatedTable) => {
        // Update the table in the tables array
        const index = this.tables.findIndex(t => t.id === updatedTable.id);
        if (index !== -1) {
          this.tables[index] = updatedTable;
          this.filterTables();
        }
        
        // Update selectedTable
        this.selectedTable = updatedTable;
        
        this.notification.success(`Table status updated to ${newStatus}`);
      },
      error: (error) => {
        this.notification.error('Failed to update table status');
        console.error('Error updating table status:', error);
      }
    });
  }

  getLocations(): string[] {
    const locations = new Set(this.filteredTables.map(t => t.location || 'Main Area'));
    return Array.from(locations).sort();
  }

  getTablesByLocation(location: string): Table[] {
    return this.filteredTables.filter(t => (t.location || 'Main Area') === location);
  }

  getTableRows(location: string): { label: string; tables: Table[] }[] {
    const tables = this.getTablesByLocation(location);
    const rows: { label: string; tables: Table[] }[] = [];
    const tablesPerRow = 6;
    
    for (let i = 0; i < tables.length; i += tablesPerRow) {
      const rowTables = tables.slice(i, i + tablesPerRow);
      const rowNumber = Math.floor(i / tablesPerRow);
      rows.push({
        label: String.fromCharCode(65 + rowNumber),
        tables: rowTables
      });
    }
    
    return rows;
  }

  getTableTooltip(table: Table): string {
    let tooltip = `Table ${table.tableNumber} - ${table.capacity} seats\nStatus: ${table.status}`;
    if (table.serverName) {
      tooltip += `\nServer: ${table.serverName}`;
    }
    if (table.currentOrder) {
      tooltip += `\nOrder: ${table.currentOrder.saleNumber} - $${table.currentOrder.total.toFixed(2)}`;
    }
    if (table.seatedAt) {
      tooltip += `\nSeated: ${this.getSeatedTime(table)} ago`;
    }
    return tooltip;
  }

  openCreateTableDialog(): void {
    const dialogRef = this.dialog.open(TableFormDialogComponent, {
      width: '600px',
      data: { table: null }
    });

    dialogRef.afterClosed().subscribe((result: TableFormData | undefined) => {
      if (result) {
        this.tableService.createTable(result).subscribe({
          next: (newTable) => {
            this.notification.success('Table created successfully');
            this.loadTables();
          },
          error: (error) => {
            this.notification.error('Failed to create table');
          }
        });
      }
    });
  }

  openEditTableDialog(table: Table): void {
    const dialogRef = this.dialog.open(TableFormDialogComponent, {
      width: '600px',
      data: { table }
    });

    dialogRef.afterClosed().subscribe((result: TableFormData | undefined) => {
      if (result) {
        this.tableService.updateTable({ id: table.id, ...result }).subscribe({
          next: (updatedTable) => {
            this.notification.success('Table updated successfully');
            this.loadTables();
            if (this.selectedTable?.id === table.id) {
              this.selectedTable = updatedTable;
            }
          },
          error: (error) => {
            this.notification.error('Failed to update table');
          }
        });
      }
    });
  }

  deleteTable(table: Table): void {
    if (table.status === TableStatus.OCCUPIED) {
      this.notification.error('Cannot delete table with active order');
      return;
    }

    if (confirm(`Are you sure you want to delete table ${table.tableNumber}?`)) {
      this.tableService.deleteTable(table.id).subscribe({
        next: () => {
          this.notification.success('Table deleted successfully');
          this.loadTables();
          if (this.selectedTable?.id === table.id) {
            this.closeTableDetails();
          }
        },
        error: (error) => {
          this.notification.error('Failed to delete table');
        }
      });
    }
  }
}

