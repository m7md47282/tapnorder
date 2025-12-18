import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Product, CartItem as PosCartItem, Sale, PaymentMethod, SaleStatus, Customer, Table } from '../../../models/product.model';
import { Item } from '../../../models/item.model';
import { Category } from '../../../models/category.model';
import { ApiService } from '../../../services/api.service';
import { ItemsService } from '../../../services/items.service';
import { CategoriesService } from '../../../services/categories.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { TenantContextService } from '../../../services/tenant-context.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../components/confirm-dialog/confirm-dialog.component';
import { RealtimeOrdersService } from '../../../services/realtime-orders.service';
import { OrderService } from '../../../services/order.service';
import { Order, ACTIVE_ORDER_STATUSES } from '../../../models/order.model';
import { CartItem as OrderCartItem, CartAddonSelection } from '../../../services/cart.service';
import { MenuItem } from '../../guest-menu/guest-menu.component';

@Component({
  selector: 'app-pos-screen',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './pos-screen.component.html',
  styleUrls: ['./pos-screen.component.scss']
})
export class PosScreenComponent implements OnInit, OnDestroy {
  // Search
  searchControl = new FormControl('');
  searchTerm: string = '';
  
  // Products
  products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedCategory: string = 'all';
  categories: string[] = ['all'];
  quickFilterCategories: Category[] = []; // Categories for quick filters
  activeQuickFilter: string | null = null;
  
  // Cart
  cart: PosCartItem[] = [];
  
  // Customer
  selectedCustomer: Customer | null = null;
  customerSearchTerm: string = '';
  showCustomerDialog: boolean = false;
  
  // Table
  selectedTableNumber: string = '';
  availableTables: Table[] = [];
  showTableDialog: boolean = false;
  
  // Payment
  paymentMethod: PaymentMethod = PaymentMethod.CASH;
  cashReceived: number = 0;
  showPaymentDialog: boolean = false;
  orderNotes: string = '';
  
  // Calculations
  subtotal: number = 0;
  tax: number = 0;
  discount: number = 0;
  total: number = 0;
  change: number = 0;
  
  // UI State
  isLoading: boolean = false;
  isProcessing: boolean = false;
  editingCommentForItem: PosCartItem | null = null;
  itemCommentText: string = '';
  isFullscreen: boolean = false;
  showProductDetailsDialog: boolean = false;
  selectedProductForDetails: Product | null = null;
  
  // Order tracking
  private createdOrderSubscription?: Subscription;
  private posGuestUuid: string | null = null;
  
  // Long press state
  private longPressTimer: any = null;
  private longPressDelay: number = 500; // 500ms for long press
  private wasLongPress: boolean = false;
  
  // Expose enum to template
  PaymentMethod = PaymentMethod;
  
  // Menu ID for items API
  menuId: string | null = null;
  
  // Place and Branch context
  placeId: string | null = null;
  branchId: string | null = null;
  private readonly BRANCH_STORAGE_KEY = 'pos_branchId';
  
  // Currency
  currency: string = 'USD';
  
  // Raw items for category filtering
  private rawItems: Item[] = [];
  
  currentTableOrder: Order | null = null;
  private realtimeSubscription: any = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private itemsService: ItemsService,
    private categoriesService: CategoriesService,
    private notification: NotificationService,
    private authService: AuthService,
    private localStorage: LocalStorageService,
    private tenantContext: TenantContextService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private realtimeOrders: RealtimeOrdersService,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    // Initialize placeId from tenant context with fallback to localStorage
    this.placeId = this.tenantContext.getCurrentPlaceId();
    if (!this.placeId) {
      // Try localStorage getCurrentPlaceId method
      this.placeId = this.localStorage.getCurrentPlaceId();
    }
    if (!this.placeId) {
      // Try user object
      const user = this.localStorage.getUser<any>();
      if (user?.placeId) {
        this.placeId = user.placeId;
      }
    }
    if (!this.placeId) {
      // Try current place object
      const place = this.localStorage.getCurrentPlace<any>();
      if (place?.id) {
        this.placeId = place.id;
      }
    }
    
