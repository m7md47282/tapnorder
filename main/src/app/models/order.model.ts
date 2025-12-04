import { CartItem, CartAddonSelection } from '../services/cart.service';

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
  type?: OrderType;
  customer?: OrderCustomer;
  payment?: OrderPayment;
  source?: OrderSource;
  subtotal?: number;
  tax?: number;
  discount?: number;
  metadata?: Record<string, any>;
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

/**
 * Backend order status values (matching swagger)
 */
export type BackendOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'pickup';

export type OrderSource = 'pos' | 'online' | 'mobile_app' | 'phone';

export type OrderPaymentMethod = 'cash' | 'card' | 'digital_wallet' | 'online';

export type OrderPaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface OrderCustomer {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  isGuest?: boolean;
}

export interface OrderPayment {
  method: OrderPaymentMethod;
  status?: OrderPaymentStatus;
  amount?: number;
  transactionId?: string;
  processedAt?: string;
}

export interface OrderItemPayload {
  itemId: string;
  itemName: string;
  itemPrice: number;
  quantity: number;
  specialInstructions?: string;
  selectedAddons?: CartAddonSelection[];
}

export interface OrderItemResponse extends OrderItemPayload {
  id: string;
  totalPrice?: number;
  status?: BackendOrderStatus;
}

export interface OrderApiModel {
  id: string;
  orderNumber: string;
  placeId: string;
  customer?: OrderCustomer;
  type?: OrderType;
  items: OrderItemResponse[];
  status: BackendOrderStatus;
  subtotal?: number;
  tax?: number;
  discount?: number;
  total: number;
  payment?: OrderPayment;
  source?: OrderSource;
  tableId?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  estimatedReadyTime?: string;
}

export interface CreateOrderCommand {
  placeId: string;
  type: OrderType;
  customer: OrderCustomer;
  items: OrderItemPayload[];
  payment?: OrderPayment;
  source?: OrderSource;
  tableId?: string | null;
  notes?: string;
  lastUpdatedBy: string;
  metadata?: Record<string, any>;
}

export interface OrderQuery {
  placeId?: string;
  status?: string | string[];
  type?: OrderType | OrderType[];
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  orderNumber?: string;
  source?: OrderSource | OrderSource[];
  search?: string;
}

