import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { Product } from '../../../models/product.model';
import { Item } from '../../../models/item.model';
import { ItemsService } from '../../../services/items.service';
import { CategoriesService } from '../../../services/categories.service';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { AuthService } from '../../../services/auth.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, of, Observable, forkJoin } from 'rxjs';
import { ProductFormDialogComponent, ProductFormData } from '../product-form-dialog/product-form-dialog.component';
import { ProductImportDialogComponent } from '../product-import-dialog/product-import-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { Attachment } from '../../../models/attachment.model';
import { TenantContextService } from '../../../services/tenant-context.service';
import { PlaceService } from '../../../services/place.service';
import { PlaceBranch } from '../../../models/place.model';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.scss']
})
export class ProductsListComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['image', 'name', 'sku', 'category', 'price', 'stock', 'branch', 'status', 'actions'];
  dataSource = new MatTableDataSource<Product>([]);
  
  searchControl = new FormControl('');
  categoryFilter = new FormControl('all');
  statusFilter = new FormControl('all');
  
  categories: string[] = ['all'];
  isLoading: boolean = false;
  menuId: string | null = null; // Menu ID for items API
  placeId: string | null = null;
  branchId: string | null = null;
  private readonly BRANCH_STORAGE_KEY = 'branchId';
  
  // Category mapping: categoryId -> category name
  private categoryMap: Map<string, string> = new Map();
  
  // Branch mapping: branchId -> branch name
  private branchMap: Map<string, string> = new Map();
  
  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private itemsService: ItemsService,
    private categoriesService: CategoriesService,
    private notification: NotificationService,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private localStorage: LocalStorageService,
    private authService: AuthService,
    private tenantContext: TenantContextService,
    private placeService: PlaceService
  ) {}

  ngOnInit(): void {
    this.placeId = this.tenantContext.getCurrentPlaceId();
    this.tenantContext.currentPlaceId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((placeId) => {
        if (this.placeId !== placeId) {
          this.placeId = placeId;
          this.loadCategories();
          this.loadBranches();
          this.loadProducts();
        }
      });

    // Get menuId/branchId from route params or localStorage
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      let shouldReload = false;

      const newMenuId = params['menuId'] || this.localStorage.getItem<string>('menuId') || null;
      if (newMenuId !== this.menuId) {
        this.menuId = newMenuId;
        if (this.menuId) {
          this.localStorage.setItem('menuId', this.menuId);
        }
        shouldReload = true;
      }

      const newBranchId = params['branchId'] || params['branch_id'] || null;
      if (newBranchId) {
        if (newBranchId !== this.branchId) {
          this.branchId = newBranchId;
          this.localStorage.setItem(this.BRANCH_STORAGE_KEY, newBranchId);
          shouldReload = true;
        }
      } else if (!this.branchId) {
        const storedBranch = this.localStorage.getItem<string>(this.BRANCH_STORAGE_KEY);
        if (storedBranch && storedBranch !== this.branchId) {
          this.branchId = storedBranch;
          shouldReload = true;
        }
      }

      if (shouldReload) {
        this.loadProducts();
      }
    });
    
    // If no menuId in route, try localStorage
    if (!this.menuId) {
      this.menuId = this.localStorage.getItem<string>('menuId');
    }

    if (!this.branchId) {
      this.branchId = this.localStorage.getItem<string>(this.BRANCH_STORAGE_KEY);
    }
    
    this.loadBranches();
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

    if (this.placeId) {
      query.placeId = this.placeId;
    }

    if (this.branchId) {
      query.branchId = this.branchId;
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

    // Load categories and items in parallel
    const categories$ = this.placeId 
      ? this.categoriesService.getCategories({
          isActive: true,
          placeId: this.placeId,
          menuId: this.menuId || undefined
        })
      : of([]);
    
    const items$ = this.itemsService.getItems(query);

    forkJoin({
      categories: categories$,
      items: items$
    }).subscribe({
      next: ({ categories, items }) => {
        // Build category mapping
        this.categoryMap.clear();
        categories.forEach(cat => {
          this.categoryMap.set(cat.id, cat.name);
          // Also map by name for backward compatibility
          if (cat.name) {
            this.categoryMap.set(cat.name, cat.name);
          }
        });

        // Convert Items to Products for display with category names
        this.dataSource.data = items.map(item => this.itemToProduct(item));
        this.updateCategories();
        this.setupTable();
        // Ensure paginator is updated after data is set
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading data:', error);
        // Fallback: try to load items without categories
        this.itemsService.getItems(query).subscribe({
          next: (items) => {
            this.dataSource.data = items.map(item => this.itemToProduct(item));
            this.updateCategories();
            this.setupTable();
            // Ensure paginator is updated after data is set
            if (this.paginator) {
              this.dataSource.paginator = this.paginator;
            }
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Error loading items:', err);
            this.dataSource.data = [];
            this.updateCategories();
            this.setupTable();
            // Ensure paginator is updated after data is set
            if (this.paginator) {
              this.dataSource.paginator = this.paginator;
            }
            this.isLoading = false;
            this.notification.error('Failed to load items from the database. Please try again.');
          }
        });
      }
    });
  }

  /**
   * Load categories from API to map categoryId to category name
   */
  private loadCategories(): void {
    if (!this.placeId) {
      return;
    }

    const query: any = {
      isActive: true,
      placeId: this.placeId
    };

    if (this.menuId) {
      query.menuId = this.menuId;
    }

    this.categoriesService.getCategories(query).subscribe({
      next: (categories) => {
        // Build category mapping
        this.categoryMap.clear();
        categories.forEach(cat => {
          this.categoryMap.set(cat.id, cat.name);
          // Also map by name for backward compatibility
          if (cat.name) {
            this.categoryMap.set(cat.name, cat.name);
          }
        });
        
        // Update category display in existing products
        this.dataSource.data = this.dataSource.data.map(product => {
          if (product.categoryId && this.categoryMap.has(product.categoryId)) {
            product.category = this.categoryMap.get(product.categoryId)!;
          } else if (!product.category && product.categoryId) {
            // If we have categoryId but no name, try to use categoryId as fallback
            product.category = product.categoryId;
          }
          return product;
        });
        this.updateCategories();
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  /**
   * Load branches from API to map branchId to branch name
   */
  private loadBranches(): void {
    if (!this.placeId) {
      return;
    }

    this.placeService.getBranches({ place_id: this.placeId }).subscribe({
      next: (branches) => {
        // Build branch mapping
        this.branchMap.clear();
        (branches || []).forEach(branch => {
          if (branch.id && branch.name) {
            this.branchMap.set(branch.id, branch.name);
          }
        });
      },
      error: (error) => {
        console.error('Error loading branches:', error);
      }
    });
  }

  /**
   * Get branch name by branchId
   */
  getBranchName(branchId: string | null | undefined): string {
    if (!branchId) {
      return '';
    }
    return this.branchMap.get(branchId) || branchId;
  }

  ngAfterViewInit(): void {
    // Ensure paginator and sort are connected after view initialization
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  setupTable(): void {
    // Reassign paginator and sort after data changes
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
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
    // Open dialog immediately with existing product data for better UX
    const dialogRef = this.dialog.open(ProductFormDialogComponent, {
      width: '600px',
      data: { 
        product: { ...product }, 
        menuId: this.menuId,
        loadFullData: true // Flag to indicate we need to load full item data
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateProduct(product.id, result);
      }
    });
  }

  createProduct(productData: ProductFormData): void {
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
    // Use update logic but just with the isActive flag
    // We need to use UpdateItemCommand structure
    const updateCommand = {
      id: product.id,
      isAvailable: newStatus
    };
    
    this.itemsService.updateItem(updateCommand).subscribe({
      next: (item: Item) => {
        const updatedProduct = this.itemToProduct(item);
        const index = this.dataSource.data.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.dataSource.data[index] = updatedProduct;
          this.dataSource.data = [...this.dataSource.data];
          this.notification.success(`Product ${newStatus ? 'activated' : 'deactivated'}`);
        }
      },
      error: (error) => {
        console.error('Error updating status:', error);
        this.notification.error('Failed to update status');
        // Revert toggle in UI if possible or reload
        this.loadProducts();
      }
    });
  }

  getStockStatus(stock: number): { label: string; color: string } {
    // This method might be less relevant now that stock is managed in backend/inventory
    // but we still use it for availableUnits if provided
    if (stock === 0) {
      return { label: 'Out of Stock', color: 'warn' };
    } else if (stock < 10) {
      return { label: 'Low Stock', color: 'accent' };
    } else {
      return { label: 'In Stock', color: 'primary' };
    }
  }

  exportProducts(): void {
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
        this.loadProducts();
      }
    });
  }

  /**
   * Convert Item model to Product model for display compatibility
   */
  private itemToProduct(item: Item): Product & { recipe?: any[] } {
    // Get category name from map if categoryId exists, otherwise use category name
    let categoryName = item.category;
    if (item.categoryId && this.categoryMap.has(item.categoryId)) {
      categoryName = this.categoryMap.get(item.categoryId)!;
    } else if (!categoryName && item.categoryId) {
      // Fallback: use categoryId if no name found
      categoryName = item.categoryId;
    }

    const product: Product & { recipe?: any[] } = {
      id: item.id,
      name: item.name,
      description: item.description,
      sku: item.id.substring(0, 8).toUpperCase(), // Generate SKU from ID
      barcode: undefined,
      price: item.price,
      cost: item.calculatedCost, // Use calculated cost from backend
      stock: item.availableUnits !== undefined ? item.availableUnits : (item.isAvailable ? 999 : 0), // Use backend available units or fallback
      category: categoryName, // Use mapped category name
      categoryId: item.categoryId || item.category, // Use categoryId if available, fallback to category name
      placeId: item.placeId,
      branchId: item.branchId ?? null,
      menuId: item.menuId,
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
  private productToCreateItemCommand(product: Product & { recipe?: any[]; placeId?: string; branchId?: string | null }): any {
    const command: any = {
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.image,
      isAvailable: product.isActive !== false,
      preparationTime: undefined,
      ingredients: product.description ? [product.description] : undefined
    };
    
    if (product.categoryId) {
      command.categoryId = product.categoryId;
    } else if (product.category) {
      command.category = product.category;
    }
    
    if (product.recipe && product.recipe.length > 0) {
      command.recipe = product.recipe;
    }
    
    if (this.menuId) {
      command.menuId = this.menuId;
    }

    // placeId is required - items are linked to place
    const effectivePlaceId = product.placeId || this.placeId;
    if (!effectivePlaceId) {
      throw new Error('Place ID is required to create item');
    }
    command.placeId = effectivePlaceId;

    // branchId: if provided, item is branch-specific; if null/undefined, shared across all branches
    const effectiveBranchId = product.branchId !== undefined ? product.branchId : (this.branchId ?? null);
    command.branchId = effectiveBranchId ?? null;
    
    return command;
  }

  /**
   * Convert Product model to UpdateItemCommand
   */
  private productToUpdateItemCommand(id: string, product: Product & { recipe?: any[]; placeId?: string; branchId?: string | null }): any {
    const command: any = {
      id: id,
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.image,
      isAvailable: product.isActive !== false
    };
    
    if (product.categoryId) {
      command.categoryId = product.categoryId;
    } else if (product.category) {
      command.category = product.category;
    }
    
    if (product.recipe && product.recipe.length > 0) {
      command.recipe = product.recipe;
    }

    // placeId should be preserved from existing item or use current placeId
    const effectivePlaceId = product.placeId || this.placeId;
    if (effectivePlaceId) {
      command.placeId = effectivePlaceId;
    }

    // branchId: if provided, item is branch-specific; if null, shared across all branches
    if (product.branchId !== undefined) {
      command.branchId = product.branchId;
    } else if (this.branchId !== undefined) {
      command.branchId = this.branchId;
    } else {
      command.branchId = null; // Explicitly set to null if not provided (shared)
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
