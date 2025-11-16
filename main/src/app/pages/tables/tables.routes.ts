import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const TablesRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./tables-list/tables-list.routes').then(m => m.TablesListRoutes)
  }
];

