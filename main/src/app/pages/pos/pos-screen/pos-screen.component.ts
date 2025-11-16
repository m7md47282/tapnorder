import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Product, CartItem, Sale, PaymentMethod, SaleStatus, Customer, Table } from '../../../models/product.model';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
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
  
  private destroy$ = new Subject<void>();
  
  // Mock data for development - Coffee Shop Items
  private mockProducts: Product[] = [
    // Hot Coffee Drinks
    { id: '1', name: 'Espresso', sku: 'ESP', price: 2.50, stock: 999, category: 'Hot Coffee', image: '/assets/images/products/product-1.png', isActive: true, taxRate: 0.1 },
    { id: '2', name: 'Americano', sku: 'AMR', price: 3.00, stock: 999, category: 'Hot Coffee', image: '/assets/images/products/product-2.png', isActive: true, taxRate: 0.1 },
    { id: '3', name: 'Cappuccino', sku: 'CAP', price: 4.50, stock: 999, category: 'Hot Coffee', image: '/assets/images/products/product-3.png', isActive: true, taxRate: 0.1 },
    { id: '4', name: 'Latte', sku: 'LAT', price: 4.75, stock: 999, category: 'Hot Coffee', image: '/assets/images/products/product-4.png', isActive: true, taxRate: 0.1 },
    { id: '5', name: 'Mocha', sku: 'MOC', price: 5.25, stock: 999, category: 'Hot Coffee', image: '/assets/images/products/s11.jpg', isActive: true, taxRate: 0.1 },
    { id: '6', name: 'Macchiato', sku: 'MAC', price: 4.00, stock: 999, category: 'Hot Coffee', image: '/assets/images/products/s4.jpg', isActive: true, taxRate: 0.1 },
    { id: '7', name: 'Flat White', sku: 'FLW', price: 4.50, stock: 999, category: 'Hot Coffee', image: '/assets/images/products/s5.jpg', isActive: true, taxRate: 0.1 },
    { id: '8', name: 'Cortado', sku: 'COR', price: 3.75, stock: 999, category: 'Hot Coffee', image: '/assets/images/products/s6.jpg', isActive: true, taxRate: 0.1 },
    
    // Iced Coffee Drinks
    { id: '9', name: 'Iced Coffee', sku: 'ICF', price: 3.50, stock: 999, category: 'Iced Coffee', image: '/assets/images/products/s7.jpg', isActive: true, taxRate: 0.1 },
    { id: '10', name: 'Iced Latte', sku: 'ILT', price: 4.75, stock: 999, category: 'Iced Coffee', image: '/assets/images/products/s9.jpg', isActive: true, taxRate: 0.1 },
    { id: '11', name: 'Cold Brew', sku: 'CBR', price: 4.50, stock: 999, category: 'Iced Coffee', image: '/assets/images/products/product-1.png', isActive: true, taxRate: 0.1 },
    { id: '12', name: 'Iced Mocha', sku: 'IMO', price: 5.25, stock: 999, category: 'Iced Coffee', image: '/assets/images/products/product-2.png', isActive: true, taxRate: 0.1 },
    
    // Tea & Other Beverages
    { id: '13', name: 'Green Tea', sku: 'GRT', price: 3.00, stock: 999, category: 'Tea', image: '/assets/images/products/s6.jpg', isActive: true, taxRate: 0.1 },
    { id: '14', name: 'Black Tea', sku: 'BLT', price: 3.00, stock: 999, category: 'Tea', image: '/assets/images/products/s5.jpg', isActive: true, taxRate: 0.1 },
    { id: '15', name: 'Chai Latte', sku: 'CHL', price: 4.50, stock: 999, category: 'Tea', image: '/assets/images/products/s4.jpg', isActive: true, taxRate: 0.1 },
    
    // Pastries & Food
    { id: '16', name: 'Croissant', sku: 'CRS', price: 3.50, stock: 50, category: 'Pastries', image: '/assets/images/products/product-3.png', isActive: true, taxRate: 0.1 },
    { id: '17', name: 'Muffin', sku: 'MUF', price: 3.25, stock: 40, category: 'Pastries', image: '/assets/images/products/product-4.png', isActive: true, taxRate: 0.1 },
    { id: '18', name: 'Bagel', sku: 'BGL', price: 2.75, stock: 35, category: 'Pastries', image: '/assets/images/products/s11.jpg', isActive: true, taxRate: 0.1 },
    { id: '19', name: 'Danish', sku: 'DAN', price: 3.75, stock: 30, category: 'Pastries', image: '/assets/images/products/s4.jpg', isActive: true, taxRate: 0.1 },
    
    // Add-ons
    { id: '20', name: 'Extra Shot', sku: 'XSH', price: 0.75, stock: 999, category: 'Add-ons', image: '/assets/images/products/s5.jpg', isActive: true, taxRate: 0.1 },
    { id: '21', name: 'Oat Milk', sku: 'OAT', price: 0.50, stock: 999, category: 'Add-ons', image: '/assets/images/products/s6.jpg', isActive: true, taxRate: 0.1 },
    { id: '22', name: 'Almond Milk', sku: 'ALM', price: 0.50, stock: 999, category: 'Add-ons', image: '/assets/images/products/s7.jpg', isActive: true, taxRate: 0.1 },
    { id: '23', name: 'Syrup Shot', sku: 'SYP', price: 0.50, stock: 999, category: 'Add-ons', image: '/assets/images/products/s9.jpg', isActive: true, taxRate: 0.1 },
  ];

  constructor(
    private api: ApiService,
    private notification: NotificationService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
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
    
    // Mock API call - replace with real API
    setTimeout(() => {
      this.products = this.mockProducts;
      this.filteredProducts = this.products;
      this.isLoading = false;
    }, 500);

    // Real API call (uncomment when backend is ready):
    // this.api.get<Product[]>('/products', { isActive: true }).subscribe({
    //   next: (products) => {
    //     this.products = products;
    //     this.filteredProducts = products;
    //     this.isLoading = false;
    //   },
    //   error: () => {
    //     this.isLoading = false;
    //   }
    // });
  }

  updateCategories(): void {
    const cats = new Set(this.products.map(p => p.category || 'Uncategorized'));
    this.categories = ['all', ...Array.from(cats)];
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

  applyQuickFilter(filter: string): void {
    this.activeQuickFilter = filter;
    this.selectedCategory = 'all';
    this.searchTerm = '';
    this.searchControl.setValue('');
    
    if (filter === 'popular') {
      // Filter popular items (you can customize this logic)
      this.filteredProducts = this.products.filter(p => 
        ['Latte', 'Cappuccino', 'Espresso', 'Iced Coffee', 'Croissant'].includes(p.name)
      );
    } else if (filter === 'hot') {
      this.filteredProducts = this.products.filter(p => p.category === 'Hot Coffee');
    } else if (filter === 'iced') {
      this.filteredProducts = this.products.filter(p => p.category === 'Iced Coffee');
    } else if (filter === 'tea') {
      this.filteredProducts = this.products.filter(p => p.category === 'Tea');
    } else if (filter === 'pastries') {
      this.filteredProducts = this.products.filter(p => p.category === 'Pastries');
    } else if (filter === 'addons') {
      this.filteredProducts = this.products.filter(p => p.category === 'Add-ons');
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
}
