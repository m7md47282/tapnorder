import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const CustomersRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./customers-list/customers-list.routes').then(m => m.CustomersListRoutes)
  }
];