    // Initialize branchId from localStorage or user/place
    if (!this.branchId) {
      this.branchId = this.localStorage.getItem<string>(this.BRANCH_STORAGE_KEY);
    }
    if (!this.branchId) {
      // Try user object
      const user = this.localStorage.getUser<any>();
      if (user?.branchId) {
        this.branchId = user.branchId;
      }
    }
    if (!this.branchId) {
      // Try current place object
      const place = this.localStorage.getCurrentPlace<any>();
      if (place?.branchId) {
        this.branchId = place.branchId;
      }
    }
    
    // Initialize currency from place settings
    this.currency = this.tenantContext.getCurrentCurrency();
    
    // Generate POS guest UUID for order tracking
    this.posGuestUuid = this.generatePosGuestUuid();
    
    // Subscribe to place changes to update currency
    this.tenantContext.currentPlace$
      .pipe(takeUntil(this.destroy$))
      .subscribe((place) => {
        if (place?.settings?.currency) {
          this.currency = place.settings.currency;
        }
      });
    
    // Subscribe to placeId changes
    this.tenantContext.currentPlaceId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((placeId) => {
        if (placeId !== this.placeId) {
          this.placeId = placeId || this.localStorage.getCurrentPlaceId() || (this.localStorage.getUser<any>()?.placeId);
          if (this.placeId) {
            this.localStorage.setCurrentPlaceId(this.placeId);
          }
          this.loadProducts();
          // Update currency when place changes
          this.currency = this.tenantContext.getCurrentCurrency();
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

      // Also check for placeId in route params (for guest access)
      const routePlaceId = params['place_id'] || params['placeId'];
      if (routePlaceId && routePlaceId !== this.placeId) {
        this.placeId = routePlaceId;
        this.localStorage.setCurrentPlaceId(this.placeId);
        shouldReload = true;
      }
      
      // Ensure placeId is set from localStorage if still missing
      if (!this.placeId) {
        const storedPlaceId = this.localStorage.getCurrentPlaceId();
        if (storedPlaceId) {
          this.placeId = storedPlaceId;
          shouldReload = true;
        }
      }
      
      // Ensure branchId is set from localStorage if still missing
      if (!this.branchId) {
        const storedBranchId = this.localStorage.getItem<string>(this.BRANCH_STORAGE_KEY);
        if (storedBranchId) {
          this.branchId = storedBranchId;
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

    // Final check for branchId from various sources
    if (!this.branchId) {
      this.branchId = this.localStorage.getItem<string>(this.BRANCH_STORAGE_KEY);
    }
    if (!this.branchId) {
      const user = this.localStorage.getUser<any>();
      if (user?.branchId) {
        this.branchId = user.branchId;
      }
    }
    if (!this.branchId) {
      const place = this.localStorage.getCurrentPlace<any>();
      if (place?.branchId) {
        this.branchId = place.branchId;
      }
    }
    
    // Final check for placeId from localStorage
    if (!this.placeId) {
      this.placeId = this.localStorage.getCurrentPlaceId();
    }
    if (!this.placeId) {
      const place = this.localStorage.getCurrentPlace<any>();
      if (place?.id) {
        this.placeId = place.id;
      }
    }
    
    this.loadProducts();
    this.setupSearch();
    this.setupFullscreenListener();
    this.loadTables();
    this.checkQueryParams();
  }

  checkQueryParams(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['tableNumber']) {
        this.selectedTableNumber = params['tableNumber'];
        this.loadTableOrder(params['tableNumber']);
      }
      if (params['tableId']) {
        this.loadTableOrder(params['tableId']);
      }
    });
  }

  private loadTableOrder(tableNumber: string): void {
    if (!this.placeId) return;

    const query = {
      placeId: this.placeId,
      status: ['pending', 'confirmed', 'preparing', 'ready'] as string[]
    };

    this.orderService.fetchOrders(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          const tableOrder = orders.find(o => o.tableId === tableNumber);
          if (tableOrder) {
            this.currentTableOrder = tableOrder;
          }
        }
      });

