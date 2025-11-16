import { Routes } from '@angular/router';

export const KitchenRoutes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./kitchen-display/kitchen-display.routes').then(
        (m) => m.KitchenDisplayRoutes
      ),
  },
  {
    path: 'cookbook',
    loadChildren: () =>
      import('./cookbook/cookbook.routes').then(
        (m) => m.CookbookRoutes
      ),
  },
];

