import { Routes } from '@angular/router';
import { CustomersListComponent } from './customers-list.component';

export const CustomersListRoutes: Routes = [
  {
    path: '',
    component: CustomersListComponent,
    data: {
      title: 'Customers',
      urls: [
        { title: 'Customers', url: '/customers' },
        { title: 'Customers List' }
      ]
    }
  }
];

