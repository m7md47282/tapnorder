import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { MenuItem } from '../pages/guest-menu/guest-menu.component';
import { Order } from '../models/order.model';
import { IndexedDBService } from './indexeddb.service';
import { OrderService } from './order.service';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: MenuItem[];
  customOrder?: CustomOrderSuggestion;
}

export interface CustomOrderSuggestion {
  baseItem: MenuItem;
  modifications: string[];
  addons: MenuItem[];
  totalPrice: number;
  description: string;
}

export interface UserPreference {
  guestUuid: string;
  preferredCategories: string[];
  preferredItems: string[];
  dietaryPreferences: string[];
  tastePreferences: {
    spicy: number; // 0-5 scale
    sweet: number;
    bitter: number;
    salty: number;
    creamy: number;
  };
  priceRange: {
    min: number;
    max: number;
  };
  orderHistory: string[]; // Item IDs ordered before
  lastUpdated: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private readonly ADDONS: MenuItem[] = [
    { id: 'addon-1', name: 'Extra Shot', description: 'Additional espresso shot', price: 0.75, image: '/assets/images/products/product-1.png', category: 'addons' },
    { id: 'addon-2', name: 'Oat Milk', description: 'Creamy oat milk alternative', price: 0.50, image: '/assets/images/products/product-2.png', category: 'addons' },
    { id: 'addon-3', name: 'Almond Milk', description: 'Nutty almond milk', price: 0.50, image: '/assets/images/products/product-3.png', category: 'addons' },
    { id: 'addon-4', name: 'Vanilla Syrup', description: 'Sweet vanilla flavor', price: 0.50, image: '/assets/images/products/product-4.png', category: 'addons' },
    { id: 'addon-5', name: 'Caramel Syrup', description: 'Rich caramel flavor', price: 0.50, image: '/assets/images/products/product-1.png', category: 'addons' },
    { id: 'addon-6', name: 'Hazelnut Syrup', description: 'Nutty hazelnut flavor', price: 0.50, image: '/assets/images/products/product-2.png', category: 'addons' },
    { id: 'addon-7', name: 'Whipped Cream', description: 'Light and fluffy', price: 0.75, image: '/assets/images/products/product-3.png', category: 'addons' },
    { id: 'addon-8', name: 'Extra Cheese', description: 'Additional cheese', price: 1.00, image: '/assets/images/products/product-4.png', category: 'addons' },
    { id: 'addon-9', name: 'Extra Spice', description: 'Add more heat', price: 0.25, image: '/assets/images/products/product-1.png', category: 'addons' },
    { id: 'addon-10', name: 'No Onions', description: 'Remove onions', price: 0, image: '/assets/images/products/product-2.png', category: 'addons' },
  ];

  constructor(
    private indexedDB: IndexedDBService,
    private orderService: OrderService
  ) {}

  /**
   * Process user chat message and generate AI response
   */
  chat(message: string, guestUuid: string, menuItems: MenuItem[]): Observable<ChatMessage> {
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    // Analyze message intent
    const intent = this.analyzeIntent(message);
    
    // Get user preferences
    const preferences = this.getUserPreferences(guestUuid);

    let response: ChatMessage;

    switch (intent.type) {
      case 'taste_preference':
        response = this.handleTastePreference(intent, menuItems, preferences);
        break;
      case 'custom_order':
        response = this.handleCustomOrder(intent, menuItems, preferences);
        break;
      case 'recommendation':
        response = this.handleRecommendation(intent, menuItems, preferences, guestUuid);
        break;
      case 'greeting':
        response = this.handleGreeting(preferences);
        break;
      default:
        response = this.handleGeneralQuery(message, menuItems, preferences);
    }

    return of(response).pipe(delay(800)); // Simulate AI thinking time
  }

