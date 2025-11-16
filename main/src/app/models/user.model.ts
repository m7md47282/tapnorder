export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  permissions?: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export enum UserRole {
  // Admin
  SUPER_ADMIN = 'SUPER_ADMIN',
  
  // Management
  RESTAURANT_MANAGER = 'RESTAURANT_MANAGER', // Renamed from STORE_MANAGER
  SHIFT_MANAGER = 'SHIFT_MANAGER',
  
  // Front of House
  WAITER = 'WAITER',
  CASHIER = 'CASHIER',
  HOST = 'HOST',
  
  // Back of House
  CHEF = 'CHEF',
  BARTENDER = 'BARTENDER',
  
  // Delivery
  DELIVERY_DRIVER = 'DELIVERY_DRIVER',
  
  // Support
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  SALES_STAFF = 'SALES_STAFF', // Optional - for marketing
  
  // Legacy (for backward compatibility)
  STORE_MANAGER = 'STORE_MANAGER' // Maps to RESTAURANT_MANAGER
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
  expiresIn: number;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

