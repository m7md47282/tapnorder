import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { UserRole } from './models/user.model';

export const routes: Routes = [
  {
    path: '',
    component: FullComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: '/dashboard', // Will be handled by role-based redirect in auth guard
        pathMatch: 'full',
      },
      {
        path: 'addons',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.SHIFT_MANAGER,
          UserRole.INVENTORY_MANAGER,
          UserRole.STORE_MANAGER
        ])],
        loadComponent: () =>
          import('./pages/addons/addon-groups/addon-groups.component').then(m => m.AddonGroupsComponent)
      },
      {
        path: 'dashboard',
        canActivate: [roleGuard([
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
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
      },
      {
        path: 'pos',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.SHIFT_MANAGER,
          UserRole.WAITER,
          UserRole.CASHIER,
          UserRole.BARTENDER,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/pos/pos.routes').then((m) => m.PosRoutes),
      },
      {
        path: 'products',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.SHIFT_MANAGER,
          UserRole.WAITER,
          UserRole.CASHIER,
          UserRole.BARTENDER,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/products/products.routes').then((m) => m.ProductsRoutes),
      },
      {
        path: 'sales',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.SHIFT_MANAGER,
          UserRole.WAITER,
          UserRole.CASHIER,
          UserRole.ACCOUNTANT,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/sales/sales.routes').then((m) => m.SalesRoutes),
      },
      {
        path: 'customers',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.SHIFT_MANAGER,
          UserRole.WAITER,
          UserRole.HOST,
          UserRole.SALES_STAFF,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/customers/customers.routes').then((m) => m.CustomersRoutes),
      },
      {
        path: 'inventory',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.INVENTORY_MANAGER,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/inventory/inventory.routes').then((m) => m.InventoryRoutes),
      },
      {
        path: 'reports',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.SHIFT_MANAGER,
          UserRole.ACCOUNTANT,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/reports/reports.routes').then((m) => m.ReportsRoutes),
      },
      {
        path: 'settings',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/settings/settings.routes').then((m) => m.SettingsRoutes),
      },
      {
        path: 'accounting',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.ACCOUNTANT,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/accounting/accounting.routes').then((m) => m.AccountingRoutes),
      },
      {
        path: 'hr',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/hr/hr.routes').then((m) => m.HrRoutes),
      },
      {
        path: 'kitchen',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.SHIFT_MANAGER,
          UserRole.CHEF,
          UserRole.BARTENDER,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/kitchen/kitchen.routes').then((m) => m.KitchenRoutes),
      },
      {
        path: 'tables',
        canActivate: [roleGuard([
          UserRole.SUPER_ADMIN,
          UserRole.RESTAURANT_MANAGER,
          UserRole.SHIFT_MANAGER,
          UserRole.WAITER,
          UserRole.HOST,
          UserRole.CASHIER,
          UserRole.STORE_MANAGER
        ])],
        loadChildren: () =>
          import('./pages/tables/tables.routes').then((m) => m.TablesRoutes),
      },
    ],
  },
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: 'authentication',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
      {
        path: 'menu',
        loadChildren: () =>
          import('./pages/guest-menu/guest-menu.routes').then(
            (m) => m.GuestMenuRoutes
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
