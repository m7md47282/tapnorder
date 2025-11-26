import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const ProductsRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./products-list/products-list.routes').then(m => m.ProductsListRoutes)
  },
  {
    path: 'categories',
    canActivate: [authGuard],
    loadChildren: () => import('./categories-list/categories-list.routes').then(m => m.CategoriesListRoutes)
  }
];

