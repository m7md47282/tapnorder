import { Injectable } from '@angular/core';
import { UserRole } from '../models/user.model';

export interface RoutePermission {
  route: string;
  roles: UserRole[];
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  // Define which routes each role can access
  private routePermissions: Map<string, UserRole[]> = new Map([
    // Dashboard - All authenticated users except CHEF (chefs go directly to kitchen)
    ['/dashboard', [
      UserRole.SUPER_ADMIN,
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.WAITER,
      UserRole.CASHIER,
      UserRole.HOST,
      UserRole.BARTENDER,
      UserRole.DELIVERY_DRIVER,
      UserRole.INVENTORY_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.SALES_STAFF,
      UserRole.STORE_MANAGER // Legacy
    ]],

    // POS - Front of house staff
    ['/pos', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.WAITER,
      UserRole.CASHIER,
      UserRole.BARTENDER
    ]],

    // Products/Menu - Management and viewing
    ['/products', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.WAITER,
      UserRole.CASHIER,
      UserRole.BARTENDER,
      UserRole.STORE_MANAGER
    ]],

    // Sales - Management and viewing
    ['/sales', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.WAITER,
      UserRole.CASHIER,
      UserRole.ACCOUNTANT,
      UserRole.STORE_MANAGER
    ]],

    // Customers - All staff who interact with customers
    ['/customers', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.WAITER,
      UserRole.HOST,
      UserRole.SALES_STAFF,
      UserRole.STORE_MANAGER
    ]],

    // Inventory - Management only
    ['/inventory', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.INVENTORY_MANAGER,
      UserRole.STORE_MANAGER
    ]],

    // Addon Groups - menu administrators
    ['/addons', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.INVENTORY_MANAGER,
      UserRole.STORE_MANAGER
    ]],

    // Places - Super admin only
    ['/places', [
      UserRole.SUPER_ADMIN
    ]],

    // Place Settings - Restaurant managers and super admin
    ['/places/settings', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.STORE_MANAGER,
      UserRole.SUPER_ADMIN
    ]],

    // Reports - Management and accounting
    ['/reports', [
      UserRole.SUPER_ADMIN,
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.STORE_MANAGER
    ]],

    // Settings - Admin and management only
    ['/settings', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.STORE_MANAGER
    ]],

    // Accounting - Financial staff
    ['/accounting', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.STORE_MANAGER
    ]],

    // HR - Management only
    ['/hr', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.STORE_MANAGER
    ]],

    // Kitchen Display System (KDS) - Kitchen staff
    ['/kitchen', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.CHEF,
      UserRole.BARTENDER
    ]],

    // Tables - Host, cashier, waiter and management
    ['/tables', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.WAITER,
      UserRole.CASHIER,
      UserRole.HOST,
      UserRole.STORE_MANAGER
    ]],

    // Reservations - Host and management
    ['/reservations', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.HOST,
      UserRole.STORE_MANAGER
    ]],

    // Delivery - Drivers and management
    ['/delivery', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.DELIVERY_DRIVER,
      UserRole.STORE_MANAGER
    ]],

    // Guest Menu - All staff can view (to see what customers see)
    ['/menu', [
      UserRole.RESTAURANT_MANAGER,
      UserRole.SHIFT_MANAGER,
      UserRole.WAITER,
      UserRole.CASHIER,
      UserRole.HOST,
      UserRole.BARTENDER,
      UserRole.SALES_STAFF,
      UserRole.STORE_MANAGER
    ]]
  ]);

  /**
   * Check if a role can access a route
   */
  canAccessRoute(route: string, role: UserRole): boolean {
    // Legacy support: STORE_MANAGER maps to RESTAURANT_MANAGER
    if (role === UserRole.STORE_MANAGER) {
      role = UserRole.RESTAURANT_MANAGER;
    }

    const allowedRoles = this.routePermissions.get(route);
    if (!allowedRoles) {
      // If route not in map, deny access (secure by default)
      return false;
    }

    return allowedRoles.includes(role);
  }

  /**
   * Get all routes a role can access
   */
  getAllowedRoutes(role: UserRole): string[] {
    const routes: string[] = [];

    // Legacy support
    const checkRole = role === UserRole.STORE_MANAGER 
      ? UserRole.RESTAURANT_MANAGER 
      : role;

    this.routePermissions.forEach((allowedRoles, route) => {
      if (allowedRoles.includes(checkRole)) {
        routes.push(route);
      }
    });

    return routes;
  }

  /**
   * Get role-specific navigation items
   */
  getRoleNavigation(role: UserRole): { route: string; displayName: string; iconName: string }[] {
    const allowedRoutes = this.getAllowedRoutes(role);
    
    // Define all navigation items with their routes
    const allNavItems: { route: string; displayName: string; iconName: string; navCap?: string }[] = [
      { route: '/dashboard', displayName: 'Dashboard', iconName: 'layout-grid-add' },
      { route: '/pos', displayName: 'Point of Sale', iconName: 'shopping-cart' },
      { route: '/products', displayName: 'Products', iconName: 'package' },
      { route: '/sales', displayName: 'Sales', iconName: 'receipt' },
      { route: '/customers', displayName: 'Customers', iconName: 'users' },
      { route: '/inventory', displayName: 'Inventory', iconName: 'database' },
      { route: '/addons', displayName: 'Addon Groups', iconName: 'apps' },
      { route: '/places', displayName: 'Place Management', iconName: 'building-store' },
      { route: '/reports', displayName: 'Reports', iconName: 'chart-bar' },
      { route: '/settings', displayName: 'Settings', iconName: 'settings' },
      { route: '/places/settings', displayName: 'Place Settings', iconName: 'settings-2' },
      { route: '/accounting', displayName: 'Accounting', iconName: 'calculator' },
      { route: '/hr', displayName: 'HR Management', iconName: 'users' },
      { route: '/kitchen', displayName: 'Kitchen Display', iconName: 'chef-hat' }, // Note: May need to use 'utensils' or 'cooker' if chef-hat doesn't exist
      { route: '/tables', displayName: 'Tables', iconName: 'table' },
      { route: '/reservations', displayName: 'Reservations', iconName: 'calendar' },
      { route: '/delivery', displayName: 'Delivery', iconName: 'truck' },
      { route: '/menu', displayName: 'Guest Menu', iconName: 'menu-2' },
    ];

    // Filter to only allowed routes
    return allNavItems
      .filter(item => allowedRoutes.includes(item.route))
      .map(({ route, displayName, iconName }) => ({ route, displayName, iconName }));
  }
}

