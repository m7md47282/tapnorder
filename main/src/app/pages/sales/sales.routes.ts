import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const SalesRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./sales-list/sales-list.routes').then(m => m.SalesListRoutes)
  }
];

