import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Product } from '../../../models/product.model';
import { Item } from '../../../models/item.model';
import { ApiService } from '../../../services/api.service';
import { ItemsService } from '../../../services/items.service';
import { NotificationService } from '../../../services/notification.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { ActivatedRoute } from '@angular/router';
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
  
  // Menu ID for items API
  menuId: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private itemsService: ItemsService,
    private notification: NotificationService,
    private localStorage: LocalStorageService,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Get menuId from route params or localStorage
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const newMenuId = params['menuId'] || this.localStorage.getItem<string>('menuId') || null;
      if (newMenuId !== this.menuId) {
        this.menuId = newMenuId;
        if (this.menuId) {
          this.localStorage.setItem('menuId', this.menuId);
        }
        this.loadProducts();
      }
    });
    
    // If no menuId in route, try localStorage
    if (!this.menuId) {
      this.menuId = this.localStorage.getItem<string>('menuId');
    }
    
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

    // Build query - menuId is optional
    const query: any = {};
    
    // Add menuId if available
    if (this.menuId) {
      query.menuId = this.menuId;
    }
    
    // Apply filters
    if (this.categoryFilter.value && this.categoryFilter.value !== 'all') {
      query.category = this.categoryFilter.value;
    }
    
    if (this.searchControl.value) {
      query.search = this.searchControl.value;
    }

    this.itemsService.getItems(query).subscribe({
      next: (items) => {
        // Convert Items to Products for display
        this.dataSource.data = items.map(item => this.itemToProduct(item));
        this.updateCategories();
        this.calculateStats();
        this.setupTable();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading items:', error);
        this.dataSource.data = [];
        this.updateCategories();
        this.calculateStats();
        this.setupTable();
        this.isLoading = false;
        this.notification.error('Failed to load products from the database. Please try again.');
      }
    });
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
    // Reload from API with filters (menuId is optional)
    this.loadProducts();
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

  /**
   * Convert Item model to Product model for display compatibility
   */
  private itemToProduct(item: Item): Product {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      sku: item.id.substring(0, 8).toUpperCase(), // Generate SKU from ID
      barcode: undefined,
      price: item.price,
      cost: undefined,
      stock: item.isAvailable ? 999 : 0, // Map isAvailable to stock (999 for available, 0 for unavailable)
      category: item.category,
      categoryId: undefined,
      image: item.imageUrl,
      isActive: item.isAvailable,
      taxRate: 0.1, // Default tax rate
      unit: 'item',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
