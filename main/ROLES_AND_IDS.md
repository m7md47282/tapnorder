# Restaurant POS System - Roles and Role IDs Reference

This document lists all available roles and their corresponding IDs for backend API integration.

## Role Mapping

The frontend uses string-based role enums. The backend may expect either:
- **String values** (e.g., `"SUPER_ADMIN"`) - Use the enum value directly
- **Numeric IDs** (e.g., `1`, `2`, `3`) - Use the ID mapping below

### Complete Role List with IDs

| Role ID | Role Name (Enum Value) | Display Name | Category | Description |
|---------|------------------------|--------------|----------|-------------|
| 1 | `SUPER_ADMIN` | Super Admin | Admin | Full system access, user management, system settings |
| 2 | `RESTAURANT_MANAGER` | Restaurant Manager | Management | Full restaurant operations, menu management, staff schedules |
| 3 | `SHIFT_MANAGER` | Shift Manager | Management | Shift-level management, table assignment, shift reports |
| 4 | `WAITER` | Waiter/Server | Front of House | Take orders, process payments, manage assigned tables |
| 5 | `CASHIER` | Cashier | Front of House | Process payments, handle refunds, open/close cash drawer |
| 6 | `HOST` | Host/Hostess | Front of House | Table management, reservations, waitlist management |
| 7 | `CHEF` | Chef/Kitchen Staff | Back of House | Kitchen display system, update order status |
| 8 | `BARTENDER` | Bartender | Back of House | Bar orders, drink preparation, bar payments |
| 9 | `DELIVERY_DRIVER` | Delivery Driver | Delivery | Delivery operations, order pickup, delivery tracking |
| 10 | `INVENTORY_MANAGER` | Inventory Manager | Support | Inventory management, stock tracking, supplier management |
| 11 | `ACCOUNTANT` | Accountant | Support | Financial reports, accounting operations, financial analysis |
| 12 | `SALES_STAFF` | Sales Staff | Support | Sales operations, customer relations, marketing |
| 13 | `STORE_MANAGER` | Store Manager (Legacy) | Legacy | Maps to RESTAURANT_MANAGER for backward compatibility |

## Usage Examples

### Using String Values (Recommended)
```typescript
// TypeScript enum value
const role = UserRole.SUPER_ADMIN; // "SUPER_ADMIN"

// API request body
{
  "role": "SUPER_ADMIN"
}
```

### Using Numeric IDs (If backend requires)
```typescript
// TypeScript constant mapping
const ROLE_IDS = {
  SUPER_ADMIN: 1,
  RESTAURANT_MANAGER: 2,
  SHIFT_MANAGER: 3,
  WAITER: 4,
  CASHIER: 5,
  HOST: 6,
  CHEF: 7,
  BARTENDER: 8,
  DELIVERY_DRIVER: 9,
  INVENTORY_MANAGER: 10,
  ACCOUNTANT: 11,
  SALES_STAFF: 12,
  STORE_MANAGER: 13
};

// API request body
{
  "roleId": 1  // or "role": 1 depending on backend API
}
```

## Role Hierarchy

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

## Backend API Integration

### Creating/Updating Users
When creating or updating users via the backend API, use one of these formats:

**Option 1: String-based (if backend accepts enum strings)**
```json
{
  "username": "john.doe",
  "email": "john@example.com",
  "role": "WAITER",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Option 2: Numeric ID (if backend requires numeric IDs)**
```json
{
  "username": "john.doe",
  "email": "john@example.com",
  "roleId": 4,
  "firstName": "John",
  "lastName": "Doe"
}
```

**Option 3: Both (if backend accepts both)**
```json
{
  "username": "john.doe",
  "email": "john@example.com",
  "role": "WAITER",
  "roleId": 4,
  "firstName": "John",
  "lastName": "Doe"
}
```

## Quick Reference: Role IDs Only

```typescript
// Quick lookup for numeric IDs
export const ROLE_IDS = {
  SUPER_ADMIN: 1,
  RESTAURANT_MANAGER: 2,
  SHIFT_MANAGER: 3,
  WAITER: 4,
  CASHIER: 5,
  HOST: 6,
  CHEF: 7,
  BARTENDER: 8,
  DELIVERY_DRIVER: 9,
  INVENTORY_MANAGER: 10,
  ACCOUNTANT: 11,
  SALES_STAFF: 12,
  STORE_MANAGER: 13
} as const;

// Reverse lookup: ID to Role Name
export const ROLE_NAMES: Record<number, string> = {
  1: 'SUPER_ADMIN',
  2: 'RESTAURANT_MANAGER',
  3: 'SHIFT_MANAGER',
  4: 'WAITER',
  5: 'CASHIER',
  6: 'HOST',
  7: 'CHEF',
  8: 'BARTENDER',
  9: 'DELIVERY_DRIVER',
  10: 'INVENTORY_MANAGER',
  11: 'ACCOUNTANT',
  12: 'SALES_STAFF',
  13: 'STORE_MANAGER'
};
```

## Notes

- **STORE_MANAGER** is a legacy role that maps to **RESTAURANT_MANAGER** for backward compatibility
- Role IDs are sequential starting from 1
- The frontend currently uses string-based enums (`UserRole.SUPER_ADMIN` = `"SUPER_ADMIN"`)
- Verify with your backend API documentation which format (string or numeric) is expected
- If your backend uses different IDs, update this document accordingly