  /**
   * Get AI-driven recommendations for "Picks for you"
   */
  getPersonalizedRecommendations(guestUuid: string, menuItems: MenuItem[]): MenuItem[] {
    const preferences = this.getUserPreferences(guestUuid);
    const orderHistory = this.getOrderHistory(guestUuid);

    // If no history, return top-rated items
    if (orderHistory.length === 0) {
      return menuItems
        .filter(item => item.isTopRated || (item.rating && item.rating >= 4.6))
        .slice(0, 6);
    }

    // Analyze preferences and order history
    const scoredItems = menuItems.map(item => ({
      item,
      score: this.calculateRecommendationScore(item, preferences, orderHistory)
    }));

    // Sort by score and return top 6
    return scoredItems
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(scored => scored.item);
  }

  /**
   * Analyze user message intent
   */
  private analyzeIntent(message: string): { type: string; data: any } {
    const lowerMessage = message.toLowerCase();

    // Taste preferences
    if (lowerMessage.match(/(thick|creamy|smooth|rich|bitter|sweet|spicy|mild|strong|weak)/)) {
      return {
        type: 'taste_preference',
        data: {
          thick: lowerMessage.includes('thick') || lowerMessage.includes('creamy'),
          bitter: lowerMessage.includes('bitter'),
          sweet: lowerMessage.includes('sweet'),
          spicy: lowerMessage.includes('spicy'),
          mild: lowerMessage.includes('mild'),
          strong: lowerMessage.includes('strong')
        }
      };
    }

    // Custom order requests
    if (lowerMessage.match(/(like|want|need|prefer|custom|make|create|combine)/)) {
      return {
        type: 'custom_order',
        data: { message }
      };
    }

    // Recommendation requests
    if (lowerMessage.match(/(recommend|suggest|what should|what can|help me choose|best)/)) {
      return {
        type: 'recommendation',
        data: { message }
      };
    }

    // Greetings
    if (lowerMessage.match(/(hi|hello|hey|greetings|good morning|good afternoon|good evening)/)) {
      return {
        type: 'greeting',
        data: {}
      };
    }

    return {
      type: 'general',
      data: { message }
    };
  }

  /**
   * Handle taste preference queries
   */
  private handleTastePreference(
    intent: any,
    menuItems: MenuItem[],
    preferences: UserPreference
  ): ChatMessage {
    const { data } = intent;
    const suggestions: MenuItem[] = [];
    let customOrder: CustomOrderSuggestion | undefined;

    // Find beverages that match preferences
    const beverages = menuItems.filter(item => item.category === 'beverages');

    if (data.thick || data.creamy) {
      // Suggest creamy beverages with milk options
      const creamyOptions = beverages.filter(b => 
        b.name.toLowerCase().includes('latte') || 
        b.name.toLowerCase().includes('cappuccino') ||
        b.name.toLowerCase().includes('mocha')
      );
      
      if (creamyOptions.length > 0) {
        const base = creamyOptions[0];
        customOrder = {
          baseItem: base,
          modifications: ['Extra creamy texture'],
          addons: this.ADDONS.filter(a => a.name.includes('Milk') || a.name.includes('Cream')),
          totalPrice: base.price + 0.75,
          description: `I recommend ${base.name} with oat milk and whipped cream for a thick, creamy texture without being too bitter.`
        };
      }
    }

    if (data.bitter && !data.thick) {
      // Suggest sweeter options to balance bitterness
      const sweetAddons = this.ADDONS.filter(a => 
        a.name.toLowerCase().includes('syrup') || 
        a.name.toLowerCase().includes('vanilla') ||
        a.name.toLowerCase().includes('caramel')
      );
      
      if (beverages.length > 0) {
        const base = beverages.find(b => b.name.toLowerCase().includes('latte')) || beverages[0];
        customOrder = {
          baseItem: base,
          modifications: ['Less bitter, more balanced'],
          addons: sweetAddons.slice(0, 2),
          totalPrice: base.price + 1.0,
          description: `Try ${base.name} with vanilla and caramel syrup to reduce bitterness and add sweetness.`
        };
      }
    }

    let content = 'Based on your preferences, ';
    if (customOrder) {
      content += customOrder.description;
    } else {
      content += 'I can help you find the perfect drink! Would you like something creamy, sweet, or strong?';
    }

    return {
      id: this.generateId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      customOrder
    };
  }

