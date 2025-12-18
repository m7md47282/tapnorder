import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { User, UserProfile, RegisterRequest, AdminCreateUserPayload } from '../models/user.model';
import { getRoleFromId } from '../utils/role-ids.util';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private api: ApiService) {}

  /**
   * Get list of users/staff
   * @param params Query parameters (placeId, role, status, etc.)
   */
  getUsers(params?: Record<string, any>): Observable<User[]> {
    return this.api.get<UserProfile[]>('/users', params).pipe(
      map(profiles => profiles.map(profile => this.convertProfileToUser(profile)))
    );
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): Observable<User> {
    return this.api.get<UserProfile>(`/users/${userId}`).pipe(
      map(profile => this.convertProfileToUser(profile))
    );
  }

  /**
   * Create a new staff account (admin only)
   */
  createUser(userData: AdminCreateUserPayload): Observable<User> {
    return this.api.post<any>('/users', userData).pipe(
      map(response => {
        // Response might be AuthSuccessResponse format
        const userProfile = response?.user || response?.data?.user || response;
        return this.convertProfileToUser(userProfile);
      })
    );
  }

  /**
   * Update user account
   */
  updateUser(userId: string, userData: Partial<AdminCreateUserPayload>): Observable<User> {
    return this.api.put<any>(`/users/${userId}`, userData).pipe(
      map(response => {
        const userProfile = response?.user || response?.data?.user || response;
        return this.convertProfileToUser(userProfile);
      })
    );
  }

  /**
   * Activate user account
   */
  activateUser(userId: string): Observable<User> {
    return this.api.put<any>(`/users/${userId}`, { isActive: true, status: 'active' }).pipe(
      map(response => {
        const userProfile = response?.user || response?.data?.user || response;
        return this.convertProfileToUser(userProfile);
      })
    );
  }

  /**
   * Deactivate user account
   */
  deactivateUser(userId: string): Observable<User> {
    return this.api.put<any>(`/users/${userId}`, { isActive: false, status: 'disabled' }).pipe(
      map(response => {
        const userProfile = response?.user || response?.data?.user || response;
        return this.convertProfileToUser(userProfile);
      })
    );
  }

  /**
   * Delete user account
   */
  deleteUser(userId: string): Observable<void> {
    return this.api.delete<void>(`/users/${userId}`);
  }

  /**
   * Convert UserProfile (backend format) to User (frontend format)
   */
  private convertProfileToUser(profile: UserProfile): User {
    const roleId = profile.roleId ?? profile.role ?? 0;
    const role = getRoleFromId(roleId) || (profile as any).role || 'WAITER';

    // Extract place context
    const metadata = profile.metadata || {};
    const customClaims = profile.customClaims || {};
    const accessibleSources = [
      (profile as any).placeIds,
      metadata.placeIds,
      metadata.accessiblePlaceIds,
      metadata.places,
      profile.preferences?.placeIds,
      profile.preferences?.places,
      metadata.allowedPlaceIds,
      customClaims.placeIds
    ];

    const accessiblePlaceIds = accessibleSources
      .flat()
      .filter((value: any): value is string => typeof value === 'string' && value.length > 0);

    const directPlace =
      (profile as any).placeId ||
      profile.placeId ||
      metadata.placeId ||
      metadata.place_id ||
      metadata.place?.id ||
      customClaims.placeId ||
      (accessiblePlaceIds.length === 1 ? accessiblePlaceIds[0] : null);

    return {
      id: profile.id,
      username: profile.displayName || profile.email?.split('@')[0] || 'user',
      email: profile.email,
      firstName: profile.displayName?.split(' ')[0] || '',
      lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
      role: role as any,
      permissions: profile.customClaims?.permissions || [],
      isActive: profile.status === 'active' || profile.status === undefined,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      placeId: directPlace ?? null,
      accessiblePlaceIds: accessiblePlaceIds
    };
  }
}

