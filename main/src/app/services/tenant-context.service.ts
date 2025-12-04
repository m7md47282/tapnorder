import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, UserRole } from '../models/user.model';

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

  currentPlaceId$ = this.currentPlaceIdSubject.asObservable();
  accessiblePlaceIds$ = this.accessiblePlaceIdsSubject.asObservable();
  canOverridePlace$ = this.allowOverrideSubject.asObservable();

  initializeFromUser(user: User | null): void {
    if (!user) {
      this.reset();
      return;
    }

    const accessiblePlaces = Array.isArray(user.accessiblePlaceIds)
      ? user.accessiblePlaceIds.filter(Boolean)
      : [];
    const primaryPlace = user.placeId ?? accessiblePlaces[0] ?? null;

    this.currentPlaceIdSubject.next(primaryPlace);
    this.accessiblePlaceIdsSubject.next(accessiblePlaces);
    this.allowOverrideSubject.next(user.role === UserRole.SUPER_ADMIN || accessiblePlaces.length > 1);
  }

  setPlaceId(placeId: string | null): void {
    if (placeId === this.currentPlaceIdSubject.value) {
      return;
    }
    this.currentPlaceIdSubject.next(placeId);
  }

  getCurrentPlaceId(): string | null {
    return this.currentPlaceIdSubject.value;
  }

  reset(): void {
    this.currentPlaceIdSubject.next(null);
    this.accessiblePlaceIdsSubject.next([]);
    this.allowOverrideSubject.next(false);
  }
}


