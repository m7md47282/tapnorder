import { Routes } from '@angular/router';
import { TablesListComponent } from './tables-list.component';

export const TablesListRoutes: Routes = [
  {
    path: '',
    component: TablesListComponent,
    data: {
      title: 'Tables',
      urls: [
        { title: 'Tables', url: '/tables' },
        { title: 'Tables List' }
      ]
    }
  }
];

