import { Routes } from '@angular/router';
import { HrDashboardComponent } from './hr-dashboard.component';

export const HrDashboardRoutes: Routes = [
  {
    path: '',
    component: HrDashboardComponent,
    data: {
      title: 'Human Resources',
      urls: [
        { title: 'HR', url: '/hr' },
        { title: 'HR Dashboard' }
      ]
    }
  }
];

