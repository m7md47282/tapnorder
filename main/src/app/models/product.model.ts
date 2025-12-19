export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  price: number;
  cost?: number;
  stock: number;
  category?: string;
  categoryId?: string;
  placeId?: string;
  branchId?: string | null;
  menuId?: string;
  image?: string;
  isActive: boolean;
  taxRate?: number;
  unit?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  subtotal: number;
  tax?: number;
  total: number;
  comments?: string; // Item-specific comments/modifiers
}

export interface Sale {
  id?: string;
  saleNumber: string;
  customerId?: string;
  customerName?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  status: SaleStatus;
  notes?: string;
  cashierId: string;
  cashierName: string;
  createdAt?: string;
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT',
  CREDIT = 'CREDIT',
  MIXED = 'MIXED'
}

export enum SaleStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum KitchenOrderStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  saleId: string;
  tableNumber?: string;
  orderType: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
  items: KitchenOrderItem[];
  status: KitchenOrderStatus;
  specialInstructions?: string;
  createdAt: string;
  startedAt?: string;
  readyAt?: string;
  completedAt?: string;
  estimatedTime?: number; // in minutes
  priority?: 'NORMAL' | 'URGENT' | 'RUSH';
  serverName?: string;
  customerName?: string;
  isHeld?: boolean;
  holdReason?: string;
  messages?: KitchenMessage[];
  paymentStatus?: 'PENDING' | 'PAID' | 'PARTIAL';
}

export interface KitchenOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  modifiers?: string[];
  specialInstructions?: string;
  status: KitchenOrderStatus;
  station?: string; // Grill, Salad, Pizza, etc.
  recipe?: Recipe;
  allergens?: string[];
  dietaryInfo?: string[];
  cookingTime?: number; // in minutes
  prepTime?: number; // in minutes
  temperature?: string; // cooking temperature
  isLowStock?: boolean;
  stockAlert?: string;
}

export interface Recipe {
  id: string;
  productId: string;
  name: string;
  instructions: string[];
  cookingTime: number;
  prepTime: number;
  temperature?: string;
  ingredients: RecipeIngredient[];
  notes?: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface KitchenMessage {
  id: string;
  orderId: string;
  from: string; // 'KITCHEN' | 'FOH' | server name
  to: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export interface BatchCookingItem {
  productName: string;
  productId: string;
  totalQuantity: number;
  orders: {
    orderId: string;
    orderNumber: string;
    quantity: number;
    tableNumber?: string;
    specialInstructions?: string;
  }[];
  station?: string;
  recipe?: Recipe;
  allergens?: string[];
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  balance?: number;
  isActive: boolean;
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  CLEANING = 'CLEANING',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE'
}

export interface Table {
  id: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  placeId: string;
  branchId?: string | null;
  currentOrderId?: string;
  currentOrder?: Sale;
  serverId?: string;
  serverName?: string;
  reservationTime?: string;
  seatedAt?: string;
  notes?: string;
  location?: string; // e.g., 'Indoor', 'Outdoor', 'Bar Area'
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

