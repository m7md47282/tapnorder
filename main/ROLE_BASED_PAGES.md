# Role-Based Page Access

This document outlines which pages each role can access in the Restaurant POS system.

## 📋 Page Access by Role

### **SUPER_ADMIN** 👑
**Access:** All pages
- ✅ Dashboard
- ✅ Point of Sale (POS)
- ✅ Products
- ✅ Sales
- ✅ Customers
- ✅ Inventory
- ✅ Reports
- ✅ Settings
- ✅ Accounting
- ✅ HR Management
- ✅ UI Components (Development)
- ✅ Extra Pages

---

### **RESTAURANT_MANAGER** 🏢
**Access:** Full restaurant operations (except system settings)
- ✅ Dashboard
- ✅ Point of Sale (POS)
- ✅ Products
- ✅ Sales
- ✅ Customers
- ✅ Inventory
- ✅ Reports
- ✅ Settings
- ✅ Accounting
- ✅ HR Management
- ❌ UI Components
- ❌ Extra Pages

**Typical Use Cases:**
- Manage daily operations
- View all reports and analytics
- Manage staff and inventory
- Configure restaurant settings

---

### **SHIFT_MANAGER** 👔
**Access:** Shift-level management
- ✅ Dashboard
- ✅ Point of Sale (POS)
- ✅ Products
- ✅ Sales
- ✅ Customers
- ✅ Reports
- ❌ Inventory
- ❌ Settings
- ❌ Accounting
- ❌ HR Management

**Typical Use Cases:**
- Oversee shift operations
- View shift reports
- Manage tables and orders
- Handle customer issues

---

### **WAITER** 🍽️
**Access:** Front-of-house service
- ✅ Dashboard
- ✅ Point of Sale (POS)
- ✅ Products (View only)
- ✅ Sales (View own sales)
- ✅ Customers
- ❌ Inventory
- ❌ Reports
- ❌ Settings
- ❌ Accounting
- ❌ HR Management

**Typical Use Cases:**
- Take customer orders
- Process payments
- View assigned tables
- Access customer information

---

### **CASHIER** 💰
**Access:** Payment processing
- ✅ Dashboard
- ✅ Point of Sale (POS)
- ✅ Products (View only)
- ✅ Sales (View all)
- ❌ Customers
- ❌ Inventory
- ❌ Reports
- ❌ Settings
- ❌ Accounting
- ❌ HR Management

**Typical Use Cases:**
- Process payments
- Handle refunds (with approval)
- View sales transactions
- Open/close cash drawer

---

### **HOST** 🎫
**Access:** Table and reservation management
- ✅ Dashboard
- ✅ Customers
- ✅ Tables (if implemented)
- ✅ Reservations (if implemented)
- ❌ POS
- ❌ Products
- ❌ Sales
- ❌ Inventory
- ❌ Reports
- ❌ Settings

**Typical Use Cases:**
- Manage table assignments
- Create/edit reservations
- Manage waitlist
- Seat customers

---

### **CHEF** 👨‍🍳
**Access:** Kitchen operations
- ✅ Dashboard
- ✅ Kitchen Display System (if implemented)
- ❌ POS
- ❌ Products
- ❌ Sales
- ❌ Customers
- ❌ Inventory
- ❌ Reports
- ❌ Settings

**Typical Use Cases:**
- View kitchen orders
- Update order status
- Mark items as ready
- View prep times

---

### **BARTENDER** 🍸
**Access:** Bar operations
- ✅ Dashboard
- ✅ Point of Sale (POS) - Bar orders only
- ✅ Products (View bar items)
- ✅ Kitchen Display System (Bar station)
- ❌ Sales
- ❌ Customers
- ❌ Inventory
- ❌ Reports
- ❌ Settings

**Typical Use Cases:**
- Take bar orders
- Process bar payments
- View bar inventory
- Update drink order status

---

### **DELIVERY_DRIVER** 🚚
**Access:** Delivery operations
- ✅ Dashboard
- ✅ Delivery (if implemented)
- ❌ POS
- ❌ Products
- ❌ Sales
- ❌ Customers
- ❌ Inventory
- ❌ Reports
- ❌ Settings

