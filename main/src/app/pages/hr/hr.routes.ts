import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const HrRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./hr-dashboard/hr-dashboard.routes').then(m => m.HrDashboardRoutes)
  }
];

