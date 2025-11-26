import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * API Base URL Interceptor
 * Prepends the base API URL to requests that don't already have a full URL
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = environment?.apiUrl;
  
  // Skip if request already has a full URL (http:// or https://)
  if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
    return next(req);
  }

  // Skip if request starts with /assets (for static assets)
  if (req.url.startsWith('/assets') || req.url.startsWith('assets')) {
    return next(req);
  }

  // Clone the request and prepend base URL
  const clonedRequest = req.clone({
    url: `${baseUrl}${req.url.startsWith('/') ? req.url : '/' + req.url}`
  });

  return next(clonedRequest);
};