  /**
   * Handle custom order requests
   */
  private handleCustomOrder(
    intent: any,
    menuItems: MenuItem[],
    preferences: UserPreference
  ): ChatMessage {
    const message = intent.data.message.toLowerCase();
    let customOrder: CustomOrderSuggestion | undefined;

    // Try to find base item mentioned
    const beverages = menuItems.filter(item => item.category === 'beverages');
    let baseItem: MenuItem | undefined;

    // Check for specific drinks mentioned
    if (message.includes('latte') || message.includes('coffee')) {
      baseItem = beverages.find(b => b.name.toLowerCase().includes('latte')) || beverages[0];
    } else if (message.includes('mocha')) {
      baseItem = beverages.find(b => b.name.toLowerCase().includes('mocha')) || beverages[0];
    } else {
      baseItem = beverages[0]; // Default to first beverage
    }

    if (baseItem) {
      const modifications: string[] = [];
      const addons: MenuItem[] = [];

      // Analyze modifications
      if (message.includes('thick') || message.includes('creamy')) {
        modifications.push('Extra creamy');
        addons.push(...this.ADDONS.filter(a => a.name.includes('Milk') || a.name.includes('Cream')));
      }

      if (message.includes('not bitter') || message.includes('less bitter')) {
        modifications.push('Balanced flavor');
        addons.push(...this.ADDONS.filter(a => a.name.includes('Syrup')).slice(0, 2));
      }

      if (message.includes('sweet')) {
        addons.push(...this.ADDONS.filter(a => a.name.includes('Syrup')).slice(0, 1));
      }

      const totalPrice = baseItem.price + addons.reduce((sum, addon) => sum + addon.price, 0);

      customOrder = {
        baseItem,
        modifications: modifications.length > 0 ? modifications : ['Custom preparation'],
        addons,
        totalPrice,
        description: `I've created a custom ${baseItem.name} for you with ${modifications.join(', ')}${addons.length > 0 ? ` and ${addons.map(a => a.name).join(', ')}` : ''}. Total: JOD ${totalPrice.toFixed(2)}`
      };
    }

    return {
      id: this.generateId(),
      role: 'assistant',
      content: customOrder 
        ? customOrder.description + ' Would you like to add this to your cart?'
        : 'I can help you create a custom order! Tell me what you like, for example: "I like my latte thick but not too bitter"',
      timestamp: new Date(),
      customOrder
    };
  }

  /**
   * Handle recommendation requests
   */
  private handleRecommendation(
    intent: any,
    menuItems: MenuItem[],
    preferences: UserPreference,
    guestUuid: string
  ): ChatMessage {
    const recommendations = this.getPersonalizedRecommendations(guestUuid, menuItems);
    
    let content = 'Based on your preferences';
    if (preferences.orderHistory.length > 0) {
      content += ' and order history';
    }
    content += ', here are my top recommendations for you:\n\n';

    recommendations.slice(0, 3).forEach((item, index) => {
      content += `${index + 1}. ${item.name} - ${item.description || 'Delicious choice'}\n`;
    });

    return {
      id: this.generateId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      suggestions: recommendations.slice(0, 3)
    };
  }

  /**
   * Handle greeting
   */
  private handleGreeting(preferences: UserPreference): ChatMessage {
    let content = 'Hello! 👋 I\'m your AI assistant. ';
    
    if (preferences.orderHistory.length > 0) {
      content += `I see you\'ve ordered with us before! I can help you find items you\'ll love based on your past orders, or create custom combinations just for you.`;
    } else {
      content += 'I can help you discover the perfect items from our menu, create custom orders tailored to your taste, or answer any questions you have!';
    }

    content += '\n\nWhat would you like today?';

    return {
      id: this.generateId(),
      role: 'assistant',
      content,
      timestamp: new Date()
    };
  }

