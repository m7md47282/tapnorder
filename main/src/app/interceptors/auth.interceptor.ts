import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { LocalStorageService } from '../services/local-storage.service';

/**
 * Auth Interceptor
 * Automatically adds Authorization header and default headers to all HTTP requests
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const localStorage = inject(LocalStorageService);
  
  // Get token from localStorage
  const token = localStorage.getToken();
  
  // Prepare headers (only add if not already present)
  const headers: { [key: string]: string } = {};
  
  // Add default headers only if not already set
  if (!req.headers.has('Content-Type')) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (!req.headers.has('Accept')) {
    headers['Accept'] = 'application/json';
  }
  
  // Add authorization header if token exists and not already set
  if (token && !req.headers.has('Authorization')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Clone the request and add headers (only if we have headers to add)
  if (Object.keys(headers).length > 0) {
    const clonedRequest = req.clone({
      setHeaders: headers
    });
    return next(clonedRequest);
  }
  
  return next(req);
};

