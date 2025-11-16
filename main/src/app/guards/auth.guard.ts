import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { UserRole } from '../models/user.model';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notification = inject(NotificationService);

  if (authService.isAuthenticated()) {
    // If chef tries to access root or dashboard, redirect to kitchen
    // If cashier tries to access root or dashboard, redirect to POS
    const user = authService.getCurrentUser();
    if (user?.role === UserRole.CHEF && (state.url === '/' || state.url === '/dashboard')) {
      router.navigate(['/kitchen']);
      return false;
    }
    if (user?.role === UserRole.CASHIER && (state.url === '/' || state.url === '/dashboard')) {
      router.navigate(['/pos']);
      return false;
    }
    return true;
  }

  // Store the attempted URL for redirecting after login
  const returnUrl = state.url;
  router.navigate(['/authentication/login'], { queryParams: { returnUrl } });
  notification.warning('Please login to access this page');
  
  return false;
};

