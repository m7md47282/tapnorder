import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MenuItem } from '../pages/guest-menu/guest-menu.component';

export interface CartAddonSelection {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  item: MenuItem;
  quantity: number;
  notes?: string;
  price: number;
  subtotal: number;
  selectedAddons: CartAddonSelection[];
  addonUnitTotal: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  public cart$: Observable<CartItem[]> = this.cartSubject.asObservable();

  constructor() {
    // Load cart from localStorage on init
    this.loadCartFromStorage();
  }

  addToCart(
    item: MenuItem,
    quantity: number = 1,
    notes?: string,
    selectedAddons: CartAddonSelection[] = []
  ): void {
    const normalizedAddons = this.normalizeAddons(selectedAddons);
    const addonSignature = this.buildAddonSignature(normalizedAddons);

    const existingItem = this.cartItems.find(
      cartItem => cartItem.item.id === item.id &&
        cartItem.notes === notes &&
        this.buildAddonSignature(cartItem.selectedAddons) === addonSignature
    );

    const addonUnitTotal = this.calculateAddonUnitTotal(normalizedAddons);
    const unitPrice = item.price + addonUnitTotal;

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.price = unitPrice;
      existingItem.addonUnitTotal = addonUnitTotal;
      existingItem.selectedAddons = normalizedAddons;
      existingItem.subtotal = unitPrice * existingItem.quantity;
    } else {
      const cartItem: CartItem = {
        id: `${item.id}-${Date.now()}`,
        item,
        quantity,
        notes,
        price: unitPrice,
        subtotal: unitPrice * quantity,
        selectedAddons: normalizedAddons,
        addonUnitTotal
      };
      this.cartItems.push(cartItem);
    }

    this.updateCart();
  }

  removeFromCart(cartItemId: string): void {
    this.cartItems = this.cartItems.filter(item => item.id !== cartItemId);
    this.updateCart();
  }

  updateQuantity(cartItemId: string, quantity: number): void {
    const item = this.cartItems.find(c => c.id === cartItemId);
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(cartItemId);
      } else {
        item.quantity = quantity;
        item.subtotal = item.price * quantity;
        this.updateCart();
      }
    }
  }

  updateNotes(cartItemId: string, notes: string): void {
    const item = this.cartItems.find(c => c.id === cartItemId);
    if (item) {
      item.notes = notes;
      this.updateCart();
    }
  }

  clearCart(): void {
    this.cartItems = [];
    this.updateCart();
  }

  getCartItems(): CartItem[] {
    return [...this.cartItems];
  }

  getCartTotal(): number {
    return this.cartItems.reduce((total, item) => total + item.subtotal, 0);
  }

  getCartItemCount(): number {
    return this.cartItems.reduce((count, item) => count + item.quantity, 0);
  }

  private updateCart(): void {
    this.cartSubject.next([...this.cartItems]);
    this.saveCartToStorage();
  }

  private saveCartToStorage(): void {
    localStorage.setItem('guest-menu-cart', JSON.stringify(this.cartItems));
  }

  private loadCartFromStorage(): void {
    const stored = localStorage.getItem('guest-menu-cart');
    if (stored) {
      try {
        const parsedItems: any[] = JSON.parse(stored);
        this.cartItems = parsedItems.map(item => this.hydrateCartItem(item));
        this.updateCart();
      } catch (e) {
        console.error('Error loading cart from storage:', e);
        this.cartItems = [];
      }
    }
  }

  private normalizeAddons(addons: CartAddonSelection[] = []): CartAddonSelection[] {
    return addons
      .filter(addon => addon && addon.quantity > 0)
      .map(addon => ({
        ...addon,
        quantity: Math.max(0, addon.quantity)
      }))
      .sort((a, b) => {
        const groupCompare = a.groupId.localeCompare(b.groupId);
        if (groupCompare !== 0) {
          return groupCompare;
        }
        return a.optionId.localeCompare(b.optionId);
      });
  }

  private buildAddonSignature(addons: CartAddonSelection[] = []): string {
    if (!addons.length) {
      return '::';
    }

    return addons
      .map(addon => `${addon.groupId}:${addon.optionId}:${addon.quantity}`)
      .join('|');
  }

  private calculateAddonUnitTotal(addons: CartAddonSelection[] = []): number {
    return addons.reduce((total, addon) => total + addon.price * addon.quantity, 0);
  }

  private hydrateCartItem(cartItem: any): CartItem {
    const selectedAddons = this.normalizeAddons(cartItem?.selectedAddons || []);
    const addonUnitTotal = this.calculateAddonUnitTotal(selectedAddons);
    const basePrice = cartItem?.item?.price || 0;
    const unitPrice = basePrice + addonUnitTotal;
    const quantity = cartItem?.quantity && cartItem.quantity > 0 ? cartItem.quantity : 1;

    return {
      id: cartItem?.id || `${cartItem?.item?.id || 'cart-item'}-${Date.now()}`,
      item: cartItem?.item,
      quantity,
      notes: cartItem?.notes,
      price: unitPrice,
      subtotal: unitPrice * quantity,
      selectedAddons,
      addonUnitTotal
    };
  }
}

