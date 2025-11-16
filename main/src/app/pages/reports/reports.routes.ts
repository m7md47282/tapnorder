import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const ReportsRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./reports-dashboard/reports-dashboard.routes').then(m => m.ReportsDashboardRoutes)
  }
];

