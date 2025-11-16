import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';
import { NotificationService } from '../services/notification.service';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const notification = inject(NotificationService);

    if (!authService.isAuthenticated()) {
      const returnUrl = state.url;
      router.navigate(['/authentication/login'], { queryParams: { returnUrl } });
      notification.warning('Please login to access this page');
      return false;
    }

    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    notification.error('You do not have permission to access this page');
    router.navigate(['/dashboard']);
    return false;
  };
};

