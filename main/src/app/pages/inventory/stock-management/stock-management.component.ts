import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Product } from '../../../models/product.model';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { StockAdjustmentDialogComponent } from '../stock-adjustment-dialog/stock-adjustment-dialog.component';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

@Component({
  selector: 'app-stock-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './stock-management.component.html',
  styleUrls: ['./stock-management.component.scss']
})
export class StockManagementComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['image', 'name', 'sku', 'currentStock', 'lowStockAlert', 'value', 'actions'];
  dataSource = new MatTableDataSource<Product>([]);
  
  searchControl = new FormControl('');
  categoryFilter = new FormControl('all');
  stockFilter = new FormControl('all');
  
  categories: string[] = ['all'];
  isLoading: boolean = false;
  lowStockThreshold: number = 10;
  
  totalProducts: number = 0;
  totalStockValue: number = 0;
  lowStockCount: number = 0;
  
  private destroy$ = new Subject<void>();

  // Mock data
  private mockProducts: Product[] = [
    { id: '1', name: 'Coca Cola 500ml', sku: 'CC500', price: 2.50, cost: 1.50, stock: 100, category: 'Beverages', image: '/assets/images/products/product-1.png', isActive: true },
    { id: '2', name: 'Bread White', sku: 'BR001', price: 1.50, cost: 0.80, stock: 5, category: 'Food', image: '/assets/images/products/product-2.png', isActive: true },
    { id: '3', name: 'Milk 1L', sku: 'ML001', price: 3.00, cost: 2.00, stock: 75, category: 'Dairy', image: '/assets/images/products/product-3.png', isActive: true },
    { id: '4', name: 'Eggs Dozen', sku: 'EG001', price: 4.50, cost: 3.00, stock: 0, category: 'Dairy', image: '/assets/images/products/product-4.png', isActive: true },
    { id: '5', name: 'Rice 1kg', sku: 'RC001', price: 5.00, cost: 3.50, stock: 40, category: 'Food', image: '/assets/images/products/s11.jpg', isActive: true },
  ];

  constructor(
    private api: ApiService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadProducts();
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

    this.categoryFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });

    this.stockFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  loadProducts(): void {
    this.isLoading = true;

    // Mock API call
    setTimeout(() => {
      this.dataSource.data = this.mockProducts;
      this.updateCategories();
      this.calculateStats();
      this.setupTable();
      this.isLoading = false;
    }, 500);
  }

  setupTable(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = this.customFilterPredicate;
  }

  customFilterPredicate = (data: Product, filter: string): boolean => {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    const category = this.categoryFilter.value || 'all';
    const stockFilter = this.stockFilter.value || 'all';

    const matchesSearch: boolean = !searchTerm ||
      data.name.toLowerCase().includes(searchTerm) ||
      data.sku.toLowerCase().includes(searchTerm);

    const matchesCategory: boolean = category === 'all' || data.category === category;

    let matchesStock: boolean = true;
    if (stockFilter === 'low') {
      matchesStock = data.stock < this.lowStockThreshold;
    } else if (stockFilter === 'out') {
      matchesStock = data.stock === 0;
    }

    return matchesSearch && matchesCategory && matchesStock;
  };

  applyFilters(): void {
    this.dataSource.filter = Math.random().toString();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.calculateStats();
  }

  updateCategories(): void {
    const cats = new Set(this.dataSource.data.map(p => p.category || 'Uncategorized'));
    this.categories = ['all', ...Array.from(cats).sort()];
  }

  calculateStats(): void {
    const filteredData = this.dataSource.filteredData;
    this.totalProducts = filteredData.length;
    this.totalStockValue = filteredData.reduce((sum, p) => sum + (p.stock * (p.cost || p.price)), 0);
    this.lowStockCount = filteredData.filter(p => p.stock < this.lowStockThreshold).length;
  }

  adjustStock(product: Product): void {
    const dialogRef = this.dialog.open(StockAdjustmentDialogComponent, {
      width: '500px',
      data: { product }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateStock(product.id, result.quantity, result.reason, result.type);
      }
    });
  }

  updateStock(productId: string, quantity: number, reason: string, type: 'IN' | 'OUT' | 'ADJUSTMENT'): void {
    this.isLoading = true;

    // Mock update
    setTimeout(() => {
      const index = this.dataSource.data.findIndex(p => p.id === productId);
      if (index !== -1) {
        const product = this.dataSource.data[index];
        let newStock = product.stock;
        
        if (type === 'IN') {
          newStock = product.stock + quantity;
        } else if (type === 'OUT') {
          newStock = Math.max(0, product.stock - quantity);
        } else {
          newStock = quantity;
        }

        this.dataSource.data[index] = {
          ...product,
          stock: newStock
        };
        this.dataSource.data = [...this.dataSource.data];
        this.setupTable();
        this.calculateStats();
        this.isLoading = false;
        this.notification.success('Stock updated successfully');
      }
    }, 500);
  }

  getStockStatus(stock: number): { label: string; color: string; class: string } {
    if (stock === 0) {
      return { label: 'Out of Stock', color: 'warn', class: 'out-of-stock' };
    } else if (stock < this.lowStockThreshold) {
      return { label: 'Low Stock', color: 'accent', class: 'low-stock' };
    } else {
      return { label: 'In Stock', color: 'primary', class: 'in-stock' };
    }
  }

  getStockValue(product: Product): number {
    return (product.cost || product.price) * product.stock;
  }
}
