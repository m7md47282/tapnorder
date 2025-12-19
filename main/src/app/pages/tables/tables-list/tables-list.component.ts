import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { Table, TableStatus, Sale } from '../../../models/product.model';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { Router } from '@angular/router';
import { Subject, interval, takeUntil } from 'rxjs';
import { RealtimeOrdersService } from '../../../services/realtime-orders.service';
import { TenantContextService } from '../../../services/tenant-context.service';
import { OrderService } from '../../../services/order.service';
import { Order } from '../../../models/order.model';
import { TableService } from '../../../services/table.service';
import { MatDialog } from '@angular/material/dialog';
import { TableFormDialogComponent, TableFormData } from '../table-form-dialog/table-form-dialog.component';
import { LocalStorageService } from '../../../services/local-storage.service';

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
  
  private destroy$ = new Subject<void>();
  private refreshInterval$ = interval(5000);
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
    private localStorage: LocalStorageService
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

    const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
    
    this.realtimeSubscription = this.realtimeOrders
      .connectRealtimeOrders(this.currentPlaceId, statuses)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          orders.forEach(order => {
            this.ordersMap.set(order.id, order);
          });
          this.updateTablesWithOrders(orders);
        },
        error: (error) => {
          console.error('Real-time connection error:', error);
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
      if (order.tableId) {
        // Find table by tableId (which should match table.id or table.tableNumber)
        const table = this.tables.find(t => t.id === order.tableId || t.tableNumber === order.tableId);
        if (table) {
          if (order.status === 'PENDING' || order.status === 'CONFIRMED' || 
              order.status === 'PREPARING' || order.status === 'READY') {
            table.status = TableStatus.OCCUPIED;
            table.currentOrderId = order.id;
            table.seatedAt = order.createdAt instanceof Date 
              ? order.createdAt.toISOString() 
              : (typeof order.createdAt === 'string' ? order.createdAt : new Date().toISOString());
            
            table.currentOrder = {
              saleNumber: order.orderNumber,
              items: order.items.map(item => {
                // Handle both CartItem and OrderItemResponse structures
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
              subtotal: order.subtotal || 0,
              tax: order.tax || 0,
              discount: order.discount || 0,
              total: order.total,
              paymentMethod: this.mapPaymentMethod(order.paymentMethod),
              status: this.mapOrderStatusToSaleStatus(order.status),
              cashierId: order.userId || '',
              cashierName: order.customer?.name || 'Guest'
            };
            
            // Update table status via API
            if (table.status !== TableStatus.OCCUPIED) {
              this.tableService.updateTableStatus(table.id, TableStatus.OCCUPIED).subscribe({
                error: (err) => console.error('Error updating table status:', err)
              });
            }
          } else if (order.status === 'SERVED' || order.status === 'CANCELLED') {
            if (table.status === TableStatus.OCCUPIED) {
              table.status = TableStatus.CLEANING;
              table.currentOrderId = undefined;
              table.currentOrder = undefined;
              table.seatedAt = undefined;
              
              // Update table status via API
              this.tableService.updateTableStatus(table.id, TableStatus.CLEANING).subscribe({
                error: (err) => console.error('Error updating table status:', err)
              });
            }
          }
        }
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

  private mapOrderStatusToSaleStatus(status: string): any {
    switch (status) {
      case 'PENDING': return 'PENDING';
      case 'CONFIRMED': return 'PENDING';
      case 'PREPARING': return 'PENDING';
      case 'READY': return 'PENDING';
      case 'SERVED': return 'COMPLETED';
      case 'CANCELLED': return 'CANCELLED';
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
          this.loadOrdersForTables();
        }
        
        this.filterTables();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading tables:', error);
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
      placeId: this.currentPlaceId,
      status: ['pending', 'confirmed', 'preparing', 'ready'] as string[]
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
        error: (error) => {
          console.error('Error loading orders for tables:', error);
        }
      });
  }

  filterTables(): void {
    let filtered = this.tables;

    // Filter by status
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === this.statusFilter);
    }

    // Filter by search term
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
    console.log('openTableDetails', table);
    console.log('selectedTable', this.selectedTable);
    this.selectedTable = table;
    this.showTableDetails = true;
  }

  closeTableDetails(): void {
    this.showTableDetails = false;
    this.selectedTable = null;
  }

  openPOSForTable(table: Table): void {
    // Navigate to POS with table context
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
    const tablesPerRow = 6; // Number of tables per row
    
    for (let i = 0; i < tables.length; i += tablesPerRow) {
      const rowTables = tables.slice(i, i + tablesPerRow);
      const rowNumber = Math.floor(i / tablesPerRow);
      rows.push({
        label: String.fromCharCode(65 + rowNumber), // A, B, C, etc.
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
            console.error('Error creating table:', error);
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
            console.error('Error updating table:', error);
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
          console.error('Error deleting table:', error);
          this.notification.error('Failed to delete table');
        }
      });
    }
  }
}

