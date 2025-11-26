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

  ADMIN = 'ADMIN',
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
  email: string; // Backend uses email, not username
  password: string;
  roleId?: number; // Optional role identifier override
  deviceInfo?: any; // Optional metadata about the device
  metadata?: any; // Additional metadata to persist with the user session
}

// Backend API response structure
export interface AuthSuccessResponse {
  success: boolean;
  data: {
    user: UserProfile;
    identityProfile?: any;
    expiresAt?: string;
    token: string; // Session token (Firebase ID token)
    refreshToken?: string | null; // Refresh token for renewing the session
  };
  message?: string;
}

// Backend UserProfile structure
export interface UserProfile {
  id: string;
  firebaseUid?: string;
  email: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  displayName?: string;
  photoUrl?: string;
  roleId: number; // Numeric role ID
  role?: number; // Enum representing the user role ID (same as roleId)
  status?: 'active' | 'invited' | 'suspended' | 'disabled';
  lastLoginAt?: string;
  lastLoginIp?: string;
  tenantId?: string | null;
  customClaims?: any;
  preferences?: any;
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

// Frontend LoginResponse (converted from backend response)
export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string; // Display name for the user
  roleId?: number; // Optional role identifier (numeric ID)
  roleKey?: string; // Optional role name (e.g., "ADMIN", "CASHIER") - alternative to roleId
  firstName?: string; // For compatibility
  lastName?: string; // For compatibility
  username?: string; // For compatibility - maps to displayName
  preferences?: any; // Custom user preferences
  places?: string[]; // Optional list of place IDs to associate with the user
  deviceInfo?: any; // Optional metadata about the device
  metadata?: any; // Additional metadata
}

