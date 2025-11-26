import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { Product } from '../../../models/product.model';
import { Item } from '../../../models/item.model';
import { ItemsService } from '../../../services/items.service';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { AuthService } from '../../../services/auth.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, of, Observable } from 'rxjs';
import { ProductFormDialogComponent, ProductFormData } from '../product-form-dialog/product-form-dialog.component';
import { ProductImportDialogComponent } from '../product-import-dialog/product-import-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { Attachment } from '../../../models/attachment.model';

@Component({
  selector: 'app-products-list',
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
  menuId: string | null = null; // Menu ID for items API
  
  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private itemsService: ItemsService,
    private notification: NotificationService,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private localStorage: LocalStorageService,
    private authService: AuthService
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
    
    if (this.statusFilter.value === 'active') {
      query.isAvailable = true;
    } else if (this.statusFilter.value === 'inactive') {
      query.isAvailable = false;
    }
    
    if (this.searchControl.value) {
      query.search = this.searchControl.value;
    }

    console.log('query', JSON.stringify(query));

    this.itemsService.getItems(query).subscribe({
      next: (items) => {
        // Convert Items to Products for display
        this.dataSource.data = items.map(item => this.itemToProduct(item));
        this.updateCategories();
        this.setupTable();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading items:', error);
        this.dataSource.data = [];
        this.updateCategories();
        this.setupTable();
        this.isLoading = false;
        this.notification.error('Failed to load items from the database. Please try again.');
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
    // Reload from API with filters (menuId is optional)
    this.loadProducts();
  }

  updateCategories(): void {
    const cats = new Set(this.dataSource.data.map(p => p.category || 'Uncategorized'));
    this.categories = ['all', ...Array.from(cats).sort()];
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(ProductFormDialogComponent, {
      width: '600px',
      data: { product: null, menuId: this.menuId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.createProduct(result);
      }
    });
  }

  openEditDialog(product: Product): void {
    // Fetch full item to get recipe
    this.itemsService.getItemById(product.id).subscribe({
      next: (item: Item) => {
        // Convert Item to Product with recipe
        const productWithRecipe = this.itemToProduct(item);
        
        const dialogRef = this.dialog.open(ProductFormDialogComponent, {
          width: '600px',
          data: { product: productWithRecipe, menuId: this.menuId }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.updateProduct(product.id, result);
          }
        });
      },
      error: (error) => {
        console.error('Error fetching item for edit:', error);
        this.notification.error('Failed to load item details');
        // Fallback to opening dialog without recipe
        const dialogRef = this.dialog.open(ProductFormDialogComponent, {
          width: '600px',
          data: { product: { ...product }, menuId: this.menuId }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.updateProduct(product.id, result);
          }
        });
      }
    });
  }

  createProduct(productData: ProductFormData): void {
    // Note: menuId is optional for fetching, but may be required for creating items
    // depending on backend requirements

    this.isLoading = true;

    // If image file is provided, upload it first
    const uploadImage$: Observable<Attachment | null> = productData.imageBase64 && productData.imageMimeType
      ? this.uploadProductImage(productData.imageBase64, productData.imageMimeType, productData.imageFile?.name || 'product-image')
      : of(null);

    uploadImage$.pipe(
      switchMap((attachment: Attachment | null) => {
        // Use uploaded image URL if available, otherwise use existing image URL
        const imageUrl = attachment?.url || productData.image || undefined;

        // Convert Product to Item with image URL
        const productWithImage: Product = {
          ...productData as Product,
          image: imageUrl
        };
        const createCommand = this.productToCreateItemCommand(productWithImage);

        return this.itemsService.createItem(createCommand);
      })
    ).subscribe({
      next: (item: Item) => {
        // Convert Item to Product for display
        const newProduct = this.itemToProduct(item);
        this.dataSource.data = [...this.dataSource.data, newProduct];
        this.updateCategories();
        this.setupTable();
        this.isLoading = false;
        this.notification.success('Item created successfully');
      },
      error: (error: any) => {
        console.error('Error creating item:', error);
        this.isLoading = false;
        this.notification.error('Failed to create item');
      }
    });
  }

  updateProduct(id: string, productData: ProductFormData): void {
    this.isLoading = true;

    // If image file is provided, upload it first
    const uploadImage$: Observable<Attachment | null> = productData.imageBase64 && productData.imageMimeType
      ? this.uploadProductImage(productData.imageBase64, productData.imageMimeType, productData.imageFile?.name || 'product-image', id)
      : of(null);

    uploadImage$.pipe(
      switchMap((attachment: Attachment | null) => {
        // Use uploaded image URL if available, otherwise keep existing image URL
        const imageUrl = attachment?.url || productData.image || undefined;

        // Convert Product to UpdateItemCommand with image URL
        const productWithImage: Product = {
          ...productData as Product,
          image: imageUrl
        };
        const updateCommand = this.productToUpdateItemCommand(id, productWithImage);

        return this.itemsService.updateItem(updateCommand);
      })
    ).subscribe({
      next: (item: Item) => {
        // Convert Item to Product for display
        const updatedProduct = this.itemToProduct(item);
        const index = this.dataSource.data.findIndex(p => p.id === id);
        if (index !== -1) {
          this.dataSource.data[index] = updatedProduct;
          this.dataSource.data = [...this.dataSource.data];
          this.setupTable();
          this.isLoading = false;
          this.notification.success('Item updated successfully');
        }
      },
      error: (error: any) => {
        console.error('Error updating item:', error);
        this.isLoading = false;
        this.notification.error('Failed to update item');
      }
    });
  }

  deleteProduct(product: Product): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Item',
        message: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;

        this.itemsService.deleteItem(product.id).subscribe({
          next: () => {
            this.dataSource.data = this.dataSource.data.filter(p => p.id !== product.id);
            this.setupTable();
            this.isLoading = false;
            this.notification.success('Item deleted successfully');
          },
          error: (error) => {
            console.error('Error deleting item:', error);
            this.isLoading = false;
            this.notification.error('Failed to delete item');
          }
        });
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

  openImportDialog(): void {
    const dialogRef = this.dialog.open(ProductImportDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: { menuId: this.menuId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Reload products after successful import
        this.loadProducts();
      }
    });
  }

  /**
   * Convert Item model to Product model for display compatibility
   */
  private itemToProduct(item: Item): Product & { recipe?: any[] } {
    const product: Product & { recipe?: any[] } = {
      id: item.id,
      name: item.name,
      description: item.description,
      sku: item.id.substring(0, 8).toUpperCase(), // Generate SKU from ID
      barcode: undefined,
      price: item.price,
      cost: undefined,
      stock: item.isAvailable ? 999 : 0, // Map isAvailable to stock
      category: item.category, // Keep for display purposes
      categoryId: item.categoryId || item.category, // Use categoryId if available, fallback to category name
      image: item.imageUrl,
      isActive: item.isAvailable,
      taxRate: 0.1, // Default tax rate
      unit: 'item',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
    
    // Preserve recipe if it exists
    if (item.recipe && item.recipe.length > 0) {
      product.recipe = item.recipe;
    }
    
    return product;
  }

  /**
   * Convert Product model to CreateItemCommand
   */
  private productToCreateItemCommand(product: Product & { recipe?: any[] }): any {
    const command: any = {
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.image,
      isAvailable: product.isActive !== false,
      preparationTime: undefined,
      ingredients: product.description ? [product.description] : undefined
    };
    
    // Use categoryId if available, otherwise fall back to category name
    if (product.categoryId) {
      command.categoryId = product.categoryId;
    } else if (product.category) {
      // Fallback: if only category name is provided, use it (for backward compatibility)
      command.category = product.category;
    }
    
    // Add recipe if provided (ingredients with quantities and units)
    if (product.recipe && product.recipe.length > 0) {
      command.recipe = product.recipe;
    }
    
    // Add menuId if available (optional)
    if (this.menuId) {
      command.menuId = this.menuId;
    }
    
    return command;
  }

  /**
   * Convert Product model to UpdateItemCommand
   */
  private productToUpdateItemCommand(id: string, product: Product & { recipe?: any[] }): any {
    const command: any = {
      id: id,
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.image,
      isAvailable: product.isActive !== false
    };
    
    // Use categoryId if available, otherwise fall back to category name
    if (product.categoryId) {
      command.categoryId = product.categoryId;
    } else if (product.category) {
      // Fallback: if only category name is provided, use it (for backward compatibility)
      command.category = product.category;
    }
    
    // Add recipe if provided (ingredients with quantities and units)
    if (product.recipe && product.recipe.length > 0) {
      command.recipe = product.recipe;
    }
    
    return command;
  }

  /**
   * Upload product image using attachment API
   */
  private uploadProductImage(
    base64Data: string, 
    mimeType: string, 
    fileName: string,
    relatedEntityId?: string
  ): Observable<Attachment> {
    const currentUser = this.authService.getCurrentUser();
    
    const uploadRequest = {
      file: base64Data,
      fileName: fileName,
      mimeType: mimeType,
      uploadedBy: currentUser?.id,
      relatedEntityType: 'item',
      relatedEntityId: relatedEntityId,
      folder: 'products',
      metadata: {
        description: 'Product image'
      }
    };

    return this.api.uploadAttachment(uploadRequest);
  }
}
