import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { tap, catchError, map, delay } from 'rxjs/operators';
import { 
  User, 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  UserRole, 
  AuthSuccessResponse, 
  UserProfile 
} from '../models/user.model';
import { ApiService } from './api.service';
import { LocalStorageService } from './local-storage.service';
import { NotificationService } from './notification.service';
import { environment } from '../../environments/environment';
import { getRoleFromId } from '../utils/role-ids.util';
import { TenantContextService } from './tenant-context.service';

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
    private notification: NotificationService,
    private tenantContext: TenantContextService
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
      this.tenantContext.initializeFromUser(user);
    } else {
      this.clearAuth();
    }
  }

  /**
   * Login user
   */
  login(credentials: LoginRequest, rememberMe: boolean = false): Observable<LoginResponse> {
  

    const loginRequest: LoginRequest = {
      email: credentials.email,
      password: credentials.password,
    };

    // Real API call to backend
    return this.api.post<any>('/login', loginRequest, false).pipe(
      map(response => {
        // API service already unwraps response.data, so response should be the data object
        // But handle both cases: wrapped and unwrapped
        let authData: any;
        
        if (response && typeof response === 'object') {
          // Check if it's still wrapped (has success and data properties)
          if ('success' in response && 'data' in response && response.data) {
            authData = response.data;
          } 
          // Check if it's the direct data structure (has user and token)
          else if ('user' in response && 'token' in response) {
            authData = response;
          }
          // Otherwise, assume response is the data object
          else {
            authData = response;
          }
        } else {
          throw new Error('Invalid response format from server');
        }

        // Validate required fields
        if (!authData.user) {
          throw new Error('User data not found in response');
        }
        if (!authData.token) {
          throw new Error('Token not found in response');
        }

        // Convert to AuthSuccessResponse format for processing
        const authResponse: AuthSuccessResponse = {
          success: true,
          data: {
            user: authData.user,
            token: authData.token,
            refreshToken: authData.refreshToken,
            expiresAt: authData.expiresAt,
            identityProfile: authData.identityProfile
          }
        };
        
        return this.convertAuthResponseToLoginResponse(authResponse);
      }),
      tap(response => {
        this.setAuthData(response, rememberMe);
        this.notification.success('Login successful!');
      }),
      catchError(error => {
        // Error is already handled by error interceptor, just rethrow
        // Extract message for logging/debugging
        const errorMessage = error?.message || error?.error?.message || 'Login failed';
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
        // Mock credentials - supports both email and username for backward compatibility
        const emailOrUsername = credentials.email || (credentials as any).username || '';
        const password = credentials.password;
        
        const validCredentials = [
          { email: 'admin@example.com', username: 'admin', password: 'admin123', role: UserRole.SUPER_ADMIN },
          { email: 'admin2@example.com', username: 'admin2', password: 'admin123', role: UserRole.ADMIN },
          { email: 'manager@example.com', username: 'manager', password: 'manager123', role: UserRole.RESTAURANT_MANAGER },
          { email: 'shiftmanager@example.com', username: 'shiftmanager', password: 'shift123', role: UserRole.SHIFT_MANAGER },
          { email: 'waiter@example.com', username: 'waiter', password: 'waiter123', role: UserRole.WAITER },
          { email: 'cashier@example.com', username: 'cashier', password: 'cashier123', role: UserRole.CASHIER },
          { email: 'host@example.com', username: 'host', password: 'host123', role: UserRole.HOST },
          { email: 'chef@example.com', username: 'chef', password: 'chef123', role: UserRole.CHEF },
          { email: 'bartender@example.com', username: 'bartender', password: 'bar123', role: UserRole.BARTENDER },
          { email: 'driver@example.com', username: 'driver', password: 'driver123', role: UserRole.DELIVERY_DRIVER },
          { email: 'inventory@example.com', username: 'inventory', password: 'inv123', role: UserRole.INVENTORY_MANAGER },
          { email: 'accountant@example.com', username: 'accountant', password: 'acc123', role: UserRole.ACCOUNTANT },
          { email: 'storemanager@example.com', username: 'storemanager', password: 'store123', role: UserRole.STORE_MANAGER },
        ];

        const validUser = validCredentials.find(
          c => (c.email === emailOrUsername || c.username === emailOrUsername) && c.password === password
        );

        if (!validUser) {
          throw new Error('Invalid email/username or password');
        }

        // Generate mock token
        const mockToken = 'mock_jwt_token_' + Date.now();
        
        const mockUser: User = {
          id: '1',
          username: validUser.username,
          email: validUser.email,
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
  register(data: RegisterRequest): Observable<LoginResponse> {
    // Prepare signup request for backend
    const signupRequest: any = {
      email: data.email,
      password: data.password,
    };

    // Add displayName (from firstName/lastName or username for compatibility)
    if (data.displayName) {
      signupRequest.displayName = data.displayName;
    } else if (data.firstName || data.lastName) {
      signupRequest.displayName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    } else if (data.username) {
      signupRequest.displayName = data.username;
    }

    // Add role information (prefer roleId, fallback to roleKey)
    if (data.roleId) {
      signupRequest.roleId = data.roleId;
    } else if (data.roleKey) {
      signupRequest.roleKey = data.roleKey;
    }

    // Add optional fields
    if (data.preferences) {
      signupRequest.preferences = data.preferences;
    }
    if (data.places && data.places.length > 0) {
      signupRequest.places = data.places;
    }
    if (data.deviceInfo) {
      signupRequest.deviceInfo = data.deviceInfo;
    }
    if (data.metadata) {
      signupRequest.metadata = data.metadata;
    }

    // Real API call to backend
    return this.api.post<any>('/signup', signupRequest, false).pipe(
      map(response => {
        // API service already unwraps response.data, so response should be the data object
        // But handle both cases: wrapped and unwrapped
        let authData: any;
        
        if (response && typeof response === 'object') {
          // Check if it's still wrapped (has success and data properties)
          if ('success' in response && 'data' in response && response.data) {
            authData = response.data;
          } 
          // Check if it's the direct data structure (has user and token)
          else if ('user' in response && 'token' in response) {
            authData = response;
          }
          // Otherwise, assume response is the data object
          else {
            authData = response;
          }
        } else {
          throw new Error('Invalid response format from server');
        }

        // Validate required fields
        if (!authData.user) {
          throw new Error('User data not found in response');
        }
        if (!authData.token) {
          throw new Error('Token not found in response');
        }

        // Convert to AuthSuccessResponse format for processing
        const authResponse: AuthSuccessResponse = {
          success: true,
          data: {
            user: authData.user,
            token: authData.token,
            refreshToken: authData.refreshToken,
            expiresAt: authData.expiresAt,
            identityProfile: authData.identityProfile
          }
        };
        
        const loginResponse = this.convertAuthResponseToLoginResponse(authResponse);
        // Auto-login after successful registration
        this.setAuthData(loginResponse, false);
        return loginResponse;
      }),
      tap(() => {
        this.notification.success('Registration successful! You are now logged in.');
      }),
      catchError(error => {
        // Error is already handled by error interceptor, just rethrow
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
    this.tenantContext.initializeFromUser(response.user);
  }

  /**
   * Clear authentication data
   */
  private clearAuth(): void {
    this.localStorage.clearAuthData();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.tenantContext.reset();
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
   * Note: Backend may use Firebase token refresh - check your backend implementation
   */
  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.localStorage.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    // Backend refresh endpoint (adjust if your backend uses a different endpoint)
    return this.api.post<AuthSuccessResponse>('/auth/refresh', { refreshToken }, false).pipe(
      map(response => this.convertAuthResponseToLoginResponse(response)),
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
    this.tenantContext.initializeFromUser(user);
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

  /**
   * Convert backend AuthSuccessResponse to frontend LoginResponse
   */
  private convertAuthResponseToLoginResponse(response: AuthSuccessResponse): LoginResponse {
    // Ensure we have the data object
    const data = response.data || response as any;
    const userProfile = data.user;
    
    if (!userProfile) {
      throw new Error('Invalid response: user profile not found');
    }
    
    // Prioritize roleId over role - use nullish coalescing to only fallback if roleId is null/undefined
    const roleId = userProfile.roleId ?? userProfile.role ?? 0;
    const role = getRoleFromId(roleId) || UserRole.WAITER; // Default to WAITER if role not found

    // Convert UserProfile to User model
    const placeContext = this.extractPlaceContext(userProfile);

    const user: User = {
      id: userProfile.id,
      username: userProfile.displayName || userProfile.email?.split('@')[0] || 'user',
      email: userProfile.email,
      firstName: userProfile.displayName?.split(' ')[0],
      lastName: userProfile.displayName?.split(' ').slice(1).join(' ') || '',
      role: role,
      permissions: userProfile.customClaims?.permissions || [],
      isActive: userProfile.status === 'active' || userProfile.status === undefined,
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
      placeId: placeContext.placeId,
      accessiblePlaceIds: placeContext.accessiblePlaceIds,
    };

    // Calculate expiresIn from expiresAt if available
    let expiresIn = 3600; // Default 1 hour
    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt).getTime();
      const now = Date.now();
      expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));
    }

    return {
      accessToken: data.token || (data as any).accessToken,
      refreshToken: data.refreshToken || undefined,
      user: user,
      expiresIn: expiresIn,
    };
  }

  /**
   * Get current user profile from backend
   */
  getCurrentUserProfile(): Observable<User> {
    return this.api.get<UserProfile>('/login', {}, true).pipe(
      map(userProfile => {
        // Prioritize roleId over role - use nullish coalescing to only fallback if roleId is null/undefined
        const roleId = userProfile.roleId ?? userProfile.role ?? 0;
        const role = getRoleFromId(roleId) ?? UserRole.WAITER;

        const placeContext = this.extractPlaceContext(userProfile);

        const user: User = {
          id: userProfile.id,
          username: userProfile.displayName || userProfile.email.split('@')[0],
          email: userProfile.email,
          firstName: userProfile.displayName?.split(' ')[0],
          lastName: userProfile.displayName?.split(' ').slice(1).join(' '),
          role: role,
          permissions: userProfile.customClaims?.permissions || [],
          isActive: userProfile.status === 'active' || userProfile.status === undefined,
          createdAt: userProfile.createdAt,
          updatedAt: userProfile.updatedAt,
          placeId: placeContext.placeId,
          accessiblePlaceIds: placeContext.accessiblePlaceIds,
        };

        // Update local user data
        this.updateCurrentUser(user);
        return user;
      }),
      catchError(error => {
        // If getting profile fails, user might be logged out
        this.clearAuth();
        return throwError(() => error);
      })
    );
  }

  /**
   * Extract place context (primary + accessible place IDs) from backend profile
   */
  private extractPlaceContext(profile: UserProfile): { placeId: string | null; accessiblePlaceIds: string[] } {
    const metadata = profile.metadata || {};
    const customClaims = profile.customClaims || {};

    const accessibleSources = [
      (profile as any).placeIds,
      metadata.placeIds,
      metadata.accessiblePlaceIds,
      metadata.places,
      profile.preferences?.placeIds,
      profile.preferences?.places,
      metadata.allowedPlaceIds,
      customClaims.placeIds
    ];

    const accessiblePlaceIds = accessibleSources
      .flat()
      .filter((value: any): value is string => typeof value === 'string' && value.length > 0);

    const directPlace =
      (profile as any).placeId ||
      metadata.placeId ||
      metadata.place_id ||
      metadata.place?.id ||
      customClaims.placeId ||
      (accessiblePlaceIds.length === 1 ? accessiblePlaceIds[0] : null);

    return {
      placeId: directPlace ?? null,
      accessiblePlaceIds
    };
  }
}

