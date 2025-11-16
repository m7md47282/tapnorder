import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MenuItem } from '../pages/guest-menu/guest-menu.component';

export interface CartItem {
  id: string;
  item: MenuItem;
  quantity: number;
  notes?: string;
  price: number;
  subtotal: number;
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

  addToCart(item: MenuItem, quantity: number = 1, notes?: string): void {
    const existingItem = this.cartItems.find(cartItem => cartItem.item.id === item.id && cartItem.notes === notes);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.subtotal = existingItem.price * existingItem.quantity;
    } else {
      const cartItem: CartItem = {
        id: `${item.id}-${Date.now()}`,
        item,
        quantity,
        notes,
        price: item.price,
        subtotal: item.price * quantity
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
        this.cartItems = JSON.parse(stored);
        this.updateCart();
      } catch (e) {
        console.error('Error loading cart from storage:', e);
        this.cartItems = [];
      }
    }
  }
}

