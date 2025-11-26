import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Product, CartItem, Sale, PaymentMethod, SaleStatus, Customer, Table } from '../../../models/product.model';
import { Item } from '../../../models/item.model';
import { Category } from '../../../models/category.model';
import { ApiService } from '../../../services/api.service';
import { ItemsService } from '../../../services/items.service';
import { CategoriesService } from '../../../services/categories.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { InventoryDeductionService } from '../../../services/inventory-deduction.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../components/confirm-dialog/confirm-dialog.component';

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
  cart: CartItem[] = [];
  
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
  editingCommentForItem: CartItem | null = null;
  itemCommentText: string = '';
  isFullscreen: boolean = false;
  showProductDetailsDialog: boolean = false;
  selectedProductForDetails: Product | null = null;
  
  // Long press state
  private longPressTimer: any = null;
  private longPressDelay: number = 500; // 500ms for long press
  private wasLongPress: boolean = false;
  
  // Expose enum to template
  PaymentMethod = PaymentMethod;
  
  // Menu ID for items API
  menuId: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private itemsService: ItemsService,
    private categoriesService: CategoriesService,
    private notification: NotificationService,
    private authService: AuthService,
    private localStorage: LocalStorageService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private inventoryDeduction: InventoryDeductionService
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
    this.setupSearch();
    this.updateCategories();
    this.setupFullscreenListener();
    this.loadTables();
    this.checkQueryParams();
  }

  checkQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      if (params['tableNumber']) {
        this.selectedTableNumber = params['tableNumber'];
      }
      if (params['tableId']) {
        // Optionally load table details if needed
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
    // Clean up fullscreen mode class
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
    
    // Build query - menuId is optional
    const query: any = { 
      isAvailable: true // Only load available items
    };
    
    // Add menuId if available
    if (this.menuId) {
      query.menuId = this.menuId;
    }
    
    this.itemsService.getItems(query).subscribe({
      next: (items) => {
        // Convert Items to Products for display
        this.products = items.map(item => this.itemToProduct(item));
        this.filteredProducts = this.products;
        this.updateCategories();
        this.loadQuickFilterCategories(items);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading items:', error);
        this.products = [];
        this.filteredProducts = [];
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
    this.quickFilterCategories = this.categoriesService.extractCategoriesFromItems(
      items, 
      this.menuId || 'default', 
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

  updateCartItem(item: CartItem): void {
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

  removeFromCart(item: CartItem): void {
    const index = this.cart.indexOf(item);
    if (index > -1) {
      this.cart.splice(index, 1);
      this.calculateTotals();
      this.notification.info('Item removed from cart');
    }
  }

  updateQuantity(item: CartItem, change: number): void {
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

  applyDiscount(item: CartItem, discount: number, type: 'percentage' | 'fixed' = 'percentage'): void {
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

  processPayment(): void {
    if (this.isProcessing) return;

    if (this.paymentMethod === PaymentMethod.CASH && this.cashReceived < this.total) {
      this.notification.error('Insufficient cash received');
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
    
    const sale: Sale = {
      saleNumber: 'SALE-' + Date.now(),
      customerId: this.selectedCustomer?.id,
      customerName: this.selectedCustomer?.name,
      items: this.cart,
      subtotal: this.subtotal,
      tax: this.tax,
      discount: this.discount,
      total: this.total,
      paymentMethod: this.paymentMethod,
      cashReceived: this.paymentMethod === PaymentMethod.CASH ? this.cashReceived : undefined,
      change: this.paymentMethod === PaymentMethod.CASH ? this.change : undefined,
      status: SaleStatus.COMPLETED,
      notes: notes || undefined,
      cashierId: currentUser?.id || '',
      cashierName: currentUser?.username || 'Cashier',
    };

    // Deduct inventory for this sale
    this.inventoryDeduction.deductInventoryForSale(sale).subscribe({
      next: (success) => {
        if (success) {
          console.log(`Inventory deducted successfully for sale ${sale.saleNumber}`);
        } else {
          console.warn(`Inventory deduction had issues for sale ${sale.saleNumber}`);
        }
      },
      error: (error) => {
        console.error('Error deducting inventory:', error);
        // Don't fail the sale if inventory deduction fails
      }
    });

    // Mock API call
    setTimeout(() => {
      this.isProcessing = false;
      this.notification.success('Sale completed successfully!');
      this.printReceipt(sale);
      this.showPaymentDialog = false;
      this.clearCart();
    }, 1000);

    // Real API call (uncomment when backend is ready):
    // this.api.post<Sale>('/sales', sale).subscribe({
    //   next: (savedSale) => {
    //     this.isProcessing = false;
    //     this.notification.success('Sale completed successfully!');
    //     this.printReceipt(savedSale);
    //     this.clearCart();
    //     this.showPaymentDialog = false;
    //   },
    //   error: () => {
    //     this.isProcessing = false;
    //   }
    // });
  }

  printReceipt(sale: Sale): void {
    // Implement receipt printing logic
    console.log('Printing receipt:', sale);
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

  openCommentDialog(item: CartItem): void {
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

  removeItemComment(item: CartItem): void {
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
      const newItem: CartItem = {
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
}
