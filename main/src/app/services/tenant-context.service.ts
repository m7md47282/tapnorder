import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, UserRole } from '../models/user.model';
import { Place } from '../models/place.model';
import { LocalStorageService } from './local-storage.service';

/**
 * Tracks the active tenant (place) context for authenticated users.
 * Guests bypass this service since they provide placeId via URL params.
 */
@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  private currentPlaceIdSubject = new BehaviorSubject<string | null>(null);
  private accessiblePlaceIdsSubject = new BehaviorSubject<string[]>([]);
  private allowOverrideSubject = new BehaviorSubject<boolean>(false);
  private currentPlaceSubject = new BehaviorSubject<Place | null>(null);

  currentPlaceId$ = this.currentPlaceIdSubject.asObservable();
  accessiblePlaceIds$ = this.accessiblePlaceIdsSubject.asObservable();
  canOverridePlace$ = this.allowOverrideSubject.asObservable();
  currentPlace$ = this.currentPlaceSubject.asObservable();

  constructor(private localStorage: LocalStorageService) {
    // Load tenant data from localStorage on service initialization
    this.loadFromLocalStorage();
  }

  initializeFromUser(user: User | null): void {
    if (!user) {
      this.reset();
      return;
    }

    const accessiblePlaces = Array.isArray(user.accessiblePlaceIds)
      ? user.accessiblePlaceIds.filter(Boolean)
      : [];
    const primaryPlace = user.placeId ?? accessiblePlaces[0] ?? null;

    this.setPlaceId(primaryPlace);
    this.setAccessiblePlaceIds(accessiblePlaces);
    this.setAllowOverride(user.role === UserRole.SUPER_ADMIN || accessiblePlaces.length > 1);
  }

  setPlaceId(placeId: string | null): void {
    if (placeId === this.currentPlaceIdSubject.value) {
      return;
    }
    this.currentPlaceIdSubject.next(placeId);
    this.localStorage.setCurrentPlaceId(placeId);
    // Save complete tenant state to localStorage
    this.saveTenantToLocalStorage();
  }

  getCurrentPlaceId(): string | null {
    const placeId = this.currentPlaceIdSubject.value;
    if (placeId) {
      return placeId;
    }
    // Fallback to localStorage if BehaviorSubject is null
    return this.localStorage.getCurrentPlaceId();
  }

  reset(): void {
    this.currentPlaceIdSubject.next(null);
    this.accessiblePlaceIdsSubject.next([]);
    this.allowOverrideSubject.next(false);
    this.currentPlaceSubject.next(null);
    this.localStorage.clearTenantData();
  }

  /**
   * Set the current place data (for currency, logo, etc.)
   */
  setPlace(place: Place | null): void {
    this.currentPlaceSubject.next(place);
    this.localStorage.setCurrentPlace(place);
    if (place?.id) {
      this.setPlaceId(place.id);
    } else if (place === null) {
      this.setPlaceId(null);
    }
    // Save complete tenant state to localStorage
    this.saveTenantToLocalStorage();
  }

  /**
   * Get current place data
   * Falls back to localStorage if BehaviorSubject is null
   */
  getCurrentPlace(): Place | null {
    const place = this.currentPlaceSubject.value;
    if (place) {
      return place;
    }
    // Fallback to localStorage if BehaviorSubject is null
    return this.localStorage.getCurrentPlace<Place>();
  }

  /**
   * Get current currency from place settings
   */
  getCurrentCurrency(): string {
    const place = this.getCurrentPlace();
    return place?.settings?.currency || 'USD';
  }

  /**
   * Get current place logo
   */
  getCurrentLogo(): string | null {
    const place = this.getCurrentPlace();
    return place?.logoUrl || null;
  }

  /**
   * Get current place name
   */
  getCurrentPlaceName(): string {
    const place = this.getCurrentPlace();
    return place?.name || 'Restaurant';
  }

  /**
   * Set accessible place IDs
   */
  private setAccessiblePlaceIds(placeIds: string[]): void {
    this.accessiblePlaceIdsSubject.next(placeIds);
    this.localStorage.setAccessiblePlaceIds(placeIds);
    // Save complete tenant state to localStorage
    this.saveTenantToLocalStorage();
  }

  /**
   * Get accessible place IDs
   */
  getAccessiblePlaceIds(): string[] {
    return this.accessiblePlaceIdsSubject.value;
  }

  /**
   * Set allow override flag
   */
  private setAllowOverride(allow: boolean): void {
    this.allowOverrideSubject.next(allow);
    this.localStorage.setAllowOverride(allow);
    // Save complete tenant state to localStorage
    this.saveTenantToLocalStorage();
  }

  /**
   * Get allow override flag
   */
  getAllowOverride(): boolean {
    return this.allowOverrideSubject.value;
  }

  /**
   * Save complete tenant state to localStorage
   */
  private saveTenantToLocalStorage(): void {
    this.localStorage.setCurrentPlaceId(this.currentPlaceIdSubject.value);
    this.localStorage.setAccessiblePlaceIds(this.accessiblePlaceIdsSubject.value);
    this.localStorage.setAllowOverride(this.allowOverrideSubject.value);
    this.localStorage.setCurrentPlace(this.currentPlaceSubject.value);
  }

  /**
   * Load tenant data from localStorage
   */
  private loadFromLocalStorage(): void {
    const placeId = this.localStorage.getCurrentPlaceId();
    const accessiblePlaceIds = this.localStorage.getAccessiblePlaceIds();
    const allowOverride = this.localStorage.getAllowOverride();
    const place = this.localStorage.getCurrentPlace<Place>();

    if (placeId !== null) {
      this.currentPlaceIdSubject.next(placeId);
    }
    if (accessiblePlaceIds.length > 0) {
      this.accessiblePlaceIdsSubject.next(accessiblePlaceIds);
    }
    if (allowOverride) {
      this.allowOverrideSubject.next(allowOverride);
    }
    if (place !== null) {
      this.currentPlaceSubject.next(place);
    }
  }
}


