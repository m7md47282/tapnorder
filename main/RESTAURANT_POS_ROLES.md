# Restaurant POS System - User Roles & Permissions

## 🔴 Current Roles (Retail-Oriented)

The current system has these roles, which are more suited for retail/grocery:

```typescript
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',           // ✅ Keep
  STORE_MANAGER = 'STORE_MANAGER',       // ✅ Keep (rename to RESTAURANT_MANAGER)
  CASHIER = 'CASHIER',                   // ✅ Keep
  INVENTORY_MANAGER = 'INVENTORY_MANAGER', // ✅ Keep
  ACCOUNTANT = 'ACCOUNTANT',             // ✅ Keep
  SALES_STAFF = 'SALES_STAFF'            // ⚠️ Replace with WAITER
}
```

## 🟡 Missing Restaurant-Specific Roles

### Critical Roles to Add:

1. **WAITER/SERVER** - Most important for restaurants
2. **CHEF/KITCHEN_STAFF** - For kitchen display system
3. **HOST/HOSTESS** - For table and reservation management
4. **BARTENDER** - For bar-specific operations
5. **DELIVERY_DRIVER** - For delivery orders
6. **SHIFT_MANAGER** - For shift-level management

---

## 📋 Complete Restaurant POS Role Structure

### 1. **SUPER_ADMIN** ✅ (Keep)
- **Full System Access**
- **Permissions:**
  - All permissions
  - User management (create, edit, delete all users)
  - System settings
  - All reports and analytics
  - Multi-location management
  - Billing and subscription management

### 2. **RESTAURANT_MANAGER** (Rename from STORE_MANAGER)
- **Full Restaurant Operations**
- **Permissions:**
  - View all sales and reports
  - Manage menu items and pricing
  - Manage staff schedules
  - View and edit inventory
  - Handle refunds and voids
  - Access all tables and orders
  - View financial reports
  - Manage reservations
  - Adjust tips
  - Open/close cash drawers
  - View kitchen display system
  - Manage discounts and promotions
  - Cannot: Delete users, change system settings

### 3. **SHIFT_MANAGER** ⭐ (NEW - Add)
- **Shift-Level Management**
- **Permissions:**
  - All waiter permissions
  - View shift reports
  - Assign tables to servers
  - Handle customer complaints
  - Approve discounts (up to limit)
  - Void transactions (with reason)
  - View kitchen display system
  - Manage order priorities
  - Cannot: Edit menu, manage staff, view financial reports

### 4. **WAITER/SERVER** ⭐ (NEW - Add)
- **Front-of-House Service**
- **Permissions:**
  - Take orders (dine-in, takeout)
  - Assign tables
  - View assigned tables only
  - Add items to cart
  - Apply modifiers to items
  - Add special instructions
  - Process payments
  - Split bills
  - Add tips
  - View own sales only
  - Hold/resume orders
  - Cannot: View all tables, void transactions, access reports, manage inventory

### 5. **CASHIER** ✅ (Keep)
- **Payment Processing**
- **Permissions:**
  - Process payments
  - Handle refunds (with manager approval)
  - View payment history
  - Open/close cash drawer
  - Print receipts
  - Cannot: Take orders, manage tables, view reports

### 6. **HOST/HOSTESS** ⭐ (NEW - Add)
- **Table & Reservation Management**
- **Permissions:**
  - View all tables and status
  - Assign tables to servers
  - Create/edit reservations
  - Manage waitlist
  - Seat customers
  - Update table status
  - View reservation calendar
  - Cannot: Take orders, process payments, view sales

### 7. **CHEF/KITCHEN_STAFF** ⭐ (NEW - Add)
- **Kitchen Operations**
- **Permissions:**
  - View kitchen display system (KDS)
  - Update order status (In Progress, Ready)
  - View order details
  - Mark items as ready
  - View prep times
  - View special instructions
  - Cannot: View prices, process payments, access POS, view reports

### 8. **BARTENDER** ⭐ (NEW - Add)
- **Bar Operations**
- **Permissions:**
  - View bar orders only
  - Update drink order status
  - Process bar payments
  - View bar inventory
  - Cannot: Access dining room tables, view full menu, access reports

