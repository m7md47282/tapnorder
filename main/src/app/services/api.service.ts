import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LocalStorageService } from './local-storage.service';
import { NotificationService } from './notification.service';

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
    private notification: NotificationService
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
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
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
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body, {
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
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body, {
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
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body, {
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
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, {
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
}

