import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MaterialModule } from '../../../material.module';
import { RouterModule } from '@angular/router';
import { PlaceService } from '../../../services/place.service';
import { NotificationService } from '../../../services/notification.service';
import { CreateBranchRequest, Place, PlaceBranch, PlaceStatus } from '../../../models/place.model';
import { finalize, map } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { PlaceBranchDialogComponent } from '../place-branch-dialog/place-branch-dialog.component';

@Component({
  selector: 'app-place-directory',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterModule],
  templateUrl: './place-directory.component.html',
  styleUrls: ['./place-directory.component.scss'],
})
export class PlaceDirectoryComponent {
  private placeService = inject(PlaceService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);

  protected readonly places = signal<Place[]>([]);
  protected readonly branchesByPlace = signal<Record<string, PlaceBranch[]>>({});
  protected readonly isLoading = signal(false);
  protected readonly isBranchesLoading = signal(false);
  protected readonly lastUpdated = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly displayedColumns: string[] = [
    'place',
    'location',
    'status',
    'branches',
    'actions',
  ];
  private readonly statusLoading = signal<Record<string, boolean>>({});
  protected readonly placeStatuses: { value: PlaceStatus; label: string }[] = [
    { value: 'pending_approval', label: 'Pending approval' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ];

  protected readonly filteredPlaces = computed(() => {
    const term = this.search().trim().toLowerCase();
    const dataset = this.places();
    if (!term) {
      return dataset;
    }
    return dataset.filter((place) => {
      const placeMatch =
        place.name?.toLowerCase().includes(term) ||
        place.address?.city?.toLowerCase().includes(term) ||
        place.address?.country?.toLowerCase().includes(term);

      if (placeMatch) {
        return true;
      }

      return this.getBranchesForPlace(place.id).some((branch) =>
        [
          branch.name,
          branch.address?.city,
          branch.address?.country,
          branch.code,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term))
      );
    });
  });

  constructor() {
    this.loadPlaces();
  }

  protected onSearch(term: string): void {
    this.search.set(term);
  }

  protected refresh(): void {
    this.loadPlaces(true);
  }

  protected getBranchCount(place: Place): number {
    return this.getBranchesForPlace(place.id).length;
  }

  protected getBranchMenuUrl(place: Place, branch: PlaceBranch): string {
    return (
      branch.menuUrl ||
      this.placeService.buildGuestMenuLink(place.id, branch.id)
    );
  }

  protected statusUpdating(placeId: string): boolean {
    return Boolean(this.statusLoading()[placeId]);
  }

  protected onStatusChange(place: Place, status: PlaceStatus): void {
    if (!status || place.status === status) {
      return;
    }

    this.setStatusLoading(place.id, true);
    this.placeService
      .updatePlaceStatus(place.id, status)
      .pipe(finalize(() => this.setStatusLoading(place.id, false)))
      .subscribe({
        next: (updatedPlace) => {
          this.places.update((current) =>
            current.map((p) =>
              p.id === updatedPlace.id ? { ...p, status: updatedPlace.status } : p
            )
          );
          this.notification.success(`Status updated to ${status.replace('_', ' ')}`);
        },
        error: (error) => {
          console.error(error);
          this.notification.error(
            error?.message || 'Unable to update status. Please try again.'
          );
        },
      });
  }

  protected copyMenuLink(place: Place, branch: PlaceBranch): void {
    const url = this.getBranchMenuUrl(place, branch);
    if (!url) {
      this.notification.warning('Unable to build menu link for this branch yet.');
      return;
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => this.notification.success('Menu link copied.'))
        .catch(() => this.copyMenuLinkFallback(url));
    } else {
      this.copyMenuLinkFallback(url);
    }
  }

  protected getInitials(place: Place): string {
    const name = place.name ?? '';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) {
      return 'PL';
    }
    if (parts.length === 1) {
      return (parts[0][0] ?? 'P').toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  protected getLocation(place: Place): string {
    const parts = [
      place.address?.city,
      place.address?.state,
      place.address?.country,
    ].filter(Boolean);
    return parts.join(', ') || '—';
  }

  protected hasBranches(place: Place): boolean {
    return this.getBranchesForPlace(place.id).length > 0;
  }

  protected getBranchesForPlace(placeId: string): PlaceBranch[] {
    return this.branchesByPlace()[placeId] ?? [];
  }

  protected openBranchDialog(place: Place): void {
    const dialogRef = this.dialog.open(PlaceBranchDialogComponent, {
      width: '520px',
      data: { place },
    });

    dialogRef.afterClosed().subscribe((formValue: Partial<CreateBranchRequest> | undefined) => {
      if (!formValue) {
        return;
      }

      const payload: CreateBranchRequest = {
        ...(formValue as CreateBranchRequest),
        placeId: place.id,
      };

      this.isBranchesLoading.set(true);
      this.placeService
        .createBranch(payload)
        .pipe(finalize(() => this.isBranchesLoading.set(false)))
        .subscribe({
          next: (branch) => {
            this.branchesByPlace.update((current) => {
              const nextBranches = current[branch.placeId] ?? [];
              return {
                ...current,
                [branch.placeId]: [...nextBranches, branch],
              };
            });
            this.notification.success('Branch created successfully.');
          },
          error: (error) => {
            console.error(error);
            this.notification.error(error?.message || 'Failed to create branch.');
          },
        });
    });
  }

  private copyMenuLinkFallback(value: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        this.notification.success('Menu link copied.');
      } else {
        this.notification.warning('Copy command was blocked by the browser.');
      }
    } catch (error) {
      console.error(error);
      this.notification.warning('Unable to copy link on this device.');
    }
  }

  private loadPlaces(force = false): void {
    if (this.isLoading()) {
      return;
    }
    this.isLoading.set(true);
    const params = force ? { force } : undefined;
    this.placeService
      .getPlaces(params)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response) ? response : [];
          this.places.set(data);
          this.lastUpdated.set(new Date().toISOString());
          this.loadBranchesForPlaces(data);
        },
        error: (error) => {
          console.error(error);
          this.notification.error(
            error?.message || 'Failed to fetch places. Please try again.'
          );
        },
      });
  }

  private setStatusLoading(placeId: string, isLoading: boolean): void {
    this.statusLoading.update((current) => ({
      ...current,
      [placeId]: isLoading,
    }));
  }

  private loadBranchesForPlaces(places: Place[]): void {
    const placeIds = places.map((p) => p.id).filter(Boolean);
    if (placeIds.length === 0) {
      this.branchesByPlace.set({});
      return;
    }

    this.isBranchesLoading.set(true);
    forkJoin(
      placeIds.map((placeId) =>
        this.placeService
          .getBranches({ place_id: placeId })
          .pipe(map((branches) => ({ placeId, branches: branches ?? [] })))
      )
    )
      .pipe(finalize(() => this.isBranchesLoading.set(false)))
      .subscribe({
        next: (result) => {
          const grouped = result.reduce<Record<string, PlaceBranch[]>>((acc, entry) => {
            acc[entry.placeId] = entry.branches;
            return acc;
          }, {});
          this.branchesByPlace.set(grouped);
        },
        error: (error) => {
          console.error(error);
          this.notification.error(error?.message || 'Failed to load branches.');
        },
      });
  }
}

