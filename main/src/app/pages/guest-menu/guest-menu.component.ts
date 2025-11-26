import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../material.module';
import { CartService, CartItem } from '../../services/cart.service';
import { IndexedDBService } from '../../services/indexeddb.service';
import { OrderService } from '../../services/order.service';
import { OrderTrackingService } from '../../services/order-tracking.service';
import { NotificationService } from '../../services/notification.service';
import { Order, OrderStatus } from '../../models/order.model';
import { ItemsService } from '../../services/items.service';
import { CategoriesService } from '../../services/categories.service';
import { Item } from '../../models/item.model';
import { Category } from '../../models/category.model';
import { Subject, takeUntil } from 'rxjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface MenuCategory {
  id: string;
  name: string;
  icon?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  badge?: string;
  badgeColor?: string;
  rating?: number;
  isTopRated?: boolean;
}

import { OrderStatusComponent } from './components/order-status/order-status.component';
import { AiChatComponent } from './components/ai-chat/ai-chat.component';
import { AiAssistantService, CustomOrderSuggestion } from '../../services/ai-assistant.service';

@Component({
  selector: 'app-guest-menu',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, OrderStatusComponent, AiChatComponent],
  templateUrl: './guest-menu.component.html',
  styleUrls: ['./guest-menu.component.scss']
})
export class GuestMenuComponent implements OnInit, OnDestroy {
  restaurantName: string = 'Triple Chocolate';
  cuisine: string = 'Arabic';
  rating: number = 4.6;
  ratingCount: number = 1000;
  deliveryTime: string = '15-25 mins';
  deliveryFee: number = 1.75;
  currency: string = 'JOD';
  
  selectedCategory: string = 'picks-for-you';
  selectedItem: MenuItem | null = null;
  
  cartItems: CartItem[] = [];
  cartItemCount: number = 0;
  cartTotal: number = 0;
  isCartOpen: boolean = false;
  selectedCartItemForNotes: CartItem | null = null;
  notesInput: string = '';
  
  // URL Parameters
  placeId: string | null = null;
  branchId: string | null = null;
  tableId: string | null = null;
  guestUuid: string | null = null;
  menuId: string | null = null;
  
  // Loading state
  isLoadingItems: boolean = false;
  
  // Order Management
  activeOrder: Order | null = null;
  hiddenOrders: Order[] = []; // Orders that have been hidden
  showReceipt: boolean = false;
  showLastOrders: boolean = false;
  orderTableNumber: string = '';
  orderDate: Date = new Date();
  orderNumber: string = '';
  receiptItems: CartItem[] = []; // Store items for receipt display
  
  get receiptTotal(): number {
    return this.receiptItems.reduce((total, item) => total + item.subtotal, 0);
  }
  
  get isTakeaway(): boolean {
    return !this.tableId;
  }
  
  get hasActiveOrder(): boolean {
    return this.activeOrder !== null && 
           this.activeOrder.status !== OrderStatus.SERVED && 
           this.activeOrder.status !== OrderStatus.CANCELLED;
  }
  
  private destroy$ = new Subject<void>();
  
  categories: MenuCategory[] = [
    { id: 'picks-for-you', name: 'Picks for you', icon: 'local_fire_department' }
  ];

  menuItems: MenuItem[] = [];
  filteredItems: MenuItem[] = [];
  
  // Map category names to category IDs for items that only have category names
  private categoryNameToIdMap: Map<string, string> = new Map();

  /**
   * Get items grouped by category
   */
  get itemsByCategory(): Map<string, MenuItem[]> {
    const grouped = new Map<string, MenuItem[]>();
    
    this.menuItems.forEach(item => {
      const categoryId = item.category;
      if (!grouped.has(categoryId)) {
        grouped.set(categoryId, []);
      }
      grouped.get(categoryId)!.push(item);
    });
    
    return grouped;
  }

  /**
   * Get category items for a specific category ID
   */
  getCategoryItems(categoryId: string): MenuItem[] {
    return this.menuItems.filter(item => item.category === categoryId);
  }

  get currentCategoryName(): string {
    return this.categories.find(c => c.id === this.selectedCategory)?.name || 'Menu';
  }

  get offerItems(): MenuItem[] {
    return this.menuItems.filter(item => item.category === 'offers');
  }

  get appetizerItems(): MenuItem[] {
    return this.menuItems.filter(item => item.category === 'appetizers');
  }

