import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CreateBranchRequest, CreatePlaceRequest, Place, PlaceBranch, PlaceStatus } from '../models/place.model';
import { AdminCreateUserPayload, AuthSuccessResponse } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class PlaceService {
  constructor(private api: ApiService) {}

  createPlace(request: CreatePlaceRequest): Observable<Place> {
    return this.api.post<Place>('/place', request);
  }

  getPlaces(params?: Record<string, any>): Observable<Place[]> {
    return this.api.get<Place[]>('/places', params);
  }

  createAdminUser(request: AdminCreateUserPayload): Observable<AuthSuccessResponse['data']> {
    return this.api.post<AuthSuccessResponse['data']>('/users', request);
  }

  buildGuestMenuLink(placeId: string, branchId: string, origin?: string): string {
    if (!placeId || !branchId) {
      return '';
    }
    const base = origin ?? window?.location?.origin ?? '';
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${normalizedBase}/menu?place_id=${encodeURIComponent(placeId)}&branch_id=${encodeURIComponent(branchId)}`;
  }

  updatePlaceStatus(placeId: string, status: PlaceStatus): Observable<Place> {
    return this.api.put<Place>('/place', { id: placeId, status });
  }

  getBranches(params?: Record<string, any>): Observable<PlaceBranch[]> {
    return this.api.get<PlaceBranch[]>('/branches', params);
  }

  createBranch(request: CreateBranchRequest): Observable<PlaceBranch> {
    return this.api.post<PlaceBranch>('/branches', request);
  }
}