  /**
   * Handle general queries
   */
  private handleGeneralQuery(
    message: string,
    menuItems: MenuItem[],
    preferences: UserPreference
  ): ChatMessage {
    return {
      id: this.generateId(),
      role: 'assistant',
      content: 'I\'m here to help! I can recommend items based on your taste preferences, create custom orders, or help you find something specific. What would you like?',
      timestamp: new Date()
    };
  }

  /**
   * Calculate recommendation score for an item
   */
  private calculateRecommendationScore(
    item: MenuItem,
    preferences: UserPreference,
    orderHistory: Order[]
  ): number {
    let score = 0;

    // Base score from rating
    if (item.rating) {
      score += item.rating * 10;
    }

    // Boost if top rated
    if (item.isTopRated) {
      score += 20;
    }

    // Check if item was ordered before (preference boost)
    const orderedBefore = orderHistory.some(order =>
      order.items.some(orderItem => orderItem.item.id === item.id)
    );
    if (orderedBefore) {
      score += 30; // Strong preference for previously ordered items
    }

    // Category preference boost
    if (preferences.preferredCategories.includes(item.category)) {
      score += 15;
    }

    // Price range preference
    if (item.price >= preferences.priceRange.min && item.price <= preferences.priceRange.max) {
      score += 10;
    }

    // Add deterministic variety based on item ID (instead of random)
    // This ensures consistent results while still providing variety
    const itemIdHash = this.hashString(item.id);
    score += (itemIdHash % 5); // Adds 0-4 based on item ID

    return score;
  }

  /**
   * Simple hash function to convert string to number
   * Used for deterministic "randomness" based on item ID
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get user preferences (create default if doesn't exist)
   */
  private getUserPreferences(guestUuid: string): UserPreference {
    const stored = localStorage.getItem(`ai_preferences_${guestUuid}`);
    if (stored) {
      return JSON.parse(stored);
    }

    // Default preferences
    return {
      guestUuid,
      preferredCategories: [],
      preferredItems: [],
      dietaryPreferences: [],
      tastePreferences: {
        spicy: 2,
        sweet: 3,
        bitter: 2,
        salty: 3,
        creamy: 3
      },
      priceRange: {
        min: 0,
        max: 50
      },
      orderHistory: [],
      lastUpdated: new Date()
    };
  }

  /**
   * Update user preferences based on order
   */
  updatePreferencesFromOrder(guestUuid: string, order: Order): void {
    const preferences = this.getUserPreferences(guestUuid);
    
    // Update order history
    order.items.forEach(item => {
      if (!preferences.orderHistory.includes(item.item.id)) {
        preferences.orderHistory.push(item.item.id);
      }
      
      // Update preferred categories
      if (!preferences.preferredCategories.includes(item.item.category)) {
        preferences.preferredCategories.push(item.item.category);
      }
    });

    // Store order in history
    try {
      const storedOrders = localStorage.getItem(`orders_${guestUuid}`);
      let orders: Order[] = storedOrders ? JSON.parse(storedOrders) : [];
      orders.push(order);
      // Keep only last 50 orders
      if (orders.length > 50) {
        orders = orders.slice(-50);
      }
      localStorage.setItem(`orders_${guestUuid}`, JSON.stringify(orders));
    } catch (error) {
      console.error('Error storing order history:', error);
    }

    preferences.lastUpdated = new Date();
    localStorage.setItem(`ai_preferences_${guestUuid}`, JSON.stringify(preferences));
  }

  /**
   * Get order history for a guest
   */
  private getOrderHistory(guestUuid: string): Order[] {
    // Get orders from IndexedDB
    // Note: This is a simplified version - in production, you'd use IndexedDBService
    try {
      const storedOrders = localStorage.getItem(`orders_${guestUuid}`);
      if (storedOrders) {
        const orders = JSON.parse(storedOrders);
        return orders.map((order: any) => ({
          ...order,
          createdAt: new Date(order.createdAt),
          updatedAt: new Date(order.updatedAt)
        }));
      }
    } catch (error) {
      console.error('Error loading order history:', error);
    }
    return [];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

