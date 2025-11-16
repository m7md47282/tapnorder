import { Routes } from '@angular/router';
import { AccountingDashboardComponent } from './accounting-dashboard.component';

export const AccountingDashboardRoutes: Routes = [
  {
    path: '',
    component: AccountingDashboardComponent,
    data: {
      title: 'Accounting',
      urls: [
        { title: 'Accounting', url: '/accounting' },
        { title: 'Accounting Dashboard' }
      ]
    }
  }
];

