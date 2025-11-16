import { CartItem } from '../services/cart.service';

/**
 * Order Status Enum
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED'
}

/**
 * Order Interface
 */
export interface Order {
  id: string;
  orderNumber: string;
  guestUuid?: string; // For guest orders
  userId?: string; // For logged-in users (future)
  placeId: string;
  branchId: string;
  tableId?: string | null; // null for takeaway orders
  items: CartItem[];
  status: OrderStatus;
  total: number;
  currency: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedReadyTime?: Date; // Estimated time when order will be ready
}

/**
 * Order Status Update Interface
 */
export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  updatedAt: Date;
  message?: string;
}

/**
 * Guest Session Interface
 */
export interface GuestSession {
  uuid: string;
  placeId: string;
  branchId: string;
  tableId?: string | null;
  createdAt: Date;
  lastAccessedAt: Date;
}

