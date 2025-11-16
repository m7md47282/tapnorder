import { Routes } from '@angular/router';
import { StockManagementComponent } from './stock-management.component';

export const StockManagementRoutes: Routes = [
  {
    path: '',
    component: StockManagementComponent,
    data: {
      title: 'Inventory',
      urls: [
        { title: 'Inventory', url: '/inventory' },
        { title: 'Stock Management' }
      ]
    }
  }
];

