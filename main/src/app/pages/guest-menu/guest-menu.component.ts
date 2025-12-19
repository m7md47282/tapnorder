import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../material.module';
import { CartService, CartItem, CartAddonSelection } from '../../services/cart.service';
import { IndexedDBService } from '../../services/indexeddb.service';
import { OrderService } from '../../services/order.service';
import { OrderTrackingService } from '../../services/order-tracking.service';
import { NotificationService } from '../../services/notification.service';
import { Order, OrderStatus, ACTIVE_ORDER_STATUSES } from '../../models/order.model';
import { ItemsService } from '../../services/items.service';
import { CategoriesService } from '../../services/categories.service';
import { Item } from '../../models/item.model';
import { AddonsService } from '../../services/addons.service';
import { ItemAddonGroup } from '../../models/addon.model';
import { Category } from '../../models/category.model';
import { PlaceService } from '../../services/place.service';
import { Place } from '../../models/place.model';
import { Subject, takeUntil, finalize, Subscription } from 'rxjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { RealtimeOrdersService } from '../../services/realtime-orders.service';

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
  addonGroups?: ItemAddonGroup[];
  hasRequiredAddons?: boolean;
  hasOptionalAddons?: boolean;
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
  restaurantName: string = 'Restaurant';
  cuisine: string = '';
  rating: number = 4.6;
  ratingCount: number = 1000;
  deliveryTime: string = '15-25 mins';
  deliveryFee: number = 1.75;
  currency: string = 'USD';
  placeLogo: string | null = null;
  currentPlace: Place | null = null;
  
  selectedCategory: string = 'picks-for-you';
  selectedItem: MenuItem | null = null;
  selectedItemQuantity: number = 1;
  selectedAddonState: Record<string, Record<string, number>> = {};
  addonValidationError: string | null = null;
  
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
  
  // Takeaway toggle
  forceTakeaway: boolean = false;
  
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

  cartDropAnimations: { id: number }[] = [];
  cartBadgeAnimationActive: boolean = false;
  private cartAnimationId: number = 0;
  private animationTimers: ReturnType<typeof setTimeout>[] = [];
  private previousCartItemCount: number = 0;
  private hasCartInitialized: boolean = false;
  
  get isTakeaway(): boolean {
    // If user toggled to takeaway, always return true
    if (this.forceTakeaway) {
      return true;
    }
    // Otherwise, check if tableId is missing from URL
    return !this.tableId;
  }
  
  get effectiveTableId(): string | null {
    return this.forceTakeaway ? null : this.tableId;
  }
  
  get hasActiveOrder(): boolean {
    return this.activeOrder !== null && 
           this.activeOrder.status !== OrderStatus.SERVED && 
           this.activeOrder.status !== OrderStatus.CANCELLED;
  }
  
  private destroy$ = new Subject<void>();
  private realtimeSubscription?: Subscription;
  private singleOrderSubscription?: Subscription;

  categories: MenuCategory[] = [
    { id: 'picks-for-you', name: 'Picks for you', icon: 'local_fire_department' }
  ];

  menuItems: MenuItem[] = [];
  filteredItems: MenuItem[] = [];

  private rawItems: Item[] = [];
  private addonGroupsMap: Map<string, ItemAddonGroup> = new Map();
  private addonGroupsByItemId: Map<string, ItemAddonGroup[]> = new Map();
  private addonGroupsByCategoryId: Map<string, ItemAddonGroup[]> = new Map();
  
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
    private addonsService: AddonsService,
    private placeService: PlaceService,
    private cdr: ChangeDetectorRef,
    private realtimeOrders: RealtimeOrdersService
  ) {}

  async ngOnInit(): Promise<void> {
    // Load cart data
    this.cartService.cart$.pipe(takeUntil(this.destroy$)).subscribe(cart => {
      this.cartItems = cart;
      const nextCount = this.cartService.getCartItemCount();
      if (this.hasCartInitialized && nextCount > this.previousCartItemCount) {
        this.startCartAddAnimation();
      }
      this.cartItemCount = nextCount;
      this.cartTotal = this.cartService.getCartTotal();
      this.previousCartItemCount = nextCount;
      this.hasCartInitialized = true;
    });

    // Handle URL query parameters
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(async params => {
      this.placeId = params['place_id'] || null;
      this.branchId = params['branch_id'] || null;
      this.tableId = params['table_id'] || null;
      this.menuId = params['menu_id'] || null;

      // Load place data if placeId is available
      if (this.placeId) {
        this.loadPlaceData(this.placeId);
      }

      // Load items from database
      this.loadItems();
      this.loadAddonGroups();

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
    this.orderTracking.stopAllTracking();
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
    if (this.singleOrderSubscription) {
      this.singleOrderSubscription.unsubscribe();
    }
    if (this.activeOrder) {
      this.realtimeOrders.disconnect(`order-single-${this.activeOrder.id}`);
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.clearAnimationTimers();
  }

  /**
   * Load place data to get currency, logo, and name
   */
  private loadPlaceData(placeId: string): void {
    this.placeService.getPlaceById(placeId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cdr.detectChanges())
      )
      .subscribe({
        next: (place) => {
          this.currentPlace = place;
          
          // Update restaurant name
          if (place.name) {
            this.restaurantName = place.name;
          }
          
          // Update currency from place settings
          if (place.settings?.currency) {
            this.currency = place.settings.currency;
          }
          
          // Update logo
          if (place.logoUrl) {
            this.placeLogo = place.logoUrl;
          } else {
            // Fallback to default logo if no logo is set
            this.placeLogo = '/assets/images/logos/tc-logo.png';
          }
          
          // Update delivery fee if available
          if (place.settings?.deliveryFee !== undefined) {
            this.deliveryFee = place.settings.deliveryFee;
          }
          
          // Update description/cuisine if available
          if (place.description) {
            this.cuisine = place.description;
          }
        },
        error: (error) => {
          console.error('Error loading place data:', error);
          // Use defaults if place data fails to load
          this.placeLogo = '/assets/images/logos/tc-logo.png';
        }
      });
  }

  private async initializeGuestSession(): Promise<void> {
    try {
      this.guestUuid = await this.indexedDB.getOrCreateGuestUuid(
        this.placeId!,
        this.branchId!,
        this.tableId
      );

      this.updateFilteredItems();
      this.cdr.detectChanges();

      await this.orderService.initializeOrders(this.guestUuid);

      this.connectRealtimeUpdates();

      this.orderService.activeOrder$
        .pipe(takeUntil(this.destroy$))
        .subscribe(order => {
          this.activeOrder = order;
          if (order) {
            this.connectSingleOrderRealtime(order.id);
          }
        });

      this.orderService.getActiveOrder(this.guestUuid).subscribe(order => {
        this.activeOrder = order;
        if (order) {
          this.connectSingleOrderRealtime(order.id);
        }
      });

    } catch (error) {
      console.error('Error initializing guest session:', error);
      this.notification.error('Failed to initialize session. Please try again.');
    }
  }

  private connectRealtimeUpdates(): void {
    if (!this.placeId || !this.guestUuid) {
      return;
    }

    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
    
    this.realtimeSubscription = this.realtimeOrders
      .connectRealtimeOrders(this.placeId, ACTIVE_ORDER_STATUSES, this.branchId, 6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          const guestOrders = orders.filter(order => order.guestUuid === this.guestUuid);
          
          if (guestOrders.length > 0) {
            const updatedOrder = guestOrders.find(o => 
              this.activeOrder && o.id === this.activeOrder.id
            );
            
            if (updatedOrder) {
              this.activeOrder = updatedOrder;
              this.orderTracking.updateOrderStatusDirectly(
                updatedOrder.id, 
                updatedOrder.status
              );
            }
          }
        },
        error: (error) => {
          console.error('Real-time connection error:', error);
          if (this.activeOrder) {
            this.orderTracking.startTracking(this.activeOrder.id, this.guestUuid || undefined);
          }
        }
      });

    this.realtimeOrders.getOrderUpdate$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(order => {
        if (order.guestUuid === this.guestUuid && this.activeOrder?.id === order.id) {
          this.activeOrder = order;
          this.orderTracking.updateOrderStatusDirectly(order.id, order.status);
        }
      });
  }

  private connectSingleOrderRealtime(orderId: string): void {
    if (this.singleOrderSubscription) {
      this.singleOrderSubscription.unsubscribe();
    }

    this.singleOrderSubscription = this.realtimeOrders
      .connectRealtimeOrderSingle(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          if (this.activeOrder?.id === order.id) {
            this.activeOrder = order;
            this.orderTracking.updateOrderStatusDirectly(order.id, order.status);
            
            if (order.status === OrderStatus.SERVED || order.status === OrderStatus.CANCELLED) {
              this.disconnectSingleOrderRealtime();
            }
          }
        },
        error: (error) => {
          console.error('Single order real-time connection error:', error);
        }
      });
  }

  private disconnectSingleOrderRealtime(): void {
    if (this.singleOrderSubscription) {
      this.singleOrderSubscription.unsubscribe();
      this.singleOrderSubscription = undefined;
    }
    if (this.activeOrder) {
      this.realtimeOrders.disconnect(`order-single-${this.activeOrder.id}`);
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

  private buildMenuItems(): void {
    if (!this.rawItems || this.rawItems.length === 0) {
      this.menuItems = [];
      this.filteredItems = [];
      return;
    }

    this.menuItems = this.rawItems.map(item => this.itemToMenuItem(item));
    this.updateFilteredItems();
  }

  openItemModal(item: MenuItem): void {
    this.selectedItem = item;
    this.selectedItemQuantity = 1;
    this.addonValidationError = null;
    this.initializeAddonSelectionState(item);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeItemModal(): void {
    this.selectedItem = null;
    this.selectedItemQuantity = 1;
    this.selectedAddonState = {};
    this.addonValidationError = null;
    // Restore body scroll
    document.body.style.overflow = '';
  }

  private addItemToCart(item: MenuItem, quantity: number = 1, selectedAddons: CartAddonSelection[] = [], notes?: string): void {
    this.cartService.addToCart(item, quantity, notes, selectedAddons);
    this.notification.success(`${item.name} added to cart!`);
  }

  onQuickAddItem(item: MenuItem, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.itemRequiresCustomization(item)) {
      this.openItemModal(item);
      return;
    }
    this.addItemToCart(item);
  }

  adjustSelectedItemQuantity(delta: number): void {
    if (!this.selectedItem) {
      return;
    }
    const nextQuantity = Math.max(1, this.selectedItemQuantity + delta);
    this.selectedItemQuantity = nextQuantity;
  }

  confirmAddSelectedItem(): void {
    if (!this.selectedItem) {
      return;
    }
    if (!this.validateAddonSelections(this.selectedItem)) {
      this.notification.warning(this.addonValidationError || 'Please review addon selections.');
      return;
    }
    const selections = this.buildCartAddonSelections(this.selectedItem);
    this.addItemToCart(this.selectedItem, this.selectedItemQuantity, selections);
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

  toggleTakeaway(): void {
    this.forceTakeaway = !this.forceTakeaway;
  }

  async processPayment(paymentMethod: string): Promise<void> {
    if (!this.placeId || !this.branchId || !this.guestUuid) {
      this.notification.error('Session error. Please refresh the page.');
      return;
    }

    if (this.cartItems.length === 0) {
      this.notification.warning('Your cart is empty.');
      return;
    }

    try {
      const order = await this.orderService.createOrder(
        this.cartItems,
        this.placeId,
        this.branchId,
        this.effectiveTableId,
        this.guestUuid,
        paymentMethod,
        undefined,
        this.currency
      );
    
      this.receiptItems = [...this.cartItems];
      this.orderNumber = order.orderNumber;
      this.orderDate = order.createdAt;
      this.orderTableNumber = order.tableId || '';

      this.connectSingleOrderRealtime(order.id);
    
      if (this.guestUuid) {
        this.aiService.updatePreferencesFromOrder(this.guestUuid, order);
      }
    
      this.notification.success('Order placed successfully!');

      this.showReceipt = true;
      this.closeCart();
    
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
    if (!this.hiddenOrders.find(o => o.id === order.id)) {
      this.hiddenOrders.unshift(order);
      if (this.hiddenOrders.length > 10) {
        this.hiddenOrders = this.hiddenOrders.slice(0, 10);
      }
    }
    
    if (this.activeOrder?.id === order.id) {
      this.activeOrder = null;
    }
    
    this.orderTracking.stopTracking(order.id);
    this.disconnectSingleOrderRealtime();
    
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
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        item.selectedAddons.forEach(addon => {
          const addonTotal = addon.price * addon.quantity * item.quantity;
          content += `    + ${addon.optionName} × ${addon.quantity} = ${this.currency} ${addonTotal.toFixed(2)}\n`;
        });
      }
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
    this.cartService.addToCart(customOrder.baseItem, 1, notes, []);
    
    // Add addons as separate items (if they have price > 0)
    customOrder.addons.forEach(addon => {
      if (addon.price > 0) {
        this.cartService.addToCart(addon, 1, undefined, []);
      }
    });

    // Show notification
    this.notification.success(`Custom order added to cart!`);
  }

  onAddItemFromAI(item: MenuItem): void {
    if (this.itemRequiresCustomization(item)) {
      this.openItemModal(item);
      return;
    }
    this.addItemToCart(item);
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

    // Add placeId and branchId for filtering items by branch/place
    if (this.placeId) {
      query.placeId = this.placeId;
    }

    if (this.branchId) {
      query.branchId = this.branchId;
    }
    
    // Load items first, then categories based on loaded items
    // This ensures categories are filtered to only those that have items for this branch/place
    this.itemsService.getItems(query).subscribe({
      next: (items) => {
        // Ensure items is an array
        const itemsArray = Array.isArray(items) ? items : [];
        this.rawItems = itemsArray;
        
        // Load categories after items are loaded
        // Categories will be filtered to only those that have items for this branch/place
        this.loadCategories();
        this.buildMenuItems();
        
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
    
    const addonGroups = this.resolveItemAddonGroups(item);
    const hasRequiredAddons = addonGroups ? addonGroups.some(group => group.isRequired || (group.minSelect ?? 0) > 0) : false;
    const hasOptionalAddons = addonGroups ? addonGroups.some(group => !group.isRequired && group.options?.length) : false;

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.imageUrl || defaultImage,
      category: categoryId, // Use category ID that matches category.id from API
      rating: Math.min(5, Math.max(4, rating)), // Keep rating between 4 and 5
      isTopRated: isTopRated,
      addonGroups,
      hasRequiredAddons,
      hasOptionalAddons
    };
  }

  private resolveItemAddonGroups(item: Item): ItemAddonGroup[] | undefined {
    const collected: ItemAddonGroup[] = [];

    if (item.addonGroups && item.addonGroups.length > 0) {
      collected.push(...item.addonGroups.map(group => this.normalizeAddonGroup(group)));
    }

    if (item.addonGroupIds && item.addonGroupIds.length > 0) {
      item.addonGroupIds.forEach(id => {
        const group = this.addonGroupsMap.get(id);
        if (group) {
          collected.push(this.cloneAddonGroup(group));
        }
      });
    }

    const itemLinked = this.addonGroupsByItemId.get(item.id);
    if (itemLinked && itemLinked.length) {
      collected.push(...itemLinked.map(group => this.cloneAddonGroup(group)));
    }

    const categoryId = item.categoryId || this.categoryNameToIdMap.get(item.category || '') || item.category;
    if (categoryId) {
      const categoryLinked = this.addonGroupsByCategoryId.get(categoryId);
      if (categoryLinked && categoryLinked.length) {
        collected.push(...categoryLinked.map(group => this.cloneAddonGroup(group)));
      }
    }

    if (collected.length === 0) {
      return undefined;
    }

    const deduped = new Map<string, ItemAddonGroup>();
    collected.forEach(group => {
      if (group.groupId && !deduped.has(group.groupId)) {
        deduped.set(group.groupId, group);
      }
    });

    return Array.from(deduped.values());
  }

  private normalizeAddonGroup(group: any): ItemAddonGroup {
    const groupId = group.groupId || group.id;
    return {
      ...group,
      groupId,
      options: (group.options || []).map((option: any) => ({
        ...option
      }))
    };
  }

  private cloneAddonGroup(group: ItemAddonGroup): ItemAddonGroup {
    return {
      ...group,
      options: group.options?.map(option => ({ ...option }))
    };
  }

  /**
   * Addon helpers
   */
  get selectedItemAddonTotal(): number {
    if (!this.selectedItem) {
      return 0;
    }
    return this.buildCartAddonSelections(this.selectedItem).reduce(
      (sum, addon) => sum + addon.price * addon.quantity,
      0
    );
  }

  get selectedItemUnitPrice(): number {
    if (!this.selectedItem) {
      return 0;
    }
    return this.selectedItem.price + this.selectedItemAddonTotal;
  }

  get selectedItemTotalPrice(): number {
    return this.selectedItemUnitPrice * this.selectedItemQuantity;
  }

  private initializeAddonSelectionState(item: MenuItem): void {
    this.selectedAddonState = {};
    item.addonGroups?.forEach(group => {
      if (!group.groupId) {
        return;
      }
      const groupState: Record<string, number> = {};
      group.options?.forEach(option => {
        if (option.isDefault) {
          const defaultQuantity = option.defaultQuantity ?? (group.selectionType === 'quantity' ? 1 : 1);
          groupState[option.id] = defaultQuantity;
        }
      });
      this.selectedAddonState[group.groupId] = groupState;
    });
  }

  private ensureGroupState(groupId: string): Record<string, number> {
    if (!this.selectedAddonState[groupId]) {
      this.selectedAddonState[groupId] = {};
    }
    return this.selectedAddonState[groupId];
  }

  getSelectedAddonQuantity(groupId: string, optionId: string): number {
    return this.selectedAddonState[groupId]?.[optionId] || 0;
  }

  onSingleAddonSelected(group: ItemAddonGroup, optionId: string): void {
    if (!group.groupId) {
      return;
    }
    const currentState = this.ensureGroupState(group.groupId);
    const alreadySelected = !!currentState[optionId];
    const minRequired = group.isRequired || (group.minSelect && group.minSelect > 0);

    if (alreadySelected && !minRequired) {
      delete currentState[optionId];
      this.selectedAddonState[group.groupId] = { ...currentState };
      return;
    }

    this.selectedAddonState[group.groupId] = { [optionId]: 1 };
  }

  onMultipleAddonToggled(group: ItemAddonGroup, optionId: string): void {
    if (!group.groupId) {
      return;
    }
    const groupState = this.ensureGroupState(group.groupId);
    const isSelected = !!groupState[optionId];

    if (isSelected) {
      delete groupState[optionId];
      this.selectedAddonState[group.groupId] = { ...groupState };
      return;
    }

    const currentCount = Object.keys(groupState).length;
    if (group.maxSelect && currentCount >= group.maxSelect) {
      this.notification.warning(`You can only select up to ${group.maxSelect} option(s) for ${group.name}.`);
      return;
    }

    groupState[optionId] = 1;
    this.selectedAddonState[group.groupId] = { ...groupState };
  }

  onAddonQuantityChanged(group: ItemAddonGroup, optionId: string, delta: number): void {
    if (!group.groupId) {
      return;
    }
    const groupState = this.ensureGroupState(group.groupId);
    const current = groupState[optionId] || 0;
    const option = group.options?.find(opt => opt.id === optionId);
    const maxPerOption = option?.maxQuantity ?? group.maxSelect ?? 10;
    const nextValue = Math.min(Math.max(current + delta, 0), maxPerOption);

    if (nextValue === current) {
      return;
    }

    const pendingCount = this.getGroupSelectionCount(group.groupId) - current + nextValue;
    if (group.maxSelect && pendingCount > group.maxSelect) {
      this.notification.warning(`You can only add up to ${group.maxSelect} portion(s) for ${group.name}.`);
      return;
    }

    if (nextValue === 0) {
      delete groupState[optionId];
    } else {
      groupState[optionId] = nextValue;
    }
    this.selectedAddonState[group.groupId] = { ...groupState };
  }

  private getGroupSelectionCount(groupId: string): number {
    const state = this.selectedAddonState[groupId];
    if (!state) {
      return 0;
    }
    return Object.values(state).reduce((sum, value) => sum + value, 0);
  }

  private validateAddonSelections(item: MenuItem): boolean {
    if (!item.addonGroups || item.addonGroups.length === 0) {
      this.addonValidationError = null;
      return true;
    }

    for (const group of item.addonGroups) {
      if (!group.groupId) {
        continue;
      }
      const selectedCount = this.getGroupSelectionCount(group.groupId);
      const minRequired = group.minSelect ?? (group.isRequired ? 1 : 0);
      if (minRequired && selectedCount < minRequired) {
        this.addonValidationError = `Please select at least ${minRequired} option(s) for ${group.name}.`;
        return false;
      }
    }

    this.addonValidationError = null;
    return true;
  }

  private buildCartAddonSelections(item: MenuItem): CartAddonSelection[] {
    if (!item.addonGroups || item.addonGroups.length === 0) {
      return [];
    }

    const selections: CartAddonSelection[] = [];

    item.addonGroups.forEach(group => {
      if (!group.groupId) {
        return;
      }
      const groupId = group.groupId;
      const groupState = this.selectedAddonState[groupId] || {};
      group.options?.forEach(option => {
        const quantity = groupState[option.id];
        if (quantity && quantity > 0) {
          selections.push({
            groupId,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            price: option.price,
            quantity
          });
        }
      });
    });

    return selections;
  }

  private itemRequiresCustomization(item: MenuItem): boolean {
    return !!item.addonGroups?.some(group => group.isRequired || (group.minSelect ?? 0) > 0);
  }

  /**
   * Load categories from API
   * Note: Categories API doesn't support placeId/branchId filtering.
   * Instead, we filter categories to only show those that have items for the current branch/place.
   */
  private loadCategories(): void {
    const query: any = { 
      isActive: true 
    };

    if (this.menuId) {
      query.menuId = this.menuId;
    }

    if (this.placeId) {   
      query.placeId = this.placeId;
    }

    if (this.branchId) {
      query.branchId = this.branchId;
    }

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
        const filteredCategories = categoriesArray.filter(cat => 
          itemCategoryIds.has(cat.id)
        );
        
        // Build category name to ID mapping for items that only have category names
        this.categoryNameToIdMap.clear();
        filteredCategories.forEach(cat => {
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
        const dynamicCategories: MenuCategory[] = filteredCategories
          .filter(cat => cat.isActive !== false)
          .map(cat => ({
            id: cat.id,
            name: cat.name,
            icon: this.categoriesService.getCategoryIcon(cat.name) || 'restaurant'
          }))
          .sort((a, b) => {
            // Sort by displayOrder if available, otherwise by name
            const catA = filteredCategories.find(c => c.id === a.id);
            const catB = filteredCategories.find(c => c.id === b.id);
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
        this.buildMenuItems();
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

  /**
   * Load addon groups to build configurators for menu items.
   */
  private loadAddonGroups(): void {
    const query: any = {};
    if (this.placeId) {
      query.placeId = this.placeId;
    }
    if (this.menuId) {
      query.menuId = this.menuId;
    }

    this.addonsService.getAddonGroups(query).pipe(takeUntil(this.destroy$)).subscribe({
      next: (groups) => {
        this.addonGroupsMap.clear();
        this.addonGroupsByItemId.clear();
        this.addonGroupsByCategoryId.clear();
        groups.forEach(group => {
          const normalizedGroup = this.normalizeAddonGroup(group);
          if (normalizedGroup.groupId) {
            this.addonGroupsMap.set(normalizedGroup.groupId, normalizedGroup);
          }
          (group.appliesToItemIds || []).forEach(itemId => {
            const list = this.addonGroupsByItemId.get(itemId) || [];
            list.push(this.cloneAddonGroup(normalizedGroup));
            this.addonGroupsByItemId.set(itemId, list);
          });
          (group.appliesToCategoryIds || []).forEach(categoryId => {
            const list = this.addonGroupsByCategoryId.get(categoryId) || [];
            list.push(this.cloneAddonGroup(normalizedGroup));
            this.addonGroupsByCategoryId.set(categoryId, list);
          });
        });
        this.buildMenuItems();
      },
      error: (error) => {
        console.warn('Error loading addon groups:', error);
      }
    });
  }

  private startCartAddAnimation(): void {
    const animationId = ++this.cartAnimationId;
    this.cartDropAnimations = [...this.cartDropAnimations, { id: animationId }];

    const removalTimer = setTimeout(() => {
      this.cartDropAnimations = this.cartDropAnimations.filter(animation => animation.id !== animationId);
    }, 900);
    this.animationTimers.push(removalTimer);

    this.restartBadgeAnimation();
  }

  private restartBadgeAnimation(): void {
    this.cartBadgeAnimationActive = false;

    const startTimer = setTimeout(() => {
      this.cartBadgeAnimationActive = true;
      const stopTimer = setTimeout(() => {
        this.cartBadgeAnimationActive = false;
      }, 350);
      this.animationTimers.push(stopTimer);
    }, 0);

    this.animationTimers.push(startTimer);
  }

  private clearAnimationTimers(): void {
    this.animationTimers.forEach(timer => clearTimeout(timer));
    this.animationTimers = [];
  }

}

