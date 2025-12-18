import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { PlaceService } from '../../../services/place.service';
import { UserService } from '../../../services/user.service';
import { NotificationService } from '../../../services/notification.service';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { TenantContextService } from '../../../services/tenant-context.service';
import { Place, PlaceSettings } from '../../../models/place.model';
import { User, UserRole } from '../../../models/user.model';
import { Attachment } from '../../../models/attachment.model';
import { finalize } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-place-settings',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, RouterModule],
  templateUrl: './place-settings.component.html',
  styleUrls: ['./place-settings.component.scss'],
})
export class PlaceSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private placeService = inject(PlaceService);
  private userService = inject(UserService);
  private notification = inject(NotificationService);
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private tenantContext = inject(TenantContextService);

  readonly currencyOptions = [
    'USD', 'EUR', 'GBP', 'CAD', 'AED', 'JOD', 'SAR', 'JPY', 'CNY', 'INR'
  ];

  readonly timezoneOptions = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Amman',
    'Asia/Riyadh',
    'Asia/Tokyo',
    'Asia/Shanghai',
  ];

  place = signal<Place | null>(null);
  owner = signal<User | null>(null);
  isLoading = signal(false);
  isSaving = signal(false);
  isUploadingLogo = signal(false);

  placeForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    logoUrl: [''],
    settings: this.fb.group({
      currency: ['USD', Validators.required],
      timezone: ['UTC', Validators.required],
    }),
  });

  ownerForm: FormGroup = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: [''],
  });

  logoPreview: string | null = null;
  selectedLogoFile: File | null = null;

  ngOnInit(): void {
    const placeId = this.route.snapshot.paramMap.get('id');
    const currentUser = this.authService.getCurrentUser();
    
    // If no placeId in route, try to get from user context (for restaurant managers)
    let targetPlaceId = placeId;
    if (!targetPlaceId && currentUser) {
      targetPlaceId = this.tenantContext.getCurrentPlaceId() || currentUser.placeId || null;
      
      // If we found a placeId, redirect to the settings page with that ID
      if (targetPlaceId) {
        this.router.navigate(['/places/settings', targetPlaceId], { replaceUrl: true });
        return;
      }
    }
    
    if (!targetPlaceId) {
      this.notification.error('Place ID is required');
      this.redirectToHome();
      return;
    }
    
    // Validate that restaurant managers can only access their own place
    if (currentUser && 
        (currentUser.role === UserRole.RESTAURANT_MANAGER || currentUser.role === UserRole.STORE_MANAGER)) {
      const userPlaceId = this.tenantContext.getCurrentPlaceId() || currentUser.placeId;
      if (userPlaceId && targetPlaceId !== userPlaceId) {
        this.notification.error('You can only edit your own place settings');
        this.redirectToHome();
        return;
      }
    }
    
    this.loadPlace(targetPlaceId);
  }
  
  private redirectToHome(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.role === UserRole.SUPER_ADMIN) {
      this.router.navigate(['/places']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  loadPlace(placeId: string): void {
    this.isLoading.set(true);
    this.placeService
      .getPlaceById(placeId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (place) => {
          this.place.set(place);
          this.populateForms(place);
          if (place.ownerId) {
            this.loadOwner(place.ownerId);
          }
        },
        error: (error) => {
          console.error('Error loading place:', error);
          this.notification.error(error?.message || 'Failed to load place');
          this.redirectToHome();
        },
      });
  }

  loadOwner(ownerId: string): void {
    this.userService.getUserById(ownerId).subscribe({
      next: (user) => {
        this.owner.set(user);
        this.ownerForm.patchValue({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phoneNumber: (user as any).phoneNumber || '',
        });
      },
      error: (error) => {
        console.error('Error loading owner:', error);
        // Don't show error, owner might not exist
      },
    });
  }

  populateForms(place: Place): void {
    this.placeForm.patchValue({
      name: place.name || '',
      description: place.description || '',
      logoUrl: place.logoUrl || '',
      settings: {
        currency: place.settings?.currency || 'USD',
        timezone: place.settings?.timezone || 'UTC',
      },
    });

    if (place.logoUrl) {
      this.logoPreview = place.logoUrl;
    }
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.notification.error('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.notification.error('Image size must be less than 5MB');
        return;
      }

      this.selectedLogoFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logoPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeLogo(): void {
    this.selectedLogoFile = null;
    this.logoPreview = null;
    this.placeForm.patchValue({ logoUrl: '' });
  }

  async uploadLogo(): Promise<string | null> {
    if (!this.selectedLogoFile) {
      return this.place()?.logoUrl || null;
    }

    this.isUploadingLogo.set(true);
    try {
      const base64 = await this.fileToBase64(this.selectedLogoFile);
      const mimeType = this.selectedLogoFile.type;
      const fileName = this.selectedLogoFile.name;

      const place = this.place();
      if (!place) {
        throw new Error('Place not loaded');
      }

      const attachment = await firstValueFrom(
        this.api.uploadAttachment({
          file: base64,
          fileName: fileName,
          mimeType: mimeType,
          relatedEntityType: 'place',
          relatedEntityId: place.id,
          folder: 'logos',
        })
      );

      if (attachment && attachment.url) {
        this.notification.success('Logo uploaded successfully');
        return attachment.url;
      }

      throw new Error('Failed to upload logo');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      this.notification.error(error?.message || 'Failed to upload logo');
      return null;
    } finally {
      this.isUploadingLogo.set(false);
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix if present
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async onSubmit(): Promise<void> {
    if (this.placeForm.invalid) {
      this.placeForm.markAllAsTouched();
      this.notification.warning('Please fill in all required fields');
      return;
    }

    const place = this.place();
    if (!place) {
      return;
    }

    this.isSaving.set(true);

    try {
      // Upload logo if a new one was selected
      let logoUrl = place.logoUrl || '';
      if (this.selectedLogoFile) {
        const uploadedUrl = await this.uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      // Prepare place update
      const formValue = this.placeForm.value;
      const placeUpdates: Partial<Place> = {
        name: formValue.name,
        description: formValue.description || undefined,
        logoUrl: logoUrl || undefined,
        settings: {
          ...place.settings,
          currency: formValue.settings.currency,
          timezone: formValue.settings.timezone,
        },
      };

      // Update place
      const updatedPlace = await firstValueFrom(
        this.placeService.updatePlace(place.id, placeUpdates)
      );

      if (updatedPlace) {
        this.place.set(updatedPlace);
        this.notification.success('Place updated successfully');
      }

      // Update owner if form was modified
      const owner = this.owner();
      if (owner && this.ownerForm.dirty) {
        const ownerUpdates = this.ownerForm.value;
        await firstValueFrom(
          this.userService.updateUser(owner.id, ownerUpdates)
        );
        this.notification.success('Owner information updated successfully');
        this.ownerForm.markAsPristine();
      }
    } catch (error: any) {
      console.error('Error saving place:', error);
      this.notification.error(error?.message || 'Failed to save changes');
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.redirectToHome();
  }
}

