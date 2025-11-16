import { Routes } from '@angular/router';

export const CookbookRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./cookbook.component').then((m) => m.CookbookComponent),
  },
];

