import { Routes } from '@angular/router';
import { GuestMenuComponent } from './guest-menu.component';

export const GuestMenuRoutes: Routes = [
  {
    path: '',
    component: GuestMenuComponent,
    data: {
      title: 'Menu',
      urls: [
        { title: 'Menu', url: '/menu' }
      ]
    }
  }
];

