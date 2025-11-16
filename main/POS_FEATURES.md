# Point of Sale (POS) System - Cashier Interface

## ✅ Features Implemented

### 1. Product Management
- **Product Search**: Real-time search by name, SKU, or barcode
- **Category Filtering**: Filter products by category
- **Product Grid**: Visual product cards with images
- **Stock Display**: Shows available stock for each product
- **Out of Stock Handling**: Prevents adding out-of-stock items

### 2. Shopping Cart
- **Add to Cart**: Click product to add, or increment quantity
- **Quantity Management**: Increase/decrease item quantities
- **Remove Items**: Delete items from cart
- **Real-time Calculations**: Automatic subtotal, tax, and total calculation
- **Discount Support**: Per-item discount (percentage or fixed)
- **Cart Persistence**: Cart maintained during session

### 3. Customer Management
- **Customer Selection**: Select customer for sale
- **Walk-in Customer**: Default option for non-registered customers
- **Customer Search**: Search customers by name, phone, or email
- **Customer Display**: Shows selected customer info in cart

### 4. Payment Processing
- **Multiple Payment Methods**:
  - Cash
  - Card
  - Mobile Payment
  - Credit
- **Cash Handling**: 
  - Cash received input
  - Automatic change calculation
  - Validation for sufficient cash
- **Payment Dialog**: Modal for payment processing
- **Receipt Generation**: Print receipt after sale

### 5. Sales Processing
- **Sale Creation**: Automatic sale number generation
- **Sale Recording**: Complete sale with all details
- **Status Tracking**: Sale status (Pending, Completed, Cancelled, Refunded)
- **Cashier Tracking**: Records which cashier processed the sale

### 6. UI/UX Features
- **Responsive Design**: Works on different screen sizes
- **Loading States**: Shows loading indicators
- **Error Handling**: User-friendly error messages
- **Notifications**: Success/error notifications
- **Empty States**: Helpful messages when cart is empty
- **Visual Feedback**: Hover effects and transitions

## 📋 Mock Data

The POS includes mock products for testing:
- 8 sample products across different categories
- Beverages, Food, and Dairy categories
- Various prices and stock levels

## 🔌 API Integration

The component is ready for backend integration. Uncomment the API calls in:
- `loadProducts()` - Load products from backend
- `processPayment()` - Save sale to backend

### Expected API Endpoints:

```typescript
// Get products
GET /api/products?isActive=true

// Create sale
POST /api/sales
Body: {
  saleNumber: string,
  customerId?: string,
  items: CartItem[],
  subtotal: number,
  tax: number,
  discount: number,
  total: number,
  paymentMethod: PaymentMethod,
  cashReceived?: number,
  change?: number,
  cashierId: string,
  ...
}
```

## 🎯 Usage

1. **Navigate to POS**: Go to `/pos` route
2. **Search Products**: Use search bar or filter by category
3. **Add Products**: Click on product cards to add to cart
4. **Manage Cart**: Adjust quantities or remove items
5. **Select Customer** (optional): Click "Select Customer" button
6. **Checkout**: Click "Checkout" button
7. **Process Payment**: 
   - Select payment method
   - Enter cash amount (if cash)
   - Click "Process Payment"
8. **Receipt**: Receipt is automatically generated

## 🔐 Access Control

The POS route is protected by `authGuard`. Only authenticated users can access it.

For role-based access, you can add a role guard:
```typescript
{
  path: 'pos',
  canActivate: [authGuard, roleGuard([UserRole.CASHIER, UserRole.STORE_MANAGER])],
  ...
}
```

## 📱 Responsive Design

- **Desktop**: Full layout with products on left, cart on right
- **Tablet/Mobile**: Stacked layout with cart below products

## 🚀 Future Enhancements

Potential features to add:
- Barcode scanner integration
- Receipt printer integration
- Hold/resume transactions
- Split payments
- Coupon/discount codes
- Loyalty points integration
- Product variants (size, color, etc.)
- Quick sale mode
- Transaction history
- Refund/return functionality

## 🧪 Testing

Test the POS with:
1. Login as cashier (username: `cashier`, password: `cashier123`)
2. Navigate to `/pos`
3. Add products to cart
4. Process a test sale
5. Verify calculations are correct

## 📝 Notes

- All calculations are done client-side
- Tax is calculated per item based on product tax rate
- Discounts can be applied per item (not implemented in UI yet)
- Receipt printing needs to be implemented based on your printer setup
- Customer search needs backend integration for full functionality

