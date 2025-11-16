import { Routes } from '@angular/router';
import { ReportsDashboardComponent } from './reports-dashboard.component';

export const ReportsDashboardRoutes: Routes = [
  {
    path: '',
    component: ReportsDashboardComponent,
    data: {
      title: 'Reports',
      urls: [
        { title: 'Reports', url: '/reports' },
        { title: 'Reports Dashboard' }
      ]
    }
  }
];

