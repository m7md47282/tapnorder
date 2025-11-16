import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { Table, TableStatus, Sale } from '../../../models/product.model';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { Router } from '@angular/router';
import { Subject, interval, takeUntil } from 'rxjs';

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
  private refreshInterval$ = interval(5000); // Refresh every 5 seconds

  // Mock data for development
  private mockTables: Table[] = [
    {
      id: '1',
      tableNumber: '1',
      capacity: 2,
      status: TableStatus.OCCUPIED,
      currentOrderId: 'sale-1',
      serverName: 'John Doe',
      seatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      location: 'Indoor',
      isActive: true,
      currentOrder: {
        saleNumber: 'SALE-001',
        items: [],
        subtotal: 45.50,
        tax: 4.55,
        discount: 0,
        total: 50.05,
        paymentMethod: 'CASH' as any,
        status: 'COMPLETED' as any,
        cashierId: '1',
        cashierName: 'Cashier'
      }
    },
    {
      id: '2',
      tableNumber: '2',
      capacity: 4,
      status: TableStatus.AVAILABLE,
      location: 'Indoor',
      isActive: true
    },
    {
      id: '3',
      tableNumber: '3',
      capacity: 4,
      status: TableStatus.RESERVED,
      reservationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      location: 'Outdoor',
      isActive: true
    },
    {
      id: '4',
      tableNumber: '4',
      capacity: 6,
      status: TableStatus.OCCUPIED,
      currentOrderId: 'sale-2',
      serverName: 'Jane Smith',
      seatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      location: 'Indoor',
      isActive: true,
      currentOrder: {
        saleNumber: 'SALE-002',
        items: [],
        subtotal: 78.00,
        tax: 7.80,
        discount: 5.00,
        total: 80.80,
        paymentMethod: 'CARD' as any,
        status: 'PENDING' as any,
        cashierId: '1',
        cashierName: 'Cashier'
      }
    },
    {
      id: '5',
      tableNumber: '5',
      capacity: 2,
      status: TableStatus.CLEANING,
      location: 'Bar Area',
      isActive: true
    },
    {
      id: '6',
      tableNumber: '6',
      capacity: 8,
      status: TableStatus.AVAILABLE,
      location: 'Indoor',
      isActive: true
    },
    {
      id: '7',
      tableNumber: '7',
      capacity: 4,
      status: TableStatus.OCCUPIED,
      currentOrderId: 'sale-3',
      serverName: 'Mike Johnson',
      seatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      location: 'Outdoor',
      isActive: true,
      currentOrder: {
        saleNumber: 'SALE-003',
        items: [],
        subtotal: 120.50,
        tax: 12.05,
        discount: 0,
        total: 132.55,
        paymentMethod: 'CARD' as any,
        status: 'PENDING' as any,
        cashierId: '1',
        cashierName: 'Cashier'
      }
    },
    {
      id: '8',
      tableNumber: '8',
      capacity: 2,
      status: TableStatus.AVAILABLE,
      location: 'Indoor',
      isActive: true
    }
  ];

  constructor(
    private api: ApiService,
    private notification: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTables();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupAutoRefresh(): void {
    if (this.autoRefresh) {
      this.refreshInterval$
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadTables();
        });
    }
  }

  loadTables(): void {
    this.isLoading = true;
    
    // Mock API call - replace with real API
    setTimeout(() => {
      this.tables = this.mockTables;
      this.filterTables();
      this.isLoading = false;
    }, 500);

    // Real API call (uncomment when backend is ready):
    // this.api.get<Table[]>('/tables').subscribe({
    //   next: (tables) => {
    //     this.tables = tables;
    //     this.filterTables();
    //     this.isLoading = false;
    //   },
    //   error: () => {
    //     this.isLoading = false;
    //   }
    // });
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
}

