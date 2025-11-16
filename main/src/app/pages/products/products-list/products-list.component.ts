import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Product } from '../../../models/product.model';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ProductFormDialogComponent } from '../product-form-dialog/product-form-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.scss']
})
export class ProductsListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['image', 'name', 'sku', 'category', 'price', 'stock', 'status', 'actions'];
  dataSource = new MatTableDataSource<Product>([]);
  
  searchControl = new FormControl('');
  categoryFilter = new FormControl('all');
  statusFilter = new FormControl('all');
  
  categories: string[] = ['all'];
  isLoading: boolean = false;
  
  private destroy$ = new Subject<void>();

  // Mock data for development
  private mockProducts: Product[] = [
    { id: '1', name: 'Coca Cola 500ml', sku: 'CC500', price: 2.50, cost: 1.50, stock: 100, category: 'Beverages', barcode: '1234567890123', image: '/assets/images/products/product-1.png', isActive: true, taxRate: 0.1, unit: 'bottle', description: 'Carbonated soft drink' },
    { id: '2', name: 'Bread White', sku: 'BR001', price: 1.50, cost: 0.80, stock: 50, category: 'Food', barcode: '1234567890124', image: '/assets/images/products/product-2.png', isActive: true, taxRate: 0.1, unit: 'loaf', description: 'Fresh white bread' },
    { id: '3', name: 'Milk 1L', sku: 'ML001', price: 3.00, cost: 2.00, stock: 75, category: 'Dairy', barcode: '1234567890125', image: '/assets/images/products/product-3.png', isActive: true, taxRate: 0.1, unit: 'bottle', description: 'Fresh whole milk' },
    { id: '4', name: 'Eggs Dozen', sku: 'EG001', price: 4.50, cost: 3.00, stock: 30, category: 'Dairy', barcode: '1234567890126', image: '/assets/images/products/product-4.png', isActive: true, taxRate: 0.1, unit: 'dozen', description: 'Fresh eggs' },
    { id: '5', name: 'Rice 1kg', sku: 'RC001', price: 5.00, cost: 3.50, stock: 40, category: 'Food', barcode: '1234567890127', image: '/assets/images/products/s11.jpg', isActive: true, taxRate: 0.1, unit: 'kg', description: 'Premium rice' },
    { id: '6', name: 'Sugar 1kg', sku: 'SG001', price: 2.00, cost: 1.20, stock: 60, category: 'Food', barcode: '1234567890128', image: '/assets/images/products/s4.jpg', isActive: true, taxRate: 0.1, unit: 'kg', description: 'White granulated sugar' },
    { id: '7', name: 'Coffee 250g', sku: 'CF001', price: 8.50, cost: 5.00, stock: 25, category: 'Beverages', barcode: '1234567890129', image: '/assets/images/products/s5.jpg', isActive: true, taxRate: 0.1, unit: 'pack', description: 'Premium coffee beans' },
    { id: '8', name: 'Tea 100g', sku: 'TE001', price: 3.50, cost: 2.00, stock: 45, category: 'Beverages', barcode: '1234567890130', image: '/assets/images/products/s6.jpg', isActive: true, taxRate: 0.1, unit: 'pack', description: 'Black tea leaves' },
    { id: '9', name: 'Chicken 1kg', sku: 'CK001', price: 12.00, cost: 8.00, stock: 20, category: 'Meat', barcode: '1234567890131', image: '/assets/images/products/s7.jpg', isActive: true, taxRate: 0.1, unit: 'kg', description: 'Fresh chicken' },
    { id: '10', name: 'Beef 1kg', sku: 'BF001', price: 18.00, cost: 12.00, stock: 15, category: 'Meat', barcode: '1234567890132', image: '/assets/images/products/s9.jpg', isActive: false, taxRate: 0.1, unit: 'kg', description: 'Premium beef' },
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
    // Search filter
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.applyFilters();
      });

    // Category filter
    this.categoryFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });

    // Status filter
    this.statusFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  loadProducts(): void {
    this.isLoading = true;

    // Mock API call - replace with real API
    setTimeout(() => {
      this.dataSource.data = this.mockProducts;
      this.updateCategories();
      this.setupTable();
      this.isLoading = false;
    }, 500);

    // Real API call (uncomment when backend is ready):
    // this.api.get<Product[]>('/products').subscribe({
    //   next: (products) => {
    //     this.dataSource.data = products;
    //     this.updateCategories();
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

  customFilterPredicate = (data: Product, filter: string): boolean => {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    const category = this.categoryFilter.value || 'all';
    const status = this.statusFilter.value || 'all';

    // Search filter
    const matchesSearch: boolean = !searchTerm ||
      data.name.toLowerCase().includes(searchTerm) ||
      data.sku.toLowerCase().includes(searchTerm) ||
      (data.barcode?.toLowerCase().includes(searchTerm) ?? false) ||
      (data.category?.toLowerCase().includes(searchTerm) ?? false);

    // Category filter
    const matchesCategory: boolean = category === 'all' || data.category === category;

    // Status filter
    const matchesStatus: boolean = status === 'all' ||
      (status === 'active' && data.isActive) ||
      (status === 'inactive' && !data.isActive) ||
      (status === 'low-stock' && data.stock < 10);

    return matchesSearch && matchesCategory && matchesStatus;
  };

  applyFilters(): void {
    this.dataSource.filter = Math.random().toString(); // Trigger filter
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  updateCategories(): void {
    const cats = new Set(this.dataSource.data.map(p => p.category || 'Uncategorized'));
    this.categories = ['all', ...Array.from(cats).sort()];
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(ProductFormDialogComponent, {
      width: '600px',
      data: { product: null }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.createProduct(result);
      }
    });
  }

  openEditDialog(product: Product): void {
    const dialogRef = this.dialog.open(ProductFormDialogComponent, {
      width: '600px',
      data: { product: { ...product } }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateProduct(product.id, result);
      }
    });
  }

  createProduct(productData: Partial<Product>): void {
    this.isLoading = true;

    // Mock creation
    const newProduct: Product = {
      ...productData as Product,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setTimeout(() => {
      this.dataSource.data = [...this.dataSource.data, newProduct];
      this.updateCategories();
      this.setupTable();
      this.isLoading = false;
      this.notification.success('Product created successfully');
    }, 500);

    // Real API call:
    // this.api.post<Product>('/products', productData).subscribe({
    //   next: (product) => {
    //     this.dataSource.data = [...this.dataSource.data, product];
    //     this.updateCategories();
    //     this.setupTable();
    //     this.isLoading = false;
    //     this.notification.success('Product created successfully');
    //   },
    //   error: () => {
    //     this.isLoading = false;
    //   }
    // });
  }

  updateProduct(id: string, productData: Partial<Product>): void {
    this.isLoading = true;

    // Mock update
    setTimeout(() => {
      const index = this.dataSource.data.findIndex(p => p.id === id);
      if (index !== -1) {
        this.dataSource.data[index] = {
          ...this.dataSource.data[index],
          ...productData,
          id,
          updatedAt: new Date().toISOString()
        };
        this.dataSource.data = [...this.dataSource.data];
        this.setupTable();
        this.isLoading = false;
        this.notification.success('Product updated successfully');
      }
    }, 500);

    // Real API call:
    // this.api.put<Product>(`/products/${id}`, productData).subscribe({
    //   next: (product) => {
    //     const index = this.dataSource.data.findIndex(p => p.id === id);
    //     if (index !== -1) {
    //       this.dataSource.data[index] = product;
    //       this.dataSource.data = [...this.dataSource.data];
    //       this.setupTable();
    //       this.isLoading = false;
    //       this.notification.success('Product updated successfully');
    //     }
    //   },
    //   error: () => {
    //     this.isLoading = false;
    //   }
    // });
  }

  deleteProduct(product: Product): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Product',
        message: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;

        // Mock deletion
        setTimeout(() => {
          this.dataSource.data = this.dataSource.data.filter(p => p.id !== product.id);
          this.setupTable();
          this.isLoading = false;
          this.notification.success('Product deleted successfully');
        }, 500);

        // Real API call:
        // this.api.delete(`/products/${product.id}`).subscribe({
        //   next: () => {
        //     this.dataSource.data = this.dataSource.data.filter(p => p.id !== product.id);
        //     this.setupTable();
        //     this.isLoading = false;
        //     this.notification.success('Product deleted successfully');
        //   },
        //   error: () => {
        //     this.isLoading = false;
        //   }
        // });
      }
    });
  }

  toggleStatus(product: Product): void {
    const newStatus = !product.isActive;
    this.updateProduct(product.id, { isActive: newStatus });
  }

  getStockStatus(stock: number): { label: string; color: string } {
    if (stock === 0) {
      return { label: 'Out of Stock', color: 'warn' };
    } else if (stock < 10) {
      return { label: 'Low Stock', color: 'accent' };
    } else {
      return { label: 'In Stock', color: 'primary' };
    }
  }

  exportProducts(): void {
    // Implement export functionality (CSV, Excel, etc.)
    this.notification.info('Export functionality coming soon');
  }
}
