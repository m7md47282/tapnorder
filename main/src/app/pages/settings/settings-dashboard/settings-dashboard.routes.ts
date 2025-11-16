import { Routes } from '@angular/router';
import { SettingsDashboardComponent } from './settings-dashboard.component';

export const SettingsDashboardRoutes: Routes = [
  {
    path: '',
    component: SettingsDashboardComponent,
    data: {
      title: 'Settings',
      urls: [
        { title: 'Settings', url: '/settings' },
        { title: 'Settings Dashboard' }
      ]
    }
  }
];

