import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const PosRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./pos-screen/pos-screen.routes').then(m => m.PosScreenRoutes)
  }
];

