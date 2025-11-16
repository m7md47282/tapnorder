import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const SettingsRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./settings-dashboard/settings-dashboard.routes').then(m => m.SettingsDashboardRoutes)
  }
];

