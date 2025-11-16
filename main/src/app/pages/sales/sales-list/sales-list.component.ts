import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Sale, SaleStatus, PaymentMethod } from '../../../models/product.model';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { SaleDetailDialogComponent } from '../sale-detail-dialog/sale-detail-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sales-list.component.html',
  styleUrls: ['./sales-list.component.scss']
})
export class SalesListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['saleNumber', 'date', 'customer', 'items', 'total', 'paymentMethod', 'status', 'actions'];
  dataSource = new MatTableDataSource<Sale>([]);
  
  searchControl = new FormControl('');
  statusFilter = new FormControl('all');
  paymentMethodFilter = new FormControl('all');
  dateRangeFilter = new FormControl('');
  
  isLoading: boolean = false;
  totalSales: number = 0;
  totalRevenue: number = 0;
  
  SaleStatus = SaleStatus;
  PaymentMethod = PaymentMethod;
  
  private destroy$ = new Subject<void>();

  // Mock data
  private mockSales: Sale[] = [
    {
      id: '1',
      saleNumber: 'SALE-001',
      customerName: 'John Doe',
      items: [],
      subtotal: 15.50,
      tax: 1.55,
      discount: 0,
      total: 17.05,
      paymentMethod: PaymentMethod.CASH,
      cashReceived: 20.00,
      change: 2.95,
      status: SaleStatus.COMPLETED,
      cashierId: '1',
      cashierName: 'admin',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: '2',
      saleNumber: 'SALE-002',
      customerName: 'Jane Smith',
      items: [],
      subtotal: 25.00,
      tax: 2.50,
      discount: 0,
      total: 27.50,
      paymentMethod: PaymentMethod.CARD,
      status: SaleStatus.COMPLETED,
      cashierId: '1',
      cashierName: 'admin',
      createdAt: new Date(Date.now() - 43200000).toISOString()
    },
    {
      id: '3',
      saleNumber: 'SALE-003',
      customerName: 'Walk-in Customer',
      items: [],
      subtotal: 8.50,
      tax: 0.85,
      discount: 0,
      total: 9.35,
      paymentMethod: PaymentMethod.MOBILE_PAYMENT,
      status: SaleStatus.COMPLETED,
      cashierId: '2',
      cashierName: 'cashier',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  constructor(
    private api: ApiService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadSales();
    this.setupFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupFilters(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.applyFilters();
      });

    this.statusFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });

    this.paymentMethodFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  loadSales(): void {
    this.isLoading = true;

    // Mock API call
    setTimeout(() => {
      this.dataSource.data = this.mockSales;
      this.calculateTotals();
      this.setupTable();
      this.isLoading = false;
    }, 500);

    // Real API call:
    // this.api.get<Sale[]>('/sales').subscribe({
    //   next: (sales) => {
    //     this.dataSource.data = sales;
    //     this.calculateTotals();
    //     this.setupTable();
    //     this.isLoading = false;
    //   },
    //   error: () => {
    //     this.isLoading = false;
    //   }
    // });
  }

  setupTable(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = this.customFilterPredicate;
  }

  customFilterPredicate = (data: Sale, filter: string): boolean => {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    const status = this.statusFilter.value || 'all';
    const paymentMethod = this.paymentMethodFilter.value || 'all';

    const matchesSearch: boolean = !searchTerm ||
      data.saleNumber.toLowerCase().includes(searchTerm) ||
      (data.customerName?.toLowerCase().includes(searchTerm) ?? false) ||
      (data.cashierName?.toLowerCase().includes(searchTerm) ?? false);

    const matchesStatus: boolean = status === 'all' || data.status === status;
    const matchesPayment: boolean = paymentMethod === 'all' || data.paymentMethod === paymentMethod;

    return matchesSearch && matchesStatus && matchesPayment;
  };

  applyFilters(): void {
    this.dataSource.filter = Math.random().toString();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.calculateTotals();
  }

  calculateTotals(): void {
    const filteredData = this.dataSource.filteredData;
    this.totalSales = filteredData.length;
    this.totalRevenue = filteredData.reduce((sum, sale) => sum + sale.total, 0);
  }

  viewDetails(sale: Sale): void {
    const dialogRef = this.dialog.open(SaleDetailDialogComponent, {
      width: '700px',
      data: { sale }
    });
  }

  printReceipt(sale: Sale): void {
    // Implement receipt printing
    this.notification.info('Printing receipt...');
    console.log('Print receipt:', sale);
  }

  refundSale(sale: Sale): void {
    if (sale.status === SaleStatus.REFUNDED) {
      this.notification.warning('This sale has already been refunded');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Refund Sale',
        message: `Are you sure you want to refund sale "${sale.saleNumber}"?`,
        confirmText: 'Refund',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;
        // Mock refund
        setTimeout(() => {
          const index = this.dataSource.data.findIndex(s => s.id === sale.id);
          if (index !== -1) {
            this.dataSource.data[index] = { ...this.dataSource.data[index], status: SaleStatus.REFUNDED };
            this.dataSource.data = [...this.dataSource.data];
            this.setupTable();
            this.calculateTotals();
            this.isLoading = false;
            this.notification.success('Sale refunded successfully');
          }
        }, 500);
      }
    });
  }

  getStatusColor(status: SaleStatus): string {
    const colors: Record<SaleStatus, string> = {
      [SaleStatus.PENDING]: 'accent',
      [SaleStatus.COMPLETED]: 'primary',
      [SaleStatus.CANCELLED]: 'warn',
      [SaleStatus.REFUNDED]: 'warn'
    };
    return colors[status] || 'primary';
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH]: 'Cash',
      [PaymentMethod.CARD]: 'Card',
      [PaymentMethod.MOBILE_PAYMENT]: 'Mobile',
      [PaymentMethod.CREDIT]: 'Credit',
      [PaymentMethod.MIXED]: 'Mixed'
    };
    return labels[method] || method;
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