  get mainDishItems(): MenuItem[] {
    return this.menuItems.filter(item => item.category === 'mains');
  }

  get beverageItems(): MenuItem[] {
    return this.menuItems.filter(item => item.category === 'beverages');
  }

  calculateSavings(item: MenuItem): number {
    if (item.originalPrice) {
      return item.originalPrice - item.price;
    }
    return 0;
  }

  constructor(
    private cartService: CartService,
    private route: ActivatedRoute,
    private router: Router,
    private indexedDB: IndexedDBService,
    private orderService: OrderService,
    private orderTracking: OrderTrackingService,
    private notification: NotificationService,
    private aiService: AiAssistantService,
    private itemsService: ItemsService,
    private categoriesService: CategoriesService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    // Load cart data
    this.cartService.cart$.pipe(takeUntil(this.destroy$)).subscribe(cart => {
      this.cartItems = cart;
      this.cartItemCount = this.cartService.getCartItemCount();
      this.cartTotal = this.cartService.getCartTotal();
    });

    // Handle URL query parameters
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(async params => {
      this.placeId = params['place_id'] || null;
      this.branchId = params['branch_id'] || null;
      this.tableId = params['table_id'] || null;
      this.menuId = params['menu_id'] || null;

      // Load items from database
      this.loadItems();

      // Only initialize guest UUID if place_id and branch_id are present
      if (this.placeId && this.branchId) {
        await this.initializeGuestSession();
      } else {
        // If no place_id/branch_id, this is not a valid QR code URL
        // You might want to show an error or redirect
        console.warn('Missing place_id or branch_id in URL');
      }
    });
  }