**Typical Use Cases:**
- View assigned delivery orders
- Update delivery status
- Mark orders as delivered
- Collect payment on delivery

---

### **INVENTORY_MANAGER** 📦
**Access:** Inventory control
- ✅ Dashboard
- ✅ Inventory
- ✅ Products (View)
- ❌ POS
- ❌ Sales
- ❌ Customers
- ❌ Reports
- ❌ Settings
- ❌ Accounting
- ❌ HR Management

**Typical Use Cases:**
- Manage stock levels
- Stock adjustments
- View low stock alerts
- Manage suppliers

---

### **ACCOUNTANT** 📊
**Access:** Financial management
- ✅ Dashboard
- ✅ Sales (View)
- ✅ Reports (Financial)
- ✅ Accounting
- ❌ POS
- ❌ Products
- ❌ Customers
- ❌ Inventory
- ❌ Settings
- ❌ HR Management

**Typical Use Cases:**
- View financial reports
- Export financial data
- View transaction history
- Manage accounting records

---

### **SALES_STAFF** 📈
**Access:** Sales and marketing
- ✅ Dashboard
- ✅ Customers
- ❌ POS
- ❌ Products
- ❌ Sales
- ❌ Inventory
- ❌ Reports
- ❌ Settings
- ❌ Accounting
- ❌ HR Management

**Typical Use Cases:**
- Manage customer database
- View customer analytics
- Create promotions
- Marketing activities

---

### **STORE_MANAGER** (Legacy) 🏪
**Access:** Maps to RESTAURANT_MANAGER
- Same as RESTAURANT_MANAGER

---

## 🔐 Route Protection

All routes are protected with:
1. **AuthGuard** - Ensures user is authenticated
2. **RoleGuard** - Ensures user has required role

If a user tries to access a page they don't have permission for:
- They will see an error notification
- They will be redirected to the dashboard
- The route will be blocked

---

## 📱 Sidebar Navigation

The sidebar automatically filters based on user role:
- Only shows pages the user can access
- Updates dynamically when user changes
- Organized by sections (POS System, Reports, Finance, etc.)

---

## 🧪 Testing Role Access

Use these test accounts to verify role-based access:

| Role | Username | Password | Can Access |
|------|----------|----------|------------|
| SUPER_ADMIN | `admin` | `admin123` | All pages |
| RESTAURANT_MANAGER | `manager` | `manager123` | Most pages |
| WAITER | `waiter` | `waiter123` | POS, Products, Sales, Customers |
| CASHIER | `cashier` | `cashier123` | POS, Products, Sales |
| HOST | `host` | `host123` | Customers, Tables, Reservations |
| CHEF | `chef` | `chef123` | Kitchen Display |
| BARTENDER | `bartender` | `bar123` | POS (bar), Products |
| DRIVER | `driver` | `driver123` | Delivery |
| INVENTORY_MANAGER | `inventory` | `inv123` | Inventory, Products |
| ACCOUNTANT | `accountant` | `acc123` | Sales, Reports, Accounting |

---

## 🎯 Implementation Details

### Permission Service
- Located at: `src/app/services/permission.service.ts`
- Maps routes to allowed roles
- Provides `canAccessRoute()` method
- Provides `getAllowedRoutes()` method
- Provides `getRoleNavigation()` method

### Route Guards
- Located at: `src/app/guards/role.guard.ts`
- Applied to routes in `app.routes.ts`
- Checks user role before allowing access

### Dynamic Navigation
- Located at: `src/app/layouts/full/full.component.ts`
- Filters sidebar items based on user role
- Updates automatically when user changes

---

## 📝 Notes

1. **Super Admin** always has access to everything
2. **Legacy STORE_MANAGER** role maps to RESTAURANT_MANAGER
3. Routes not in the permission map are denied by default (secure by default)
4. Navigation updates automatically when user logs in/out
5. Direct URL access is blocked if user doesn't have permission

---

## 🚀 Future Enhancements

- Add more granular permissions (e.g., view vs edit)
- Add role-based dashboard views
- Add role-based feature flags
- Add audit logging for access attempts
- Add role-based UI customization





