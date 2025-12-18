import { User } from './user.model';

export type PlaceStatus = 'active' | 'inactive' | 'suspended' | 'pending_approval';

export interface Coordinates {
  latitude?: number;
  longitude?: number;
}

export interface PlaceAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: Coordinates;
}

export interface PlaceContact {
  phone: string;
  email: string;
  website?: string;
}

export interface BusinessHours {
  open: string; // HH:mm (24-hour)
  close: string; // HH:mm (24-hour)
  isOpen: boolean;
}

export type BusinessHoursMap = Record<string, BusinessHours>;

export interface PlaceSettings {
  currency?: string;
  timezone?: string;
  language?: string;
  allowOnlineOrders?: boolean;
  requireOrderConfirmation?: boolean;
  minimumOrderAmount?: number;
  deliveryFee?: number;
  serviceFee?: number;
  taxRate?: number;
}

export interface PlaceBranch {
  id: string;
  placeId: string;
  name: string;
  description?: string;
  code?: string;
  address: PlaceAddress;
  contact: PlaceContact;
  businessHours?: BusinessHoursMap;
  settings?: PlaceSettings;
  status: PlaceStatus;
  menuUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Place {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  address: PlaceAddress;
  contact: PlaceContact;
  businessHours?: BusinessHoursMap;
  settings?: PlaceSettings;
  status: PlaceStatus;
  ownerId: string;
  owner?: Partial<User>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePlaceRequest {
  name: string;
  description?: string;
  address: PlaceAddress;
  contact: PlaceContact;
  businessHours?: BusinessHoursMap;
  settings?: PlaceSettings;
  ownerId: string;
}

export interface CreateBranchRequest {
  placeId: string;
  name: string;
  description?: string;
  address: PlaceAddress;
  contact: PlaceContact;
  businessHours?: BusinessHoursMap;
  settings?: PlaceSettings;
}