  ngOnDestroy(): void {
    // Stop tracking all orders
    this.orderTracking.stopAllTracking();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize guest session and check for active orders
   */
  private async initializeGuestSession(): Promise<void> {
    try {
      // Get or create guest UUID
      this.guestUuid = await this.indexedDB.getOrCreateGuestUuid(
        this.placeId!,
        this.branchId!,
        this.tableId
      );

      // Update filtered items when guest UUID is set
      this.updateFilteredItems();
      this.cdr.detectChanges();

      // Initialize orders for this guest
      await this.orderService.initializeOrders(this.guestUuid);

      // Subscribe to active order
      this.orderService.activeOrder$
        .pipe(takeUntil(this.destroy$))
        .subscribe(order => {
          this.activeOrder = order;
          
          // Start tracking if there's an active order
          if (order) {
            this.orderTracking.startTracking(order.id);
            
            // Subscribe to order status changes
            this.orderTracking.getOrderStatus$(order.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe(status => {
                if (order) {
                  order.status = status;
                }
              });
          }
        });

      // Load active order
      this.orderService.getActiveOrder(this.guestUuid).subscribe(order => {
        this.activeOrder = order;
        if (order) {
          this.orderTracking.startTracking(order.id);
        }
      });

    } catch (error) {
      console.error('Error initializing guest session:', error);
      this.notification.error('Failed to initialize session. Please try again.');
    }
  }

  selectCategory(categoryId: string): void {
    this.selectedCategory = categoryId;
    this.updateFilteredItems();
  }

  /**
   * Update filtered items based on current category and guest UUID
   * This method ensures filteredItems is updated outside of change detection
   * FILTER DISABLED FOR TESTING - showing all items
   */
  private updateFilteredItems(): void {
    // DISABLED FOR TESTING - Show all items regardless of filter
    this.filteredItems = [...this.menuItems];
    
    // Original filtering logic (commented out for testing):
    // if (this.selectedCategory === 'picks-for-you') {
    //   // Use AI-driven recommendations if guest UUID exists
    //   if (this.guestUuid) {
    //     this.filteredItems = this.aiService.getPersonalizedRecommendations(this.guestUuid, this.menuItems);
    //   } else {
    //     // Fallback to top-rated items
    //     this.filteredItems = this.menuItems.filter(item => item.isTopRated || (item.rating && item.rating >= 4.6));
    //   }
    // } else {
    //   this.filteredItems = this.menuItems.filter(item => item.category === this.selectedCategory);
    // }
  }

  openItemModal(item: MenuItem): void {
    this.selectedItem = item;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeItemModal(): void {
    this.selectedItem = null;
    // Restore body scroll
    document.body.style.overflow = '';
  }

  addToCart(item: MenuItem): void {
    this.cartService.addToCart(item, 1);
    this.closeItemModal();
  }

  removeFromCart(cartItemId: string): void {
    this.cartService.removeFromCart(cartItemId);
  }

  updateQuantity(cartItemId: string, change: number): void {
    const item = this.cartItems.find(c => c.id === cartItemId);
    if (item) {
      const newQuantity = item.quantity + change;
      this.cartService.updateQuantity(cartItemId, newQuantity);
    }
  }

  updateItemNotes(cartItemId: string, notes: string): void {
    this.cartService.updateNotes(cartItemId, notes);
  }

  openNotesDialog(item: CartItem): void {
    this.selectedCartItemForNotes = item;
    this.notesInput = item.notes || '';
  }

  closeNotesDialog(): void {
    this.selectedCartItemForNotes = null;
    this.notesInput = '';
  }

  saveNotes(): void {
    if (this.selectedCartItemForNotes) {
      this.updateItemNotes(this.selectedCartItemForNotes.id, this.notesInput);
      this.closeNotesDialog();
    }
  }

  toggleCart(): void {
    this.isCartOpen = !this.isCartOpen;
  }

  closeCart(): void {
    this.isCartOpen = false;
  }

  async processPayment(paymentMethod: string): Promise<void> {
    // Validate required parameters
    if (!this.placeId || !this.branchId || !this.guestUuid) {
      this.notification.error('Session error. Please refresh the page.');
      return;
    }

    if (this.cartItems.length === 0) {
      this.notification.warning('Your cart is empty.');
      return;
    }

    try {
      // Create order
      const order = await this.orderService.createOrder(
        this.cartItems,
        this.placeId,
        this.branchId,
        this.tableId,
        this.guestUuid,
        paymentMethod,
        undefined, // notes
        this.currency
      );
    
      // Store order data for receipt
    this.receiptItems = [...this.cartItems];
      this.orderNumber = order.orderNumber;
      this.orderDate = order.createdAt;
      this.orderTableNumber = order.tableId || '';

      // Start tracking the order
      this.orderTracking.startTracking(order.id);

      // Subscribe to order status changes
      this.orderTracking.getOrderStatus$(order.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(status => {
          order.status = status;
        });
    
      // Update AI preferences from order
      if (this.guestUuid) {
        this.aiService.updatePreferencesFromOrder(this.guestUuid, order);
      }
    
      // Show success notification
      this.notification.success('Order placed successfully!');

      // Show receipt
    this.showReceipt = true;
    this.closeCart();
    
    // Clear cart after showing receipt
    this.cartService.clearCart();

    } catch (error) {
      console.error('Error creating order:', error);
      this.notification.error('Failed to place order. Please try again.');
    }
  }

  closeReceipt(): void {
    this.showReceipt = false;
    this.orderTableNumber = '';
    this.receiptItems = [];
  }

  onHideOrder(order: Order): void {
    // Add order to hidden orders list
    if (!this.hiddenOrders.find(o => o.id === order.id)) {
      this.hiddenOrders.unshift(order); // Add to beginning
      // Keep only last 10 orders
      if (this.hiddenOrders.length > 10) {
        this.hiddenOrders = this.hiddenOrders.slice(0, 10);
      }
    }
    
    // Clear active order if it's the one being hidden
    if (this.activeOrder?.id === order.id) {
      this.activeOrder = null;
    }
    
    // Stop tracking this order
    this.orderTracking.stopTracking(order.id);
    
    // Show last orders if not already shown
    if (!this.showLastOrders && this.hiddenOrders.length > 0) {
      this.showLastOrders = true;
    }
  }

  toggleLastOrders(): void {
    this.showLastOrders = !this.showLastOrders;
  }

  saveReceiptAsScreenshot(): void {
    // Use setTimeout to ensure the view is rendered
    setTimeout(() => {
      const receiptElement = document.querySelector('.receipt-modal') as HTMLElement;
      if (!receiptElement) {
        console.error('Receipt element not found');
        return;
      }

      // Hide action buttons for screenshot
      const actionButtons = receiptElement.querySelector('.receipt-actions') as HTMLElement;
      const closeButton = receiptElement.querySelector('.receipt-header .close-btn') as HTMLElement;
      
      if (actionButtons) actionButtons.style.display = 'none';
      if (closeButton) closeButton.style.display = 'none';

      html2canvas(receiptElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        windowWidth: receiptElement.scrollWidth,
        windowHeight: receiptElement.scrollHeight
      }).then((canvas) => {
        // Restore buttons
        if (actionButtons) actionButtons.style.display = '';
        if (closeButton) closeButton.style.display = '';

        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
          if (blob) {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `receipt-${this.orderNumber}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }
        }, 'image/png');
      }).catch((error) => {
        console.error('Error generating screenshot:', error);
        // Restore buttons on error
        if (actionButtons) actionButtons.style.display = '';
        if (closeButton) closeButton.style.display = '';
      });
    }, 100);
  }

  saveReceiptAsPDF(): void {
    // Use setTimeout to ensure the view is rendered
    setTimeout(() => {
      const receiptElement = document.querySelector('.receipt-modal') as HTMLElement;
      if (!receiptElement) {
        console.error('Receipt element not found');
        return;
      }

      // Hide action buttons for PDF
      const actionButtons = receiptElement.querySelector('.receipt-actions') as HTMLElement;
      const closeButton = receiptElement.querySelector('.receipt-header .close-btn') as HTMLElement;
      
      if (actionButtons) actionButtons.style.display = 'none';
      if (closeButton) closeButton.style.display = 'none';

      html2canvas(receiptElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        windowWidth: receiptElement.scrollWidth,
        windowHeight: receiptElement.scrollHeight
      }).then((canvas) => {
        // Restore buttons
        if (actionButtons) actionButtons.style.display = '';
        if (closeButton) closeButton.style.display = '';

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`receipt-${this.orderNumber}.pdf`);
      }).catch((error) => {
        console.error('Error generating PDF:', error);
        // Restore buttons on error
        if (actionButtons) actionButtons.style.display = '';
        if (closeButton) closeButton.style.display = '';
      });
    }, 100);
  }

  saveReceipt(): void {
    // Create receipt content
    const receiptContent = this.generateReceiptContent();
    
    // Create a blob with the receipt content
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${this.orderNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private generateReceiptContent(): string {
    const receiptTotal = this.receiptItems.reduce((total, item) => total + item.subtotal, 0);
    
    let content = `\n`;
    content += `========================================\n`;
    content += `         ${this.restaurantName.toUpperCase()}\n`;
    content += `========================================\n`;
    content += `Order Number: ${this.orderNumber}\n`;
    content += `Date: ${this.orderDate.toLocaleString()}\n`;
    if (this.orderTableNumber) {
      content += `Table Number: ${this.orderTableNumber}\n`;
    }
    content += `----------------------------------------\n`;
    content += `ITEMS:\n`;
    content += `----------------------------------------\n`;
    
    this.receiptItems.forEach(item => {
      content += `${item.item.name}\n`;
      content += `  Qty: ${item.quantity} × ${this.currency} ${item.price.toFixed(2)} = ${this.currency} ${item.subtotal.toFixed(2)}\n`;
      if (item.notes) {
        content += `  Note: ${item.notes}\n`;
      }
    });
    
    content += `----------------------------------------\n`;
    content += `TOTAL: ${this.currency} ${receiptTotal.toFixed(2)}\n`;
    content += `========================================\n`;
    content += `Thank you for your order!\n`;
    content += `\n`;
    
    return content;
  }

  getCategoryIcon(categoryId: string): string {
    return this.categories.find(c => c.id === categoryId)?.icon || 'restaurant';
  }

  goBack(): void {
    // Navigate back or close
    window.history.back();
  }

  getItemBackgroundColor(item: MenuItem): string {
    return item.badgeColor === 'orange' ? '#FFB800' : '#5E5E5E';
  }

  onAddCustomOrder(customOrder: CustomOrderSuggestion): void {
    // Create notes string with modifications and addons
    const notesParts: string[] = [];
    
    if (customOrder.modifications.length > 0) {
      notesParts.push(...customOrder.modifications);
    }
    
    if (customOrder.addons.length > 0) {
      notesParts.push(`Add-ons: ${customOrder.addons.map(a => a.name).join(', ')}`);
    }
    
    const notes = notesParts.join(' | ');
    
    // Add base item to cart with notes
    this.cartService.addToCart(customOrder.baseItem, 1, notes);
    
    // Add addons as separate items (if they have price > 0)
    customOrder.addons.forEach(addon => {
      if (addon.price > 0) {
        this.cartService.addToCart(addon, 1);
      }
    });

    // Show notification
    this.notification.success(`Custom order added to cart!`);
  }

  onAddItemFromAI(item: MenuItem): void {
    this.addToCart(item);
    this.notification.success(`${item.name} added to cart!`);
  }

  /**
   * Load items from the database
   */
  loadItems(): void {
    this.isLoadingItems = true;
    
    // Build query - only load available items
    const query: any = { 
      isAvailable: true
    };
    
    // Add menuId if available
    if (this.menuId) {
      query.menuId = this.menuId;
    }
    
    // Load categories first, then items
    this.loadCategories();
    
    this.itemsService.getItems(query).subscribe({
      next: (items) => {
        // Ensure items is an array
        const itemsArray = Array.isArray(items) ? items : [];
        
        // Convert Items to MenuItems
        this.menuItems = itemsArray.map(item => this.itemToMenuItem(item));
        
        // Update filtered items after loading
        this.updateFilteredItems();
        
        this.isLoadingItems = false;
      },
      error: (error) => {
        console.error('Error loading items:', error);
        this.menuItems = [];
        this.filteredItems = [];
        this.isLoadingItems = false;
        this.notification.error('Failed to load menu items. Please try again.');
      }
    });
  }

  /**
   * Normalize category name to ID format
   */
  private normalizeCategoryId(categoryName: string): string {
    return categoryName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Convert Item model to MenuItem format
   */
  private itemToMenuItem(item: any): MenuItem {
    // Default image if not provided
    const defaultImage = '/assets/images/products/product-1.png';
    
    // Use categoryId if available (preferred), otherwise try to match by category name
    let categoryId: string;
    if (item.categoryId) {
      // Use categoryId directly - it should match the category.id from API
      categoryId = item.categoryId;
    } else if (item.category) {
      // Try to find matching category ID from the name-to-id map
      const matchedId = this.categoryNameToIdMap.get(item.category);
      if (matchedId) {
        categoryId = matchedId;
      } else {
        // Fallback: normalize category name to ID format
        categoryId = this.normalizeCategoryId(item.category);
      }
    } else {
      categoryId = 'uncategorized';
    }
    
    // Determine if item should be top-rated (you can customize this logic)
    const isTopRated = item.price > 5; // Example: items over 5 JOD are top-rated
    
    // Generate rating (you can customize this logic or get from item.specs)
    const rating = item.specs?.calories ? 4.5 + (item.specs.calories % 10) / 10 : 4.5;
    
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.imageUrl || defaultImage,
      category: categoryId, // Use category ID that matches category.id from API
      rating: Math.min(5, Math.max(4, rating)), // Keep rating between 4 and 5
      isTopRated: isTopRated
    };
  }

  /**
   * Load categories from API
   */
  private loadCategories(): void {
    // Build query for categories
    const query: any = { 
      isActive: true 
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
        
        // Build category name to ID mapping for items that only have category names
        this.categoryNameToIdMap.clear();
        categoriesArray.forEach(cat => {
          // Map category name to its ID
          this.categoryNameToIdMap.set(cat.name, cat.id);
          // Also map normalized name to ID for better matching
          const normalizedName = this.normalizeCategoryId(cat.name);
          if (normalizedName !== cat.id) {
            this.categoryNameToIdMap.set(normalizedName, cat.id);
          }
        });
        
        // Convert Category model to MenuCategory format
        // Keep "Picks for you" as the first category
        const dynamicCategories: MenuCategory[] = categoriesArray
          .filter(cat => cat.isActive !== false)
          .map(cat => ({
            id: cat.id,
            name: cat.name,
            icon: this.categoriesService.getCategoryIcon(cat.name) || 'restaurant'
          }))
          .sort((a, b) => {
            // Sort by displayOrder if available, otherwise by name
            const catA = categoriesArray.find(c => c.id === a.id);
            const catB = categoriesArray.find(c => c.id === b.id);
            if (catA?.displayOrder !== undefined && catB?.displayOrder !== undefined) {
              return (catA.displayOrder || 0) - (catB.displayOrder || 0);
            }
            return a.name.localeCompare(b.name);
          });

        // Update categories array, keeping "Picks for you" first
        this.categories = [
          { id: 'picks-for-you', name: 'Picks for you', icon: 'local_fire_department' },
          ...dynamicCategories
        ];
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        // Fallback: keep "Picks for you" category only
        this.categories = [
          { id: 'picks-for-you', name: 'Picks for you', icon: 'local_fire_department' }
        ];
        this.categoryNameToIdMap.clear();
      }
    });
  }
}