    if (this.placeId) {
      this.connectRealtimeTableOrder(tableNumber);
    }
  }

  private connectRealtimeTableOrder(tableNumber: string): void {
    if (!this.placeId) return;

    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }

    this.realtimeSubscription = this.realtimeOrders
      .connectRealtimeOrders(this.placeId, ['pending', 'confirmed', 'preparing', 'ready'])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          const tableOrder = orders.find(o => o.tableId === tableNumber);
          if (tableOrder) {
            this.currentTableOrder = tableOrder;
          } else {
            this.currentTableOrder = null;
          }
        }
      });
  }

  loadTables(): void {
    // Mock API call - replace with real API
    setTimeout(() => {
      this.availableTables = [
        { id: '1', tableNumber: '1', capacity: 2, status: 'AVAILABLE' as any, isActive: true },
        { id: '2', tableNumber: '2', capacity: 4, status: 'AVAILABLE' as any, isActive: true },
        { id: '3', tableNumber: '3', capacity: 4, status: 'AVAILABLE' as any, isActive: true },
        { id: '4', tableNumber: '4', capacity: 6, status: 'AVAILABLE' as any, isActive: true },
        { id: '5', tableNumber: '5', capacity: 2, status: 'AVAILABLE' as any, isActive: true },
        { id: '6', tableNumber: '6', capacity: 8, status: 'AVAILABLE' as any, isActive: true },
        { id: '7', tableNumber: '7', capacity: 4, status: 'AVAILABLE' as any, isActive: true },
        { id: '8', tableNumber: '8', capacity: 2, status: 'AVAILABLE' as any, isActive: true },
      ];
    }, 100);

    // Real API call (uncomment when backend is ready):
    // this.api.get<Table[]>('/tables', { isActive: true }).subscribe({
    //   next: (tables) => {
    //     this.availableTables = tables;
    //   },
    //   error: () => {
    //     this.notification.error('Failed to load tables');
    //   }
    // });
  }

  setupFullscreenListener(): void {
    // Listen for fullscreen changes (e.g., ESC key)
    const fullscreenHandler = () => {
      if (!document.fullscreenElement && this.isFullscreen) {
        this.isFullscreen = false;
        document.body.classList.remove('pos-fullscreen-mode');
      }
    };
    document.addEventListener('fullscreenchange', fullscreenHandler);
    
    // Clean up listener on destroy
    this.destroy$.subscribe(() => {
      document.removeEventListener('fullscreenchange', fullscreenHandler);
    });
  }

  ngOnDestroy(): void {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
    if (this.createdOrderSubscription) {
      this.createdOrderSubscription.unsubscribe();
    }
    this.realtimeOrders.disconnectAll();
    document.body.classList.remove('pos-fullscreen-mode');
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupSearch(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(term => {
        this.searchTerm = term || '';
        // Clear quick filter when searching
        if (term) {
          this.activeQuickFilter = null;
        }
        this.filterProducts();
      });
  }

  loadProducts(): void {
    this.isLoading = true;
    
    // Build query - filter by placeId, branchId (or shared), and menuId
    const query: any = { 
      isAvailable: true // Only load available items
    };
    
    // Add placeId if available (required for filtering)
    if (this.placeId) {
      query.placeId = this.placeId;
    }
    
    // Add branchId if available (items with this branchId OR no branchId will be shown)
    if (this.branchId) {
      query.branchId = this.branchId;
    }
    
    // Add menuId if available
    if (this.menuId) {
      query.menuId = this.menuId;
    }
    
    // Load items first, then categories based on loaded items
    // This ensures categories are filtered to only those that have items for this branch/place
    this.itemsService.getItems(query).subscribe({
      next: (items) => {
        // Ensure items is an array
        const itemsArray = Array.isArray(items) ? items : [];
        
        // Filter items client-side to handle shared items (no branchId)
        // Items should be shown if:
        // 1. They have matching placeId AND
        // 2. They have matching branchId OR they have no branchId (shared items)
        let filteredItems = itemsArray;
        if (this.placeId) {
          filteredItems = itemsArray.filter(item => {
            // Must match placeId
            if (item.placeId !== this.placeId) {
              return false;
            }
            // If branchId is specified, show items with matching branchId OR no branchId (shared)
            if (this.branchId) {
              return !item.branchId || item.branchId === this.branchId;
            }
            // If no branchId specified, show all items for this place
            return true;
          });
        }
        
        this.rawItems = filteredItems;
        
        // Convert Items to Products for display
        this.products = filteredItems.map(item => this.itemToProduct(item));
        this.filteredProducts = this.products;
        this.updateCategories();
        this.loadQuickFilterCategories(filteredItems);
        this.loadCategories();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading items:', error);
        this.products = [];
        this.filteredProducts = [];
        this.rawItems = [];
        this.updateCategories();
        this.quickFilterCategories = [];
        this.isLoading = false;
        this.notification.error('Failed to load products from the database. Please try again.');
      }
    });
  }

  updateCategories(): void {
    const cats = new Set(this.products.map(p => p.category || 'Uncategorized'));
    this.categories = ['all', ...Array.from(cats)];
  }

  loadQuickFilterCategories(items: Item[]): void {
    // Extract categories from items for quick filters
    // Get placeId from items (all items should have the same placeId)
    const placeId = items.length > 0 && items[0]?.placeId 
      ? items[0].placeId 
      : this.placeId || 'default'; // Use component placeId or fallback
    
    this.quickFilterCategories = this.categoriesService.extractCategoriesFromItems(
      items, 
      this.menuId || 'default', 
      placeId,
      false // Only active categories
    );
    // Sort by display order or name
    this.quickFilterCategories.sort((a, b) => {
      if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Load categories from API
   * Similar to guest menu - filters categories to only show those that have items for the current branch/place
   */
  private loadCategories(): void {
    if (!this.placeId) {
      // Can't load categories without placeId
      return;
    }

    // Build query for categories
    const query: any = { 
      isActive: true,
      placeId: this.placeId
    };
    
    // Add menuId if available
    if (this.menuId) {
      query.menuId = this.menuId;
    }
    
    // Load categories from API
    this.categoriesService.getCategories(query).subscribe({
      next: (categories) => {
        // Ensure categories is an array
        const categoriesArray = Array.isArray(categories) ? categories : [];
        
        // Extract unique category IDs from loaded items
        // This ensures we only show categories that have items for this branch/place
        const itemCategoryIds = new Set<string>();
        this.rawItems.forEach(item => {
          if (item.categoryId) {
            itemCategoryIds.add(item.categoryId);
          }
          // Also handle items that use category name instead of categoryId
          if (item.category && !item.categoryId) {
            // Find category by name
            const categoryName = item.category;
            const categoryByName = categoriesArray.find(cat => 
              cat.name === categoryName || 
              cat.id === this.normalizeCategoryId(categoryName)
            );
            if (categoryByName) {
              itemCategoryIds.add(categoryByName.id);
            }
          }
        });
        
        // Filter categories to only those that have items for this branch/place
        // Also filter by branchId if specified (show categories with matching branchId OR no branchId)
        const filteredCategories = categoriesArray.filter(cat => {
          // Must have items for this category
          if (!itemCategoryIds.has(cat.id)) {
            return false;
          }
          // If branchId is specified, show categories with matching branchId OR no branchId (shared)
          if (this.branchId) {
            return !cat.branchId || cat.branchId === this.branchId;
          }
          // If no branchId specified, show all categories for this place
          return true;
        });
        
        // Update quick filter categories with filtered categories
        this.quickFilterCategories = filteredCategories
          .map(cat => ({
            ...cat,
            icon: cat.icon || this.categoriesService.getCategoryIcon(cat.name)
          }))
          .sort((a, b) => {
            if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
              return a.displayOrder - b.displayOrder;
            }
            return a.name.localeCompare(b.name);
          });
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        // Fallback: use categories extracted from items
      }
    });
  }

  /**
   * Normalize category name to ID format
   */
  private normalizeCategoryId(categoryName: string): string {
    return categoryName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  filterProducts(): void {
    // If quick filter is active, don't apply regular filters
    if (this.activeQuickFilter) {
      return;
    }

    let filtered = this.products;

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === this.selectedCategory);
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      );
    }

    this.filteredProducts = filtered;
  }

  onCategoryChange(category: string): void {
    this.selectedCategory = category;
    this.activeQuickFilter = null;
    this.filterProducts();
  }

  applyQuickFilter(categoryId: string): void {
    this.activeQuickFilter = categoryId;
    this.selectedCategory = 'all';
    this.searchTerm = '';
    this.searchControl.setValue('');
    
    // Find category by ID to get its name
    const category = this.quickFilterCategories.find(c => c.id === categoryId);
    
    // Filter products by category name (products use category name, not ID)
    if (category) {
      this.filteredProducts = this.products.filter(p => p.category === category.name);
    } else {
      this.filterProducts();
    }
  }

  clearQuickFilter(): void {
    this.activeQuickFilter = null;
    this.filterProducts();
  }

  updateCartItem(item: PosCartItem): void {
    item.subtotal = item.price * item.quantity;
    
    if (item.discount) {
      if (item.discountType === 'percentage') {
        item.subtotal = item.subtotal * (1 - item.discount / 100);
      } else {
        item.subtotal = item.subtotal - item.discount;
      }
    }

    item.tax = item.subtotal * (item.product.taxRate || 0);
    item.total = item.subtotal + item.tax;
  }

  removeFromCart(item: PosCartItem): void {
    const index = this.cart.indexOf(item);
    if (index > -1) {
      this.cart.splice(index, 1);
      this.calculateTotals();
      this.notification.info('Item removed from cart');
    }
  }

  updateQuantity(item: PosCartItem, change: number): void {
    const newQuantity = item.quantity + change;
    
    if (newQuantity <= 0) {
      this.removeFromCart(item);
      return;
    }

    if (newQuantity > item.product.stock) {
      this.notification.warning('Insufficient stock');
      return;
    }

    item.quantity = newQuantity;
    this.updateCartItem(item);
    this.calculateTotals();
  }

  applyDiscount(item: PosCartItem, discount: number, type: 'percentage' | 'fixed' = 'percentage'): void {
    item.discount = discount;
    item.discountType = type;
    this.updateCartItem(item);
    this.calculateTotals();
  }

  calculateTotals(): void {
    this.subtotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    this.tax = this.cart.reduce((sum, item) => sum + (item.tax || 0), 0);
    this.discount = this.cart.reduce((sum, item) => sum + (item.discount && item.discountType === 'fixed' ? item.discount : 0), 0);
    this.total = this.subtotal + this.tax;
    
    if (this.paymentMethod === PaymentMethod.CASH && this.cashReceived > 0) {
      this.change = this.cashReceived - this.total;
    }
  }

  clearCart(): void {
    if (this.cart.length === 0) return;
    
    const dialogData: ConfirmDialogData = {
      title: 'Clear Order',
      message: `Are you sure you want to clear the entire order? This will remove all ${this.cart.length} item${this.cart.length > 1 ? 's' : ''} from the cart.`,
      confirmText: 'Clear Order',
      cancelText: 'Cancel',
      confirmColor: 'warn'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: dialogData,
      disableClose: false,
      panelClass: 'pos-confirm-dialog',
      hasBackdrop: true,
      backdropClass: 'pos-confirm-dialog-backdrop'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.cart = [];
        this.selectedCustomer = null;
        this.selectedTableNumber = '';
        this.cashReceived = 0;
        this.change = 0;
        this.orderNotes = '';
        this.calculateTotals();
        this.notification.success('Order cleared successfully');
      }
    });
  }

  openPaymentDialog(): void {
    if (this.cart.length === 0) {
      this.notification.warning('Cart is empty');
      return;
    }
    this.showPaymentDialog = true;
    this.cashReceived = this.total;
    // Keep existing notes if any, don't reset them
    this.calculateTotals();
  }

  /**
   * Refresh placeId and branchId from all available sources
   */
  private refreshPlaceAndBranchIds(): void {
    // First check route params (they might have been updated)
    const routeParams = this.route.snapshot.queryParams;
    if (routeParams['place_id'] || routeParams['placeId']) {
      this.placeId = routeParams['place_id'] || routeParams['placeId'];
    }
    if (routeParams['branchId'] || routeParams['branch_id']) {
      this.branchId = routeParams['branchId'] || routeParams['branch_id'];
    }

    // Refresh placeId from all sources
    if (!this.placeId) {
      this.placeId = this.tenantContext.getCurrentPlaceId();
    }
    if (!this.placeId) {
      this.placeId = this.localStorage.getCurrentPlaceId();
    }
    if (!this.placeId) {
      const place = this.localStorage.getCurrentPlace<any>();
      if (place?.id) {
        this.placeId = place.id;
      }
    }
    if (!this.placeId) {
      const user = this.localStorage.getUser<any>();
      if (user?.placeId) {
        this.placeId = user.placeId;
      }
    }

    // Refresh branchId from all sources
    if (!this.branchId) {
      this.branchId = this.localStorage.getItem<string>(this.BRANCH_STORAGE_KEY);
    }
    if (!this.branchId) {
      const user = this.localStorage.getUser<any>();
      if (user?.branchId) {
        this.branchId = user.branchId;
      }
    }
    if (!this.branchId) {
      const place = this.localStorage.getCurrentPlace<any>();
      if (place?.branchId) {
        this.branchId = place.branchId;
      }
    }
  }

  async processPayment(): Promise<void> {
    if (this.isProcessing) return;

    if (this.paymentMethod === PaymentMethod.CASH && this.cashReceived < this.total) {
      this.notification.error('Insufficient cash received');
      return;
    }

    // Refresh placeId and branchId from all sources before processing
    this.refreshPlaceAndBranchIds();

    // Debug: Log what we found
    // Comprehensive localStorage check for placeId
    if (!this.placeId) {
      // Try all possible localStorage keys for placeId
      const placeIdKeys = [
        'pos_current_place_id',
        'placeId',
        'place_id',
        'current_place_id',
        'currentPlaceId'
      ];
      
      for (const key of placeIdKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          this.placeId = value;
          console.log(`Found placeId in localStorage key "${key}":`, this.placeId);
          break;
        }
      }
    }

    // Comprehensive localStorage check for branchId
    if (!this.branchId) {
      // Try all possible localStorage keys for branchId
      const branchIdKeys = [
        'pos_branchId',
        'branchId',
        'branch_id',
        'current_branch_id',
        'currentBranchId'
      ];
      
      for (const key of branchIdKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          this.branchId = value;
          console.log(`Found branchId in localStorage key "${key}":`, this.branchId);
          break;
        }
      }
    }

    // placeId is required, but branchId might be optional for some setups
    if (!this.placeId) {
      // Debug logging only if placeId is missing (critical error)
      console.error('POS Payment Error - Missing placeId:');
      console.error('  localStorage.getCurrentPlaceId():', this.localStorage.getCurrentPlaceId());
      console.error('  localStorage.getItem("pos_current_place_id"):', this.localStorage.getItem<string>('pos_current_place_id'));
      const user = this.localStorage.getUser<any>();
      console.error('  user?.placeId:', user?.placeId);
      const place = this.localStorage.getCurrentPlace<any>();
      console.error('  place?.id:', place?.id);
      console.error('  All localStorage keys:', Object.keys(localStorage));
      
      this.notification.error('Missing place information. Please ensure you are logged in and have selected a place.');
      return;
    }

    // Use empty string as fallback for branchId if not found (some places might not use branches)
    // This is normal and expected for single-location restaurants
    if (!this.branchId) {
      this.branchId = '';
    }

    if (this.cart.length === 0) {
      this.notification.warning('Cart is empty');
      return;
    }

    this.isProcessing = true;

    const currentUser = this.authService.getCurrentUser();
    
    // Build notes including table number if selected
    let notes = this.orderNotes.trim() || '';
    if (this.selectedTableNumber) {
      if (notes) {
        notes = `Table: ${this.selectedTableNumber} | ${notes}`;
      } else {
        notes = `Table: ${this.selectedTableNumber}`;
      }
    }
    
    // Add customer info to notes if available
    if (this.selectedCustomer?.name) {
      if (notes) {
        notes = `Customer: ${this.selectedCustomer.name} | ${notes}`;
      } else {
        notes = `Customer: ${this.selectedCustomer.name}`;
      }
    }

    try {
      // Convert POS cart items to OrderService format
      const orderCartItems = this.convertPosCartItemsToOrderItems(this.cart);
      
      // Map payment method
      const paymentMethod = this.mapPaymentMethodToOrderFormat(this.paymentMethod);
      
      // Create order using OrderService (same as guest-menu)
      const order = await this.orderService.createOrder(
        orderCartItems,
        this.placeId,
        this.branchId,
        this.selectedTableNumber || null,
        this.posGuestUuid!,
        paymentMethod,
        notes || undefined,
        this.currency
      );

      // Connect to real-time updates for this order
      this.connectOrderRealtime(order.id);

      this.isProcessing = false;
      this.notification.success('Order created successfully!');
      
      // Print receipt (using order data)
      this.printOrderReceipt(order);
      
      this.clearCart();
      this.showPaymentDialog = false;
      
      // Refresh products to update availability if needed
      this.loadProducts();
    } catch (error) {
      console.error('Error creating order:', error);
      this.isProcessing = false;
      this.notification.error('Failed to create order. Please try again.');
    }
  }

  printReceipt(sale: Sale): void {
    // Implement receipt printing logic
    console.log('Printing receipt:', sale);
    // You can use window.print() or a receipt printer library
    this.notification.info('Receipt printed');
  }

  printOrderReceipt(order: Order): void {
    // Implement receipt printing logic for orders
    console.log('Printing order receipt:', order);
    // You can use window.print() or a receipt printer library
    this.notification.info('Receipt printed');
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
    this.showCustomerDialog = false;
    this.notification.success(`Customer selected: ${customer.name}`);
  }

  removeCustomer(): void {
    this.selectedCustomer = null;
    this.notification.info('Customer removed');
  }

  // Quick actions
  quickAdd(productId: string): void {
    const product = this.products.find(p => p.id === productId);
    if (product) {
      this.addToCart(product);
    }
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH]: 'Cash',
      [PaymentMethod.CARD]: 'Card',
      [PaymentMethod.MOBILE_PAYMENT]: 'Mobile Payment',
      [PaymentMethod.CREDIT]: 'Credit',
      [PaymentMethod.MIXED]: 'Mixed'
    };
    return labels[method] || method;
  }

  openCommentDialog(item: PosCartItem): void {
    this.editingCommentForItem = item;
    this.itemCommentText = item.comments || '';
  }

  saveItemComment(): void {
    if (this.editingCommentForItem) {
      this.editingCommentForItem.comments = this.itemCommentText.trim() || undefined;
      this.closeCommentDialog();
      this.notification.success('Comment added');
    }
  }

  closeCommentDialog(): void {
    this.editingCommentForItem = null;
    this.itemCommentText = '';
  }

  removeItemComment(item: PosCartItem): void {
    item.comments = undefined;
    this.notification.info('Comment removed');
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      document.body.classList.add('pos-fullscreen-mode');
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.body.classList.remove('pos-fullscreen-mode');
      document.exitFullscreen().catch(() => {});
    }
  }

  // Long press handlers
  onProductPressStart(product: Product, event: MouseEvent | TouchEvent): void {
    this.wasLongPress = false;
    
    this.longPressTimer = setTimeout(() => {
      this.wasLongPress = true;
      this.showProductDetails(product);
      this.longPressTimer = null;
    }, this.longPressDelay);
  }

  onProductPressEnd(event: MouseEvent | TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onProductPressCancel(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.wasLongPress = false;
  }

  addToCart(product: Product): void {
    // Prevent adding to cart if it was a long press
    if (this.wasLongPress) {
      this.wasLongPress = false;
      return;
    }
    
    if (product.stock <= 0) {
      this.notification.warning('Product is out of stock');
      return;
    }

    const existingItem = this.cart.find(item => item.product.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        this.notification.warning('Insufficient stock');
        return;
      }
      existingItem.quantity++;
      this.updateCartItem(existingItem);
    } else {
      const newItem: PosCartItem = {
        product,
        quantity: 1,
        price: product.price,
        subtotal: product.price,
        total: product.price * (1 + (product.taxRate || 0)),
        comments: undefined
      };
      this.cart.push(newItem);
      this.updateCartItem(newItem);
    }

    this.calculateTotals();
    this.notification.success(`${product.name} added to cart`);
  }

  showProductDetails(product: Product): void {
    this.selectedProductForDetails = product;
    this.showProductDetailsDialog = true;
  }

  closeProductDetailsDialog(): void {
    this.showProductDetailsDialog = false;
    this.selectedProductForDetails = null;
  }

  addToCartFromDetails(): void {
    if (this.selectedProductForDetails) {
      this.addToCart(this.selectedProductForDetails);
      this.closeProductDetailsDialog();
    }
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

  /**
   * Get category icon for quick filter button
   */
  getCategoryIcon(category: Category): string {
    return category.icon || this.categoriesService.getCategoryIcon(category.name);
  }

  /**
   * Generate a guest UUID for POS orders
   * Uses a consistent UUID based on user ID or generates a system UUID
   */
  private generatePosGuestUuid(): string {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.id) {
      // Use a consistent UUID based on user ID for POS orders
      return `pos-${currentUser.id}`;
    }
    // Generate a system UUID for POS
    return `pos-system-${Date.now()}`;
  }

  /**
   * Convert POS CartItem format to OrderService CartItem format
   */
  private convertPosCartItemsToOrderItems(posCartItems: PosCartItem[]): OrderCartItem[] {
    return posCartItems.map(posItem => {
      // Convert Product to MenuItem format
      const menuItem: MenuItem = {
        id: posItem.product.id,
        name: posItem.product.name,
        description: posItem.product.description,
        price: posItem.product.price,
        originalPrice: posItem.product.price,
        image: posItem.product.image || '/assets/images/products/product-1.png',
        category: posItem.product.category || 'uncategorized',
        badge: undefined,
        badgeColor: undefined,
        rating: 0,
        isTopRated: false
      };

      // Convert to OrderService CartItem format
      const orderCartItem: OrderCartItem = {
        id: `${posItem.product.id}-${Date.now()}-${Math.random()}`,
        item: menuItem,
        quantity: posItem.quantity,
        notes: posItem.comments,
        price: posItem.price,
        subtotal: posItem.subtotal,
        selectedAddons: [], // POS doesn't currently support addons, but structure is ready
        addonUnitTotal: 0
      };

      return orderCartItem;
    });
  }

  /**
   * Map PaymentMethod enum to order payment method string
   */
  private mapPaymentMethodToOrderFormat(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.CASH:
        return 'cash';
      case PaymentMethod.CARD:
        return 'card';
      case PaymentMethod.MOBILE_PAYMENT:
        return 'digital_wallet';
      case PaymentMethod.CREDIT:
        return 'card';
      case PaymentMethod.MIXED:
        return 'cash'; // Default to cash for mixed payments
      default:
        return 'cash';
    }
  }

  /**
   * Connect to real-time updates for a created order
   */
  private connectOrderRealtime(orderId: string): void {
    if (this.createdOrderSubscription) {
      this.createdOrderSubscription.unsubscribe();
    }

    this.createdOrderSubscription = this.realtimeOrders
      .connectRealtimeOrderSingle(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          // Order status updated - you can add UI feedback here if needed
          console.log('Order status updated:', order.status);
        },
        error: (error) => {
          console.error('Single order real-time connection error:', error);
        }
      });
  }
}
