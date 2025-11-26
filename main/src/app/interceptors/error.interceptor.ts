import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LocalStorageService } from '../services/local-storage.service';
import { NotificationService } from '../services/notification.service';
import { Router } from '@angular/router';

/**
 * Error Interceptor
 * Handles HTTP errors globally and shows appropriate notifications
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const localStorage = inject(LocalStorageService);
  const notification = inject(NotificationService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unknown error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error (network error, CORS, etc.)
        errorMessage = error.error.message || 'Network error occurred';
      } else {
        // Server-side error - extract message from various possible structures
        if (error.error) {
          errorMessage = error.error.message || 
                        error.error.error || 
                        error.error.errors?.[0] ||
                        (typeof error.error === 'string' ? error.error : null) ||
                        error.message ||
                        `Error Code: ${error.status}`;
        } else {
          errorMessage = error.message || `Error Code: ${error.status}`;
        }

        // Handle specific status codes
        switch (error.status) {
          case 0:
            // Network error or CORS issue
            errorMessage = 'Unable to connect to server. Please check your connection.';
            break;
          case 400:
            // Keep extracted message or use default
            if (!error.error?.message && !error.error?.error) {
              errorMessage = 'Bad request';
            }
            break;
          case 401:
            errorMessage = 'Unauthorized. Please login again.';
            localStorage.clearAuthData();
            break;
          case 403:
            errorMessage = 'You do not have permission to perform this action.';
            break;
          case 404:
            if (!error.error?.message) {
              errorMessage = 'Resource not found.';
            }
            break;
          case 422:
            if (!error.error?.message) {
              errorMessage = 'Validation error';
            }
            break;
          case 500:
            if (!error.error?.message && !error.error?.error) {
              errorMessage = 'Internal server error. Please try again later.';
            }
            break;
          case 503:
            errorMessage = 'Service unavailable. Please try again later.';
            break;
        }
      }

      // Show notification for errors (except 401 which is handled by auth guard/component)
      if (error.status !== 401) {
        notification.error(errorMessage);
      }

      // Preserve the original error structure for better debugging
      const enhancedError = new Error(errorMessage);
      (enhancedError as any).originalError = error;
      (enhancedError as any).status = error.status;
      
      return throwError(() => enhancedError);
    })
  );
};

