import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  private readonly TOKEN_KEY = 'pos_access_token';
  private readonly REFRESH_TOKEN_KEY = 'pos_refresh_token';
  private readonly USER_KEY = 'pos_user';
  private readonly REMEMBER_ME_KEY = 'pos_remember_me';

  constructor() {
    // Check if localStorage is available
    if (typeof Storage === 'undefined') {
      console.warn('LocalStorage is not available');
    }
  }

  /**
   * Set a value in localStorage
   */
  setItem(key: string, value: any): void {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, stringValue);
    } catch (error) {
      console.error('Error saving to localStorage', error);
    }
  }

  /**
   * Get a value from localStorage
   */
  getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return null;
      }
      try {
        return JSON.parse(item) as T;
      } catch {
        return item as T;
      }
    } catch (error) {
      console.error('Error reading from localStorage', error);
      return null;
    }
  }

  /**
   * Remove a value from localStorage
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage', error);
    }
  }

  /**
   * Clear all localStorage
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage', error);
    }
  }

  /**
   * Check if a key exists in localStorage
   */
  hasItem(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }

  // Token management methods
  setToken(token: string): void {
    this.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return this.getItem<string>(this.TOKEN_KEY);
  }

  removeToken(): void {
    this.removeItem(this.TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    this.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    return this.getItem<string>(this.REFRESH_TOKEN_KEY);
  }

  removeRefreshToken(): void {
    this.removeItem(this.REFRESH_TOKEN_KEY);
  }

  // User management methods
  setUser(user: any): void {
    this.setItem(this.USER_KEY, user);
  }

  getUser<T>(): T | null {
    return this.getItem<T>(this.USER_KEY);
  }

  removeUser(): void {
    this.removeItem(this.USER_KEY);
  }

  // Remember me
  setRememberMe(value: boolean): void {
    this.setItem(this.REMEMBER_ME_KEY, value);
  }

  getRememberMe(): boolean {
    return this.getItem<boolean>(this.REMEMBER_ME_KEY) ?? false;
  }

  // Clear all auth data
  clearAuthData(): void {
    this.removeToken();
    this.removeRefreshToken();
    this.removeUser();
  }
}

