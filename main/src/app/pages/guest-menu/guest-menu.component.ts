import { Component, OnInit, OnDestroy } from '@angular/core';
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

@Component({
  selector: 'app-guest-menu',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, OrderStatusComponent],
  templateUrl: './guest-menu.component.html',
  styleUrls: ['./guest-menu.component.scss']
})
export class GuestMenuComponent implements OnInit, OnDestroy {
  restaurantName: string = 'Teta Raheebeh';
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
    { id: 'picks-for-you', name: 'Picks for you', icon: 'local_fire_department' },
    { id: 'offers', name: 'Offers', icon: 'local_offer' },
    { id: 'appetizers', name: 'Appetizers', icon: 'restaurant_menu' },
    { id: 'fatt', name: 'Fatt', icon: 'lunch_dining' },
    { id: 'mains', name: 'Main Dishes', icon: 'dinner_dining' },
    { id: 'desserts', name: 'Desserts', icon: 'cake' },
    { id: 'beverages', name: 'Beverages', icon: 'local_drink' }
  ];

  menuItems: MenuItem[] = [
    {
      id: '1',
      name: 'Chicken Ouzi Box',
      description: 'Traditional chicken ouzi with rice and sides',
      price: 4.17,
      originalPrice: 5.95,
      image: '/assets/images/products/product-1.png',
      category: 'picks-for-you',
      badge: 'Top rated',
      badgeColor: 'orange',
      rating: 4.8,
      isTopRated: true
    },
    {
      id: '2',
      name: 'Cauliflower Makloba Box',
      description: 'Cauliflower makloba with chicken and traditional sides',
      price: 4.95,
      image: '/assets/images/products/product-2.png',
      category: 'picks-for-you',
      badge: 'Top rated',
      badgeColor: 'orange',
      rating: 4.7,
      isTopRated: true
    },
    {
      id: '3',
      name: 'Stuffed Grape Leaves',
      description: 'Traditional stuffed grape leaves with lemon',
      price: 3.50,
      image: '/assets/images/products/product-3.png',
      category: 'appetizers',
      rating: 4.5
    },
    {
      id: '4',
      name: 'Hummus Plate',
      description: 'Creamy hummus with olive oil and pita bread',
      price: 2.50,
      image: '/assets/images/products/product-4.png',
      category: 'appetizers',
      rating: 4.6
    },
    {
      id: '5',
      name: 'Mansaf',
      description: 'Traditional Jordanian mansaf with lamb',
      price: 8.50,
      image: '/assets/images/products/product-1.png',
      category: 'mains',
      rating: 4.9,
      isTopRated: true
    },
    {
      id: '6',
      name: 'Knafeh',
      description: 'Sweet cheese pastry with syrup',
      price: 3.00,
      image: '/assets/images/products/product-2.png',
      category: 'desserts',
      rating: 4.7
    },
    {
      id: '12',
      name: 'Mansaf',
      description: 'Traditional Jordanian mansaf with lamb and rice',
      price: 8.50,
      image: '/assets/images/products/product-1.png',
      category: 'mains',
      rating: 4.9,
      isTopRated: true
    },
    {
      id: '13',
      name: 'Grilled Chicken',
      description: 'Marinated grilled chicken with herbs',
      price: 7.50,
      image: '/assets/images/products/product-2.png',
      category: 'mains',
      rating: 4.6
    },
    {
      id: '14',
      name: 'Fresh Orange Juice',
      description: 'Freshly squeezed orange juice',
      price: 2.00,
      image: '/assets/images/products/product-3.png',
      category: 'beverages',
      badge: '',
      badgeColor: 'orange',
      rating: 4.5
    },
    {
      id: '15',
      name: 'Mint Lemonade',
      description: 'Refreshing mint and lemon drink',
      price: 1.75,
      image: '/assets/images/products/product-4.png',
      category: 'beverages',
      badge: '',
      badgeColor: 'teal',
      rating: 4.7
    },
    // Offer items
    {
      id: '7',
      name: 'Chicken Fatteh',
      description: '',
      price: 1.37,
      originalPrice: 1.95,
      image: '/assets/images/products/product-1.png',
      category: 'offers',
      badge: '',
      badgeColor: 'teal',
      rating: 4.8
    },
    {
      id: '8',
      name: 'Economy Tablia',
      description: '',
      price: 6.97,
      originalPrice: 9.95,
      image: '/assets/images/products/product-2.png',
      category: 'offers',
      badge: '',
      badgeColor: 'orange',
      rating: 4.7
    },
    {
      id: '9',
      name: 'Chicken Ouzi Box',
      description: '',
      price: 4.17,
      originalPrice: 5.95,
      image: '/assets/images/products/product-1.png',
      category: 'offers',
      badge: 'Top rated',
      badgeColor: 'orange',
      rating: 4.8,
      isTopRated: true
    },
    // Regular items for vertical list
    {
      id: '10',
      name: 'lasagna',
      description: 'Minced meat, lasagna sauce, béchamel, lasagna dough',
      price: 3.95,
      image: '/assets/images/products/product-3.png',
      category: 'appetizers',
      badge: 'NEW',
      badgeColor: 'red',
      rating: 4.5
    },
    {
      id: '11',
      name: 'Fried Kibbeh',
      description: '1 piece',
      price: 0.95,
      image: '/assets/images/products/product-4.png',
      category: 'appetizers',
      badge: '',
      badgeColor: 'teal',
      rating: 4.6
    }
  ];

  get filteredItems(): MenuItem[] {
    if (this.selectedCategory === 'picks-for-you') {
      return this.menuItems.filter(item => item.isTopRated || item.rating && item.rating >= 4.6);
    }
    return this.menuItems.filter(item => item.category === this.selectedCategory);
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
    private notification: NotificationService
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
    return item.badgeColor === 'orange' ? '#ff9800' : '#4caf50';
  }
}

