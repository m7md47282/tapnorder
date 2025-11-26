import { Routes } from '@angular/router';
import { CategoriesListComponent } from './categories-list.component';

export const CategoriesListRoutes: Routes = [
  {
    path: '',
    component: CategoriesListComponent,
    data: {
      title: 'Categories',
      urls: [
        { title: 'Products', url: '/products' },
        { title: 'Categories' },
      ],
    },
  },
];

