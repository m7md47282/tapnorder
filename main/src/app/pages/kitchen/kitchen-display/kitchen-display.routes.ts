import { Routes } from '@angular/router';

export const KitchenDisplayRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./kitchen-display.component').then((m) => m.KitchenDisplayComponent),
  },
];




