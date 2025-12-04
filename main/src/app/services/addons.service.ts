import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  AddonGroup,
  AddonGroupQuery,
  CreateAddonGroupCommand,
  UpdateAddonGroupCommand
} from '../models/addon.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AddonsService {
  private addonGroupCache = new Map<string, AddonGroup>();

  private readonly seedAddonGroups: AddonGroup[] = [
    {
      id: 'addon-group-flavor-shots',
      name: 'Flavor Shots',
      description: 'Customize hot drinks with an extra kick of flavor.',
      selectionType: 'multiple',
      maxSelect: 2,
      options: [
        { id: 'addon-vanilla', name: 'Vanilla Syrup', price: 0.5, isDefault: false },
        { id: 'addon-caramel', name: 'Caramel Syrup', price: 0.5 },
        { id: 'addon-hazelnut', name: 'Hazelnut Syrup', price: 0.5 },
        { id: 'addon-mocha', name: 'Mocha Drizzle', price: 0.75 }
      ]
    },
    {
      id: 'addon-group-dessert-toppings',
      name: 'Dessert Toppings',
      description: 'Dress your desserts with premium toppings.',
      selectionType: 'quantity',
      minSelect: 0,
      maxSelect: 3,
      isRequired: false,
      options: [
        { id: 'addon-pistachio', name: 'Pistachio Crumble', price: 0.8, maxQuantity: 2 },
        { id: 'addon-biscoff', name: 'Biscoff Spread', price: 0.9, maxQuantity: 2 },
        { id: 'addon-salted-caramel', name: 'Salted Caramel Drizzle', price: 0.7, maxQuantity: 2 },
        { id: 'addon-berries', name: 'Fresh Berries', price: 1.2, maxQuantity: 2 }
      ]
    }
  ];

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  getAddonGroups(query: AddonGroupQuery = {}): Observable<AddonGroup[]> {
    const includeAuth = this.auth.isAuthenticated();
    return this.api.get<AddonGroup[]>('/addonGroups', query, includeAuth).pipe(
      tap(groups => {
        if (Array.isArray(groups)) {
          groups.forEach(group => this.addonGroupCache.set(group.id, group));
        }
      }),
      catchError(() => {
        const seedGroups = this.getSeedAddonGroups();
        seedGroups.forEach(group => this.addonGroupCache.set(group.id, group));
        return of(seedGroups);
      })
    );
  }

  getAddonGroupById(id: string): Observable<AddonGroup> {
    if (this.addonGroupCache.has(id)) {
      return of(this.cloneGroup(this.addonGroupCache.get(id)!));
    }
    const includeAuth = this.auth.isAuthenticated();
    return this.api.get<AddonGroup>(`/addonGroups/${id}`, undefined, includeAuth).pipe(
      tap(group => {
        if (group) {
          this.addonGroupCache.set(group.id, group);
        }
      })
    );
  }

  getAddonGroupFromCache(id: string): AddonGroup | undefined {
    const cached = this.addonGroupCache.get(id);
    return cached ? this.cloneGroup(cached) : undefined;
  }

  getSeedAddonGroups(): AddonGroup[] {
    return this.seedAddonGroups.map(group => this.cloneGroup(group));
  }

  createAddonGroup(payload: CreateAddonGroupCommand): Observable<AddonGroup> {
    return this.api.post<AddonGroup>('/addonGroups', payload).pipe(
      tap(group => {
        if (group) {
          this.addonGroupCache.set(group.id, group);
        }
      })
    );
  }

  updateAddonGroup(id: string, payload: UpdateAddonGroupCommand): Observable<AddonGroup> {
    return this.api.put<AddonGroup>(`/addonGroups/${id}`, payload).pipe(
      tap(group => {
        if (group) {
          this.addonGroupCache.set(group.id, group);
        }
      })
    );
  }

  deleteAddonGroup(id: string): Observable<any> {
    return this.api.delete(`/addonGroups/${id}`).pipe(
      tap(() => {
        this.addonGroupCache.delete(id);
      })
    );
  }

  private cloneGroup(group: AddonGroup): AddonGroup {
    return {
      ...group,
      options: group.options?.map(option => ({ ...option }))
    };
  }
}

