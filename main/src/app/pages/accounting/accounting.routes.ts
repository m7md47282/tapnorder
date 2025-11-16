import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const AccountingRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./accounting-dashboard/accounting-dashboard.routes').then(m => m.AccountingDashboardRoutes)
  }
];

