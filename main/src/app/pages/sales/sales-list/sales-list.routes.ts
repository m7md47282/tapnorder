import { Routes } from '@angular/router';
import { SalesListComponent } from './sales-list.component';

export const SalesListRoutes: Routes = [
  {
    path: '',
    component: SalesListComponent,
    data: {
      title: 'Sales',
      urls: [
        { title: 'Sales', url: '/sales' },
        { title: 'Sales List' }
      ]
    }
  }
];

