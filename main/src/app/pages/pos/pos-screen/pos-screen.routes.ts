import { Routes } from '@angular/router';
import { PosScreenComponent } from './pos-screen.component';

export const PosScreenRoutes: Routes = [
  {
    path: '',
    component: PosScreenComponent,
    data: {
      title: 'Point of Sale',
      urls: [
        { title: 'POS', url: '/pos' },
        { title: 'POS Screen' }
      ]
    }
  }
];

