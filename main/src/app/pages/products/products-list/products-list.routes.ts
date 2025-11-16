import { Routes } from '@angular/router';
import { ProductsListComponent } from './products-list.component';

export const ProductsListRoutes: Routes = [
  {
    path: '',
    component: ProductsListComponent,
    data: {
      title: 'Products',
      urls: [
        { title: 'Products', url: '/products' },
        { title: 'Products List' }
      ]
    }
  }
];

