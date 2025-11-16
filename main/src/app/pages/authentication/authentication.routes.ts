import { Routes } from '@angular/router';
import { guestGuard } from '../../guards/guest.guard';

import { AppSideLoginComponent } from './side-login/side-login.component';
import { AppSideRegisterComponent } from './side-register/side-register.component';

export const AuthenticationRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'login',
        component: AppSideLoginComponent,
        canActivate: [guestGuard],
      },
      {
        path: 'register',
        component: AppSideRegisterComponent,
        canActivate: [guestGuard],
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },
];
