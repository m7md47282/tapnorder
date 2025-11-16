import { Injectable } from '@angular/core';
import { Order, OrderStatus, GuestSession } from '../models/order.model';

/**
 * IndexedDB Service
 * Manages guest UUID and order data storage in IndexedDB
 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private readonly DB_NAME = 'RestaurantPOS';
  private readonly DB_VERSION = 1;
  private readonly GUEST_UUID_STORE = 'guestSessions';
  private readonly ORDERS_STORE = 'orders';
  
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  /**
   * Initialize IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB initialization failed');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create guest sessions store
        if (!db.objectStoreNames.contains(this.GUEST_UUID_STORE)) {
          const guestStore = db.createObjectStore(this.GUEST_UUID_STORE, { keyPath: 'uuid' });
          guestStore.createIndex('placeId', 'placeId', { unique: false });
          guestStore.createIndex('branchId', 'branchId', { unique: false });
        }

        // Create orders store
        if (!db.objectStoreNames.contains(this.ORDERS_STORE)) {
          const orderStore = db.createObjectStore(this.ORDERS_STORE, { keyPath: 'id' });
          orderStore.createIndex('orderNumber', 'orderNumber', { unique: true });
          orderStore.createIndex('guestUuid', 'guestUuid', { unique: false });
          orderStore.createIndex('status', 'status', { unique: false });
          orderStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure DB is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get or create guest UUID
   * Only creates UUID if placeId and branchId are provided
   */
  async getOrCreateGuestUuid(placeId: string, branchId: string, tableId?: string | null): Promise<string> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.GUEST_UUID_STORE], 'readwrite');
      const store = transaction.objectStore(this.GUEST_UUID_STORE);
      const index = store.index('placeId');
      
      // Try to find existing session for this place/branch/table combination
      const request = index.openCursor(IDBKeyRange.only(placeId));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          const session = cursor.value as GuestSession;
          // Check if branchId and tableId match
          if (session.branchId === branchId && session.tableId === tableId) {
            // Update last accessed time
            session.lastAccessedAt = new Date();
            cursor.update(session);
            resolve(session.uuid);
            return;
          }
          cursor.continue();
        } else {
          // No existing session found, create new one
          const uuid = this.generateUUID();
          const session: GuestSession = {
            uuid,
            placeId,
            branchId,
            tableId: tableId || null,
            createdAt: new Date(),
            lastAccessedAt: new Date()
          };
          
          const addRequest = store.add(session);
          addRequest.onsuccess = () => resolve(uuid);
          addRequest.onerror = () => reject(addRequest.error);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get guest UUID (if exists)
   */
  async getGuestUuid(placeId: string, branchId: string, tableId?: string | null): Promise<string | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.GUEST_UUID_STORE], 'readonly');
      const store = transaction.objectStore(this.GUEST_UUID_STORE);
      const index = store.index('placeId');
      
      const request = index.openCursor(IDBKeyRange.only(placeId));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          const session = cursor.value as GuestSession;
          if (session.branchId === branchId && session.tableId === tableId) {
            resolve(session.uuid);
            return;
          }
          cursor.continue();
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save order to IndexedDB
   */
  async saveOrder(order: Order): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.ORDERS_STORE], 'readwrite');
      const store = transaction.objectStore(this.ORDERS_STORE);
      
      // Convert dates to ISO strings for storage
      const orderToSave = {
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        estimatedReadyTime: order.estimatedReadyTime?.toISOString()
      };
      
      const request = store.put(orderToSave);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all orders for a guest UUID
   */
  async getOrdersByGuestUuid(guestUuid: string): Promise<Order[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.ORDERS_STORE], 'readonly');
      const store = transaction.objectStore(this.ORDERS_STORE);
      const index = store.index('guestUuid');
      
      const request = index.getAll(guestUuid);
      
      request.onsuccess = () => {
        const orders = (request.result as any[]).map(order => ({
          ...order,
          createdAt: new Date(order.createdAt),
          updatedAt: new Date(order.updatedAt),
          estimatedReadyTime: order.estimatedReadyTime ? new Date(order.estimatedReadyTime) : undefined
        })) as Order[];
        
        // Sort by createdAt descending
        orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        resolve(orders);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.ORDERS_STORE], 'readonly');
      const store = transaction.objectStore(this.ORDERS_STORE);
      
      const request = store.get(orderId);
      
      request.onsuccess = () => {
        if (request.result) {
          const order = request.result as any;
          resolve({
            ...order,
            createdAt: new Date(order.createdAt),
            updatedAt: new Date(order.updatedAt),
            estimatedReadyTime: order.estimatedReadyTime ? new Date(order.estimatedReadyTime) : undefined
          } as Order);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get active order (most recent non-completed order)
   */
  async getActiveOrder(guestUuid: string): Promise<Order | null> {
    const orders = await this.getOrdersByGuestUuid(guestUuid);
    
    // Find most recent order that is not SERVED or CANCELLED
    const activeOrder = orders.find(order => 
      order.status !== OrderStatus.SERVED && 
      order.status !== OrderStatus.CANCELLED
    );
    
    return activeOrder || null;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const order = await this.getOrderById(orderId);
    
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    order.status = status;
    order.updatedAt = new Date();
    
    await this.saveOrder(order);
  }
}