### 9. **DELIVERY_DRIVER** ⭐ (NEW - Add)
- **Delivery Operations**
- **Permissions:**
  - View assigned delivery orders
  - Update delivery status (Out for delivery, Delivered)
  - Mark orders as delivered
  - View delivery addresses
  - Collect payment on delivery
  - Cannot: Take orders, view dine-in tables, access reports

### 10. **INVENTORY_MANAGER** ✅ (Keep)
- **Inventory Control**
- **Permissions:**
  - View and edit inventory
  - Stock adjustments
  - View low stock alerts
  - Manage suppliers
  - View inventory reports
  - Cannot: Process sales, manage menu, view financial reports

### 11. **ACCOUNTANT** ✅ (Keep)
- **Financial Management**
- **Permissions:**
  - View all financial reports
  - View sales reports
  - Export financial data
  - View transaction history
  - Cannot: Process sales, manage menu, manage staff

### 12. **SALES_STAFF** ⚠️ (Remove or Keep for Marketing)
- **Sales & Marketing** (Optional)
- **Permissions:**
  - View sales reports
  - Manage customer database
  - Create promotions
  - View customer analytics
  - Cannot: Process sales, manage inventory

---

## 🔐 Permission System Structure

### Permission Categories:

```typescript
export enum PermissionCategory {
  // POS Operations
  POS_VIEW = 'pos:view',
  POS_CREATE_ORDER = 'pos:create_order',
  POS_EDIT_ORDER = 'pos:edit_order',
  POS_VOID_ORDER = 'pos:void_order',
  POS_PROCESS_PAYMENT = 'pos:process_payment',
  POS_REFUND = 'pos:refund',
  POS_SPLIT_BILL = 'pos:split_bill',
  POS_HOLD_ORDER = 'pos:hold_order',
  
  // Table Management
  TABLE_VIEW = 'table:view',
  TABLE_ASSIGN = 'table:assign',
  TABLE_MERGE = 'table:merge',
  TABLE_TRANSFER = 'table:transfer',
  
  // Menu Management
  MENU_VIEW = 'menu:view',
  MENU_EDIT = 'menu:edit',
  MENU_DELETE = 'menu:delete',
  MENU_PRICE_EDIT = 'menu:price_edit',
  
  // Kitchen Operations
  KDS_VIEW = 'kds:view',
  KDS_UPDATE_STATUS = 'kds:update_status',
  
  // Reservations
  RESERVATION_VIEW = 'reservation:view',
  RESERVATION_CREATE = 'reservation:create',
  RESERVATION_EDIT = 'reservation:edit',
  RESERVATION_DELETE = 'reservation:delete',
  
  // Reports
  REPORTS_VIEW = 'reports:view',
  REPORTS_SALES = 'reports:sales',
  REPORTS_FINANCIAL = 'reports:financial',
  REPORTS_EXPORT = 'reports:export',
  
  // Inventory
  INVENTORY_VIEW = 'inventory:view',
  INVENTORY_EDIT = 'inventory:edit',
  INVENTORY_ADJUST = 'inventory:adjust',
  
  // Staff Management
  STAFF_VIEW = 'staff:view',
  STAFF_EDIT = 'staff:edit',
  STAFF_SCHEDULE = 'staff:schedule',
  
  // Settings
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_EDIT = 'settings:edit',
  
  // Discounts
  DISCOUNT_APPLY = 'discount:apply',
  DISCOUNT_MANAGE = 'discount:manage',
  
  // Tips
  TIP_VIEW = 'tip:view',
  TIP_ADJUST = 'tip:adjust',
}
```

---

## 📊 Role Comparison Matrix

| Feature | Super Admin | Restaurant Manager | Shift Manager | Waiter | Cashier | Host | Chef | Bartender | Driver |
|---------|------------|-------------------|---------------|--------|---------|------|------|-----------|--------|
| **POS Operations** |
| Create Order | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Process Payment | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Void Transaction | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Refund | ✅ | ✅ | ❌ | ❌ | ✅* | ❌ | ❌ | ❌ | ❌ |
| Split Bill | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Table Management** |
| View All Tables | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Assign Tables | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Kitchen** |
| View KDS | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Update Order Status | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Reservations** |
| Create Reservation | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage Waitlist | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Menu** |
| Edit Menu | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Prices | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Reports** |
| View Sales Reports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Financial Reports | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export Reports | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Inventory** |
| View Inventory | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Edit Inventory | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Staff** |
| Manage Staff | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Schedules | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Settings** |
| System Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*With manager approval

