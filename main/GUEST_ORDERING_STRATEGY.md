# Guest Ordering System Strategy

## Overview
This document outlines the strategy for implementing a guest ordering system that allows customers to order without login, tracks orders, and provides order status updates.

## Architecture

### 1. **URL Structure & QR Code Flow**
- **QR Code URL Format**: `/menu?place_id={id}&branch_id={id}&table_id={id}`
- **Takeaway**: If `table_id` is missing, it's a takeaway order
- **Route**: `/menu` (already exists, needs query param handling)

### 2. **Guest Identification**
- **UUID Generation**: Generate unique UUID for each guest session
- **Storage**: IndexedDB (for offline-first approach)
- **Key**: `guest_uuid`
- **Condition**: Only create UUID if URL contains `place_id` and `branch_id`
- **Logged-in Users**: If user is logged in, use user ID instead of UUID (future: save to database)

### 3. **Order Management**
- **Order Model**:
  ```typescript
  {
    id: string;
    orderNumber: string;
    guestUuid?: string;
    userId?: string;
    placeId: string;
    branchId: string;
    tableId?: string; // null for takeaway
    items: CartItem[];
    status: OrderStatus;
    total: number;
    createdAt: Date;
    updatedAt: Date;
  }
  ```
- **Order Status Enum**:
  - `PENDING` - Order placed, waiting for confirmation
  - `CONFIRMED` - Order confirmed by restaurant
  - `PREPARING` - Order being prepared
  - `READY` - Order ready to be served
  - `SERVED` - Order served/completed
  - `CANCELLED` - Order cancelled

### 4. **Services Structure**

#### A. IndexedDB Service (`indexeddb.service.ts`)
- **Purpose**: Manage guest UUID and order data in IndexedDB
- **Methods**:
  - `getOrCreateGuestUuid(): Promise<string>`
  - `saveOrder(order: Order): Promise<void>`
  - `getOrders(): Promise<Order[]>`
  - `getOrderById(id: string): Promise<Order | null>`
  - `updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>`

#### B. Order Service (`order.service.ts`)
- **Purpose**: Manage orders (local storage + future API integration)
- **Methods**:
  - `createOrder(cartItems, placeId, branchId, tableId?): Observable<Order>`
  - `getOrders(): Observable<Order[]>`
  - `getOrderById(id: string): Observable<Order | null>`
  - `getActiveOrder(): Observable<Order | null>`
  - `updateOrderStatus(orderId: string, status: OrderStatus): Observable<Order>`

#### C. Order Tracking Service (`order-tracking.service.ts`)
- **Purpose**: Track order status and provide real-time updates
- **Methods**:
  - `startTracking(orderId: string): void`
  - `stopTracking(orderId: string): void`
  - `getOrderStatus(orderId: string): Observable<OrderStatus>`
  - `onOrderStatusChange(orderId: string): Observable<OrderStatus>`

### 5. **Component Updates**

#### Guest Menu Component
- **URL Parameter Handling**: Extract `place_id`, `branch_id`, `table_id` from query params
- **Guest UUID Initialization**: Initialize guest UUID on component load
- **Order Creation**: Save order with table number and guest UUID
- **Order Status Display**: Show active order status if exists
- **Order Tracking**: Start tracking order status after order placement

#### Order Status Component (New)
- **Purpose**: Display order status and tracking information
- **Features**:
  - Order status indicator
  - Estimated time remaining
  - Order items list
  - Order number display

### 6. **Notification System**
- **Browser Notifications**: Use Web Notifications API for order ready alerts
- **In-App Notifications**: Use existing NotificationService for status updates
- **Permission**: Request notification permission on first order

### 7. **Data Flow**

```
QR Code Scan
    ↓
URL with place_id, branch_id, table_id
    ↓
Guest Menu Component Initializes
    ↓
Check for Guest UUID (IndexedDB)
    ↓
If not exists → Generate UUID → Save to IndexedDB
    ↓
User Browses Menu & Adds Items to Cart
    ↓
User Places Order
    ↓
Create Order Object with:
  - guestUuid (or userId if logged in)
  - placeId, branchId, tableId
  - cartItems
  - status: PENDING
    ↓
Save Order to IndexedDB (and future: API)
    ↓
Start Order Tracking
    ↓
Show Order Status Component
    ↓
Poll/Listen for Status Updates
    ↓
When Status = READY → Show Notification
```

### 8. **File Structure**

```
src/app/
├── services/
│   ├── indexeddb.service.ts (NEW)
│   ├── order.service.ts (NEW)
│   └── order-tracking.service.ts (NEW)
├── models/
│   └── order.model.ts (NEW)
├── pages/
│   └── guest-menu/
│       ├── guest-menu.component.ts (UPDATE)
│       ├── guest-menu.component.html (UPDATE)
│       ├── components/
│       │   └── order-status/
│       │       ├── order-status.component.ts (NEW)
│       │       ├── order-status.component.html (NEW)
│       │       └── order-status.component.scss (NEW)
```

### 9. **Implementation Steps**

1. ✅ Create Order Model
2. ✅ Create IndexedDB Service
3. ✅ Create Order Service
4. ✅ Create Order Tracking Service
5. ✅ Update Guest Menu Component for URL params
6. ✅ Update Guest Menu Component for order creation
7. ✅ Create Order Status Component
8. ✅ Implement Notification System
9. ✅ Update Routing (if needed)

### 10. **Future Enhancements**
- Backend API integration
- Real-time WebSocket updates
- Order history for logged-in users
- Push notifications
- Order cancellation
- Order modification (before confirmation)

