import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LocalStorageService } from './local-storage.service';
import { NotificationService } from './notification.service';
import { TenantContextService } from './tenant-context.service';
import { User, UserRole } from '../models/user.model';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl: string;

  constructor(
    private http: HttpClient,
    private localStorage: LocalStorageService,
    private notification: NotificationService,
    private tenantContext: TenantContextService
  ) {
    // Set base URL from environment or use default
    this.baseUrl = environment?.apiUrl || 'http://localhost:3000/api';
  }

  /**
   * Get default headers with authorization
   */
  private getHeaders(includeAuth: boolean = true): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    if (includeAuth) {
      const token = this.localStorage.getToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  /**
   * Handle HTTP errors
   * Note: Error notifications are handled by error.interceptor.ts
   * This method just extracts and formats error messages for rethrowing
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    // Extract error message from various possible structures
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else if (error.error) {
      // Server-side error - try multiple possible error message locations
      errorMessage = error.error.message || 
                     error.error.error || 
                     error.error.errors?.[0] ||
                     (typeof error.error === 'string' ? error.error : null) ||
                     error.message ||
                     `Error Code: ${error.status}`;
    } else {
      errorMessage = error.message || `Error Code: ${error.status}`;
    }

    // Attach the original error for debugging
    const enhancedError = new Error(errorMessage);
    (enhancedError as any).originalError = error;
    (enhancedError as any).status = error.status;
    
    return throwError(() => enhancedError);
  }

  /**
   * GET request
   */
  get<T>(endpoint: string, params?: any, includeAuth: boolean = true): Observable<T> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value === null || value === undefined) {
          return;
        }
        if (Array.isArray(value)) {
          httpParams = httpParams.set(key, value.join(','));
        } else {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    const scopedPlaceId = this.resolveScopedPlaceId(includeAuth);
    if (scopedPlaceId) {
      const placeParamName = this.getPlaceParamName(endpoint);
      if (!this.httpParamsHasKey(httpParams, placeParamName)) {
        httpParams = httpParams.set(placeParamName, scopedPlaceId);
      }
    }

    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(includeAuth),
      params: httpParams
    }).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct data responses
        if (response && typeof response === 'object') {
          // If response has 'data' property and 'success' property, it's wrapped
          if ('data' in response && 'success' in response) {
            return (response as ApiResponse<T>).data || response as any;
          }
          // Otherwise, return response as-is
          return response as any;
        }
        return response as any;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, body: any, includeAuth: boolean = true): Observable<T> {
    const scopedPlaceId = this.resolveScopedPlaceId(includeAuth);
    const nextBody = this.maybeAttachPlaceToBody(endpoint, body, scopedPlaceId);
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, nextBody, {
      headers: this.getHeaders(includeAuth)
    }).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct data responses
        if (response && typeof response === 'object') {
          // If response has 'data' property and 'success' property, it's wrapped
          if ('data' in response && 'success' in response) {
            return (response as ApiResponse<T>).data || response as any;
          }
          // Otherwise, return response as-is
          return response as any;
        }
        return response as any;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, body: any, includeAuth: boolean = true): Observable<T> {
    const scopedPlaceId = this.resolveScopedPlaceId(includeAuth);
    const nextBody = this.maybeAttachPlaceToBody(endpoint, body, scopedPlaceId);
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, nextBody, {
      headers: this.getHeaders(includeAuth)
    }).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct data responses
        if (response && typeof response === 'object') {
          if ('data' in response && 'success' in response) {
            return (response as ApiResponse<T>).data || response as any;
          }
          return response as any;
        }
        return response as any;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, body: any, includeAuth: boolean = true): Observable<T> {
    const scopedPlaceId = this.resolveScopedPlaceId(includeAuth);
    const nextBody = this.maybeAttachPlaceToBody(endpoint, body, scopedPlaceId);
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, nextBody, {
      headers: this.getHeaders(includeAuth)
    }).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct data responses
        if (response && typeof response === 'object') {
          if ('data' in response && 'success' in response) {
            return (response as ApiResponse<T>).data || response as any;
          }
          return response as any;
        }
        return response as any;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string, includeAuth: boolean = true): Observable<T> {
    const scopedPlaceId = this.resolveScopedPlaceId(includeAuth);
    const placeParamName = this.getPlaceParamName(endpoint);
    const endpointWithTenant = this.appendTenantToEndpoint(endpoint, placeParamName, scopedPlaceId);

    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${endpointWithTenant}`, {
      headers: this.getHeaders(includeAuth)
    }).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct data responses
        if (response && typeof response === 'object') {
          if ('data' in response && 'success' in response) {
            return (response as ApiResponse<T>).data || response as any;
          }
          return response as any;
        }
        return response as any;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Upload file
   */
  uploadFile<T>(endpoint: string, file: File, additionalData?: any): Observable<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }

    const headers = new HttpHeaders();
    const token = this.localStorage.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const scopedPlaceId = this.resolveScopedPlaceId(true);
    if (scopedPlaceId) {
      formData.append('placeId', scopedPlaceId);
    }

    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, formData, {
      headers
    }).pipe(
      map(response => {
        // Handle both wrapped ApiResponse and direct data responses
        if (response && typeof response === 'object') {
          if ('data' in response && 'success' in response) {
            return (response as ApiResponse<T>).data || response as any;
          }
          return response as any;
        }
        return response as any;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Upload attachment (base64 encoded file)
   * POST /attachments
   * 
   * @param request - Upload attachment request with base64 encoded file
   * @returns Observable<Attachment>
   */
  uploadAttachment(request: {
    file: string; // Base64 encoded file content or data URL
    fileName: string;
    mimeType: string;
    uploadedBy?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    folder?: string;
    metadata?: Record<string, any>;
  }): Observable<any> {
    return this.post<any>('/attachments', request);
  }

  private resolveScopedPlaceId(includeAuth: boolean): string | null {
    if (!includeAuth) {
      return null;
    }
    const user = this.localStorage.getUser<User>();
    if (!user) {
      return null;
    }

    const contextPlaceId = this.tenantContext.getCurrentPlaceId();
    const effectivePlaceId = contextPlaceId || user.placeId || null;

    if (!effectivePlaceId) {
      return null;
    }

    if (user.role === UserRole.SUPER_ADMIN && !contextPlaceId) {
      // Super admins can operate across places unless they explicitly select one
      return null;
    }

    return effectivePlaceId;
  }

  private getPlaceParamName(endpoint: string): string {
    if (/\/orders/i.test(endpoint) || /orderDetail/i.test(endpoint)) {
      return 'place_id';
    }
    return 'placeId';
  }

  private httpParamsHasKey(params: HttpParams, key: string): boolean {
    return params.keys().includes(key);
  }

  private maybeAttachPlaceToBody(endpoint: string, body: any, placeId: string | null) {
    if (!placeId || !body || typeof body !== 'object' || Array.isArray(body) || body instanceof FormData) {
      return body;
    }

    const hasPlaceId = Object.prototype.hasOwnProperty.call(body, 'placeId');
    const hasSnakeCase = Object.prototype.hasOwnProperty.call(body, 'place_id');

    if (hasPlaceId || hasSnakeCase) {
      return body;
    }

    return {
      ...body,
      placeId
    };
  }

  private appendTenantToEndpoint(endpoint: string, paramName: string, placeId: string | null): string {
    if (!placeId) {
      return endpoint;
    }

    const regex = new RegExp(`[?&]${paramName}=`);
    if (regex.test(endpoint)) {
      return endpoint;
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}${paramName}=${encodeURIComponent(placeId)}`;
  }
}