---

## 🎯 Recommended Role Hierarchy

```
SUPER_ADMIN (Level 1)
  └── RESTAURANT_MANAGER (Level 2)
      ├── SHIFT_MANAGER (Level 3)
      │   ├── WAITER (Level 4)
      │   ├── CASHIER (Level 4)
      │   └── HOST (Level 4)
      ├── CHEF (Level 3)
      ├── BARTENDER (Level 3)
      └── DELIVERY_DRIVER (Level 3)
```

---

## 🚀 Implementation Plan

### Phase 1: Add Critical Restaurant Roles
1. Add `WAITER` role
2. Add `CHEF` role
3. Add `HOST` role
4. Rename `STORE_MANAGER` to `RESTAURANT_MANAGER`

### Phase 2: Add Additional Roles
5. Add `SHIFT_MANAGER` role
6. Add `BARTENDER` role
7. Add `DELIVERY_DRIVER` role

### Phase 3: Permission System
8. Implement granular permission system
9. Create role-permission mapping
10. Add permission checks to components

### Phase 4: UI Updates
11. Update role selection in user management
12. Add role-based menu visibility
13. Add role-based feature access

---

## 📝 Code Changes Needed

### 1. Update UserRole Enum

```typescript
export enum UserRole {
  // Admin
  SUPER_ADMIN = 'SUPER_ADMIN',
  
  // Management
  RESTAURANT_MANAGER = 'RESTAURANT_MANAGER',
  SHIFT_MANAGER = 'SHIFT_MANAGER',
  
  // Front of House
  WAITER = 'WAITER',
  CASHIER = 'CASHIER',
  HOST = 'HOST',
  
  // Back of House
  CHEF = 'CHEF',
  BARTENDER = 'BARTENDER',
  
  // Delivery
  DELIVERY_DRIVER = 'DELIVERY_DRIVER',
  
  // Support
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  SALES_STAFF = 'SALES_STAFF' // Optional
}
```

### 2. Create Permission Service

```typescript
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private rolePermissions: Map<UserRole, string[]> = new Map([
    [UserRole.SUPER_ADMIN, ['*']], // All permissions
    [UserRole.RESTAURANT_MANAGER, [
      'pos:*',
      'table:*',
      'menu:view',
      'menu:edit',
      'kds:view',
      'reservation:*',
      'reports:*',
      'inventory:view',
      'staff:view',
      'staff:edit'
    ]],
    [UserRole.WAITER, [
      'pos:view',
      'pos:create_order',
      'pos:edit_order',
      'pos:process_payment',
      'pos:split_bill',
      'pos:hold_order',
      'table:view', // Own tables only
      'menu:view',
      'kds:view'
    ]],
    // ... more role mappings
  ]);

  hasPermission(user: User, permission: string): boolean {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    const permissions = this.rolePermissions.get(user.role) || [];
    return permissions.includes('*') || permissions.includes(permission);
  }
}
```

### 3. Update Route Guards

Add role-based route protection:

```typescript
{
  path: 'pos',
  canActivate: [authGuard, roleGuard([
    UserRole.SUPER_ADMIN,
    UserRole.RESTAURANT_MANAGER,
    UserRole.SHIFT_MANAGER,
    UserRole.WAITER,
    UserRole.CASHIER
  ])],
  loadChildren: () => import('./pages/pos/pos.routes').then(m => m.PosRoutes)
}
```

---

## 🎨 UI Considerations

### Role-Based Menu Visibility
- **Waiter**: Show only POS, assigned tables, own sales
- **Chef**: Show only Kitchen Display System
- **Host**: Show only Tables, Reservations
- **Manager**: Show all menus

### Role-Based Dashboard
- Different dashboard views per role
- Waiter: Today's assigned tables, active orders
- Chef: Kitchen orders, prep times
- Manager: Sales summary, staff performance

---

## ✅ Summary

**Current State:**
- 6 roles (retail-oriented)
- Basic role checking
- No granular permissions

**Needed:**
- 12 roles (restaurant-specific)
- Granular permission system
- Role-based UI visibility
- Role-based feature access

**Priority:**
1. Add WAITER, CHEF, HOST roles (Critical)
2. Implement permission system
3. Add remaining roles
4. Update UI for role-based access

