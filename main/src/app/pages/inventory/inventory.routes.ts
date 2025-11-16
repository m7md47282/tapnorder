import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const InventoryRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./stock-management/stock-management.routes').then(m => m.StockManagementRoutes)
  }
];

