# Inventory Deduction Flow - Complete Implementation Guide

## Overview
This document describes the complete flow of how inventory deduction works when items are purchased, from creating items with recipes to deducting inventory on purchase.

## Complete Flow

### 1. **Creating an Item with Recipe/Ingredients**

#### Step 1: Add Product (Inventory Item)
- Go to **Products** page
- Click "Add Product"
- Fill in product details (e.g., "Milk", "Coffee", "Condensed Milk")
- These are the **inventory products** that will be used as ingredients

#### Step 2: Create Menu Item with Recipe
- Go to **Products** page
- Click "Add Product" (this creates a menu item)
- Fill in item details:
  - Name: "Spanish Latte"
  - Price: 5.00
  - Category: "Beverages"
  - etc.
- Scroll to **Recipe/Ingredients** section
- Click "Add Ingredient"
- For each ingredient:
  - **Product**: Select from dropdown (e.g., "Milk")
  - **Quantity**: Enter amount (e.g., 250)
  - **Unit**: Select unit (e.g., "ml")
- Example recipe for Spanish Latte:
  - Milk: 250 ml
  - Coffee: 30 ml
  - Condensed Milk: 50 ml
- Click "Create"

#### Step 3: Save Recipe to Database
- `ProductFormDialogComponent.onSubmit()` builds recipe array:
  ```typescript
  const recipe: ItemIngredient[] = [
    { productId: "milk-id", productName: "Milk", quantity: 250, unit: "ml" },
    { productId: "coffee-id", productName: "Coffee", quantity: 30, unit: "ml" },
    { productId: "condensed-milk-id", productName: "Condensed Milk", quantity: 50, unit: "ml" }
  ]
  ```
- `ProductsListComponent.createProduct()` converts Product to CreateItemCommand
- `productToCreateItemCommand()` includes recipe in command
- `ItemsService.createItem()` saves to database with recipe

### 2. **Editing an Item with Recipe**

#### Step 1: Load Item with Recipe
- Click "Edit" on an item
- `ProductsListComponent.openEditDialog()` fetches full Item from database
- `itemToProduct()` preserves recipe in Product object
- Dialog receives Product with recipe data

#### Step 2: Display Recipe in Form
- `ProductFormDialogComponent.ngOnInit()` loads recipe into FormArray
- Each ingredient appears as a row with:
  - Product selector (pre-filled)
  - Quantity input (pre-filled)
  - Unit selector (pre-filled)
- User can add/remove/modify ingredients

#### Step 3: Save Updated Recipe
- Same flow as creating - recipe is included in UpdateItemCommand
- `ItemsService.updateItem()` saves updated recipe to database

### 3. **Purchasing an Item (Inventory Deduction)**

#### Scenario: Customer Orders 2 Spanish Lattes

#### Step 1: Add to Cart
- Customer adds "Spanish Latte" to cart (quantity: 2)
- `CartService.addToCart()` creates CartItem:
  ```typescript
  {
    id: "spanish-latte-id-1234567890",
    item: { id: "spanish-latte-id", name: "Spanish Latte", ... },
    quantity: 2,
    price: 5.00,
    subtotal: 10.00
  }
  ```

#### Step 2: Process Payment
- Customer clicks payment button
- `GuestMenuComponent.processPayment()` is called
- `OrderService.createOrder()` creates order:
  ```typescript
  {
    orderNumber: "ORD-12345678-001",
    items: [CartItem with quantity: 2],
    total: 10.00,
    ...
  }
  ```

#### Step 3: Inventory Deduction Triggered
- After order is saved, `OrderService.createOrder()` calls:
  ```typescript
  this.inventoryDeduction.deductInventoryForOrder(order)
  ```

#### Step 4: Process Each Item in Order
- `InventoryDeductionService.deductInventoryForOrder()`:
  1. Loops through each CartItem in order
  2. For each item, fetches full Item from database: `itemsService.getItemById(cartItem.item.id)`
  3. Gets recipe from Item: `item.recipe`
  4. For each ingredient in recipe:
     - Calculates total quantity: `ingredient.quantity * cartItem.quantity`
     - Example: Milk 250ml × 2 = 500ml
  5. Aggregates ingredients by productId

#### Step 5: Deduct from Inventory
- For Spanish Latte (quantity: 2):
  - Milk: 250ml × 2 = **500ml deducted**
  - Coffee: 30ml × 2 = **60ml deducted**
  - Condensed Milk: 50ml × 2 = **100ml deducted**
- `deductProductInventory()` is called for each ingredient
- Currently logs deduction (ready for backend API integration)

### 4. **POS Screen Flow**

#### Step 1: Add Product to Cart
- Cashier adds "Spanish Latte" to POS cart
- Uses Product model (converted from Item)

#### Step 2: Process Sale
- `PosScreenComponent.processPayment()` creates Sale
- Calls `inventoryDeduction.deductInventoryForSale(sale)`

#### Step 3: Inventory Deduction
- `deductInventoryForSale()`:
  1. Converts POS CartItems (with Product) to Item lookups
  2. Fetches Item by Product.id to get recipe
  3. Processes recipe same as guest orders
  4. Deducts inventory

## Data Flow Diagram

```
┌─────────────────┐
│ Create Product  │ (Milk, Coffee, etc.)
│ (Inventory)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Item     │ (Spanish Latte)
│ with Recipe     │ Recipe: [
│                 │   {productId: "milk", qty: 250, unit: "ml"},
│                 │   {productId: "coffee", qty: 30, unit: "ml"}
│                 │ ]
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Save to DB      │ Item.recipe = [...]
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Customer Orders │ CartItem: {item: Spanish Latte, qty: 2}
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Order    │ Order.items = [CartItem]
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deduct Inventory│
│                 │ 1. Fetch Item by ID
│                 │ 2. Get recipe
│                 │ 3. Calculate: qty × order_qty
│                 │ 4. Deduct from each ingredient
└─────────────────┘
```

## Key Components

### Models
- **Item**: Menu item with optional `recipe: ItemIngredient[]`
- **ItemIngredient**: `{ productId, productName, quantity, unit }`
- **CartItem**: Contains `item: MenuItem` with `id` reference
- **Order**: Contains `items: CartItem[]`

### Services
- **ItemsService**: CRUD operations for Items (includes recipe)
- **InventoryDeductionService**: Handles deduction logic
- **OrderService**: Creates orders and triggers deduction

### Components
- **ProductFormDialogComponent**: UI for adding/editing recipes
- **ProductsListComponent**: Manages product list and conversions
- **GuestMenuComponent**: Customer ordering interface
- **PosScreenComponent**: Cashier POS interface

## Testing Checklist

- [ ] Create inventory products (Milk, Coffee, etc.)
- [ ] Create menu item (Spanish Latte) with recipe
- [ ] Verify recipe is saved to database
- [ ] Edit item and verify recipe loads correctly
- [ ] Add item to cart (guest menu)
- [ ] Place order with quantity > 1
- [ ] Verify inventory deduction is triggered
- [ ] Check console logs for deduction calculations
- [ ] Test POS screen order processing
- [ ] Verify deduction works for multiple items in one order

## Notes

- **Current Implementation**: Logs deductions (ready for backend API)
- **Production**: Update `deductProductInventory()` to call backend API
- **Stock Tracking**: Items don't have stock field yet - needs backend support
- **Unit Conversion**: Currently assumes same units - can be extended


