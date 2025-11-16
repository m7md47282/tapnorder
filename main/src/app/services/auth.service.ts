import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { tap, catchError, map, delay } from 'rxjs/operators';
import { User, LoginRequest, LoginResponse, RegisterRequest, UserRole } from '../models/user.model';
import { ApiService } from './api.service';
import { LocalStorageService } from './local-storage.service';
import { NotificationService } from './notification.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private api: ApiService,
    private localStorage: LocalStorageService,
    private router: Router,
    private notification: NotificationService
  ) {
    this.initializeAuth();
  }

  /**
   * Initialize authentication state from localStorage
   */
  private initializeAuth(): void {
    const token = this.localStorage.getToken();
    const user = this.localStorage.getUser<User>();

    if (token && user) {
      // Verify token is still valid (you might want to add token expiration check)
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
    } else {
      this.clearAuth();
    }
  }

  /**
   * Login user
   */
  login(credentials: LoginRequest, rememberMe: boolean = false): Observable<LoginResponse> {
    // Mock authentication for development/testing
    if (environment.useMockAuth) {
      return this.mockLogin(credentials, rememberMe);
    }

    // Real API call
    return this.api.post<LoginResponse>('/auth/login', credentials, false).pipe(
      tap(response => {
        this.setAuthData(response, rememberMe);
        this.notification.success('Login successful!');
      }),
      catchError(error => {
        this.notification.error(error.message || 'Login failed');
        return throwError(() => error);
      })
    );
  }

  /**
   * Mock login for development/testing (remove in production)
   */
  private mockLogin(credentials: LoginRequest, rememberMe: boolean): Observable<LoginResponse> {
    // Simulate API delay
    return of(null).pipe(
      delay(500),
      map(() => {
        // Mock credentials - change these for testing
        const validCredentials = [
          { username: 'admin', password: 'admin123', role: UserRole.SUPER_ADMIN },
          { username: 'manager', password: 'manager123', role: UserRole.RESTAURANT_MANAGER },
          { username: 'shiftmanager', password: 'shift123', role: UserRole.SHIFT_MANAGER },
          { username: 'waiter', password: 'waiter123', role: UserRole.WAITER },
          { username: 'cashier', password: 'cashier123', role: UserRole.CASHIER },
          { username: 'host', password: 'host123', role: UserRole.HOST },
          { username: 'chef', password: 'chef123', role: UserRole.CHEF },
          { username: 'bartender', password: 'bar123', role: UserRole.BARTENDER },
          { username: 'driver', password: 'driver123', role: UserRole.DELIVERY_DRIVER },
          { username: 'inventory', password: 'inv123', role: UserRole.INVENTORY_MANAGER },
          { username: 'accountant', password: 'acc123', role: UserRole.ACCOUNTANT },
          // Legacy support
          { username: 'storemanager', password: 'store123', role: UserRole.STORE_MANAGER },
        ];

        const validUser = validCredentials.find(
          c => c.username === credentials.username && c.password === credentials.password
        );

        if (!validUser) {
          throw new Error('Invalid username or password');
        }

        // Generate mock token
        const mockToken = 'mock_jwt_token_' + Date.now();
        
        const mockUser: User = {
          id: '1',
          username: validUser.username,
          email: `${validUser.username}@example.com`,
          firstName: validUser.username.charAt(0).toUpperCase() + validUser.username.slice(1),
          lastName: 'User',
          role: validUser.role,
          permissions: validUser.role === UserRole.SUPER_ADMIN ? ['*'] : [],
          isActive: true,
        };

        const response: LoginResponse = {
          accessToken: mockToken,
          refreshToken: 'mock_refresh_token',
          user: mockUser,
          expiresIn: 3600,
        };

        this.setAuthData(response, rememberMe);
        this.notification.success('Login successful! (Mock Mode)');
        
        return response;
      }),
      catchError(error => {
        this.notification.error(error.message || 'Login failed');
        return throwError(() => error);
      })
    );
  }

  /**
   * Register new user
   */
  register(data: RegisterRequest): Observable<any> {
    return this.api.post('/auth/register', data, false).pipe(
      tap(() => {
        this.notification.success('Registration successful! Please login.');
      }),
      catchError(error => {
        this.notification.error(error.message || 'Registration failed');
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout user
   */
  logout(): void {
    // Skip API call if using mock auth
    if (environment.useMockAuth) {
      this.clearAuth();
      this.notification.success('Logged out successfully');
      this.router.navigate(['/authentication/login']);
      return;
    }

    // Call logout endpoint for real backend
    this.api.post('/auth/logout', {}, true).pipe(
      catchError(() => of(null)) // Continue logout even if API call fails
    ).subscribe(() => {
      this.clearAuth();
      this.notification.success('Logged out successfully');
      this.router.navigate(['/authentication/login']);
    });
  }

  /**
   * Set authentication data
   */
  private setAuthData(response: LoginResponse, rememberMe: boolean): void {
    this.localStorage.setToken(response.accessToken);
    this.localStorage.setUser(response.user);
    this.localStorage.setRememberMe(rememberMe);
    
    if (response.refreshToken) {
      this.localStorage.setRefreshToken(response.refreshToken);
    }

    this.currentUserSubject.next(response.user);
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Clear authentication data
   */
  private clearAuth(): void {
    this.localStorage.clearAuthData();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: UserRole | UserRole[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: UserRole[]): boolean {
    return this.hasRole(roles);
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    // Super admin has all permissions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    return user.permissions?.includes(permission) ?? false;
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Refresh token
   */
  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.localStorage.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.api.post<LoginResponse>('/auth/refresh', { refreshToken }, false).pipe(
      tap(response => {
        this.setAuthData(response, this.localStorage.getRememberMe());
      }),
      catchError(error => {
        this.clearAuth();
        this.router.navigate(['/authentication/login']);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update current user data
   */
  updateCurrentUser(user: User): void {
    this.localStorage.setUser(user);
    this.currentUserSubject.next(user);
  }

  /**
   * Check if token is expired (basic check, you might want to decode JWT)
   */
  isTokenExpired(): boolean {
    const token = this.localStorage.getToken();
    if (!token) return true;

    // Basic check - you should decode JWT and check exp claim
    // For now, we'll assume token is valid if it exists
    // In production, decode JWT and check expiration
    return false;
  }
}

