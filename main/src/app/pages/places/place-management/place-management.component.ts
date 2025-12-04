import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MaterialModule } from '../../../material.module';
import { PlaceService } from '../../../services/place.service';
import { NotificationService } from '../../../services/notification.service';
import {
  BusinessHoursMap,
  CreatePlaceRequest,
  Place
} from '../../../models/place.model';
import {
  AdminCreateUserPayload,
  UserProfile,
  UserRole
} from '../../../models/user.model';
import { finalize, map, switchMap } from 'rxjs/operators';

type WizardStep = 'idle' | 'creating-admin' | 'creating-place' | 'done';

interface CreatedPlaceResult {
  place: Place;
  admin: UserProfile;
  adminPassword: string;
}

@Component({
  selector: 'app-place-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './place-management.component.html',
  styleUrls: ['./place-management.component.scss'],
})
export class PlaceManagementComponent {
  private fb = inject(FormBuilder);
  private placeService = inject(PlaceService);
  private notification = inject(NotificationService);

  readonly roleOptions = [
    { label: 'Restaurant Manager', value: UserRole.RESTAURANT_MANAGER },
    { label: 'Store Manager (Legacy)', value: UserRole.STORE_MANAGER },
  ];

  readonly countryOptions = [
    'United States',
    'United Kingdom',
    'Canada',
    'Saudi Arabia',
    'United Arab Emirates',
    'Jordan',
    'France',
    'Germany',
  ];

  readonly timezoneOptions = [
    'UTC',
    'America/New_York',
    'Europe/London',
    'Europe/Paris',
    'Asia/Dubai',
    'Asia/Amman',
  ];

  readonly currencyOptions = [
    'USD',
    'EUR',
    'GBP',
    'CAD',
    'AED',
    'JOD',
  ];

  readonly languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French' },
    { value: 'ar', label: 'Arabic' },
  ];

  readonly defaultBusinessHours = this.buildDefaultBusinessHours();

  placeForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    address: this.fb.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zipCode: ['', Validators.required],
      country: ['United States', Validators.required],
    }),
    contact: this.fb.group({
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      website: [''],
    }),
    settings: this.fb.group({
      currency: ['USD', Validators.required],
      timezone: ['UTC', Validators.required],
      language: ['en', Validators.required],
      allowOnlineOrders: [true],
      requireOrderConfirmation: [false],
    }),
  });

  adminForm: FormGroup = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', Validators.required],
    role: [UserRole.RESTAURANT_MANAGER, Validators.required],
    autoGeneratePassword: [true],
    password: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(8)]],
    confirmPassword: [{ value: '', disabled: true }, Validators.required],
  }, { validators: this.passwordsMatchValidator });

  isSubmitting = signal(false);
  currentStep = signal<WizardStep>('idle');
  resultSummary = signal<CreatedPlaceResult | null>(null);

  statusMessage = computed(() => {
    switch (this.currentStep()) {
      case 'creating-admin':
        return 'Creating primary place administrator…';
      case 'creating-place':
        return 'Creating place and linking it to the new admin…';
      case 'done':
        return 'Place created successfully.';
      default:
        return 'Ready to create a new place.';
    }
  });

  constructor() {
    this.adminForm.get('autoGeneratePassword')?.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((auto) => this.togglePasswordFields(Boolean(auto)));

    this.togglePasswordFields(Boolean(this.adminForm.get('autoGeneratePassword')?.value));
  }

  submit(): void {
    if (this.placeForm.invalid || this.adminForm.invalid) {
      this.markFormGroupTouched(this.placeForm);
      this.markFormGroupTouched(this.adminForm);
      this.notification.warning('Please resolve the highlighted fields before submitting.');
      return;
    }

    const adminPayload = this.buildAdminPayload();
    const adminPassword = adminPayload.password;

    this.isSubmitting.set(true);
    this.currentStep.set('creating-admin');
    this.resultSummary.set(null);

    this.placeService.createAdminUser(adminPayload).pipe(
      switchMap((adminResponse) => {
        const ownerId = adminResponse?.user?.id;
        if (!ownerId) {
          throw new Error('Unable to determine the new admin ID from the API response.');
        }

        this.currentStep.set('creating-place');
        const placePayload = this.buildPlacePayload(ownerId);
        return this.placeService.createPlace(placePayload).pipe(
          map(place => ({
            place,
            admin: adminResponse.user,
            adminPassword,
          }))
        );
      }),
      finalize(() => this.isSubmitting.set(false))
    ).subscribe({
      next: (result) => {
        this.currentStep.set('done');
        this.resultSummary.set(result);
        this.notification.success('Place and primary admin created successfully.');
        this.resetFormsAfterSuccess();
      },
      error: (error) => {
        console.error(error);
        this.currentStep.set('idle');
        this.notification.error(error?.message || 'Failed to create place. Please try again.');
      },
    });
  }

  resetForms(): void {
    this.placeForm.reset({
      name: '',
      description: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',
      },
      contact: {
        phone: '',
        email: '',
        website: '',
      },
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        language: 'en',
        allowOnlineOrders: true,
        requireOrderConfirmation: false,
      },
    });

    this.adminForm.reset({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: UserRole.RESTAURANT_MANAGER,
      autoGeneratePassword: true,
    });
    this.togglePasswordFields(true);
  }

  copyToClipboard(value: string | undefined | null): void {
    if (!value || !navigator?.clipboard) {
      return;
    }
    navigator.clipboard.writeText(value).then(() => {
      this.notification.info('Copied to clipboard.');
    }).catch(() => {
      this.notification.warning('Unable to copy to clipboard.');
    });
  }

  private resetFormsAfterSuccess(): void {
    this.resetForms();
  }

  private buildAdminPayload(): AdminCreateUserPayload {
    const raw = this.adminForm.getRawValue();
    const displayName = `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim();

    return {
      email: raw.email,
      password: raw.password,
      firstName: raw.firstName,
      lastName: raw.lastName,
      username: displayName || raw.email,
      displayName: displayName || raw.email,
      roleKey: raw.role,
      phoneNumber: raw.phoneNumber,
      metadata: {
        createdVia: 'super-admin-place-wizard',
        createdAt: new Date().toISOString(),
      },
      deviceInfo: {
        userAgent: navigator?.userAgent,
      },
    };
  }

  private buildPlacePayload(ownerId: string): CreatePlaceRequest {
    const value = this.placeForm.getRawValue();
    const address = value.address ?? {};
    const contact = value.contact ?? {};
    const settings = value.settings ?? {};

    return {
      name: value.name,
      description: value.description,
      ownerId,
      address: {
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
      },
      contact: {
        phone: contact.phone,
        email: contact.email,
        website: contact.website,
      },
      settings: {
        currency: settings.currency,
        timezone: settings.timezone,
        language: settings.language,
        allowOnlineOrders: settings.allowOnlineOrders,
        requireOrderConfirmation: settings.requireOrderConfirmation,
      },
      businessHours: this.defaultBusinessHours,
    };
  }

  private buildDefaultBusinessHours(): BusinessHoursMap {
    const template: BusinessHoursMap = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach((day) => {
      template[day] = {
        open: '09:00',
        close: day === 'sunday' ? '18:00' : '21:00',
        isOpen: true,
      };
    });
    return template;
  }

  private togglePasswordFields(auto: boolean): void {
    const passwordCtrl = this.adminForm.get('password');
    const confirmCtrl = this.adminForm.get('confirmPassword');

    if (!passwordCtrl || !confirmCtrl) {
      return;
    }

    if (auto) {
      const generated = this.generatePassword();
      passwordCtrl.setValue(generated, { emitEvent: false });
      confirmCtrl.setValue(generated, { emitEvent: false });
      passwordCtrl.disable({ emitEvent: false });
      confirmCtrl.disable({ emitEvent: false });
    } else {
      passwordCtrl.enable({ emitEvent: false });
      confirmCtrl.enable({ emitEvent: false });
      passwordCtrl.reset('', { emitEvent: false });
      confirmCtrl.reset('', { emitEvent: false });
    }
  }

  private passwordsMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    if (password && confirm && password !== confirm) {
      return { passwordMismatch: true };
    }
    return null;
  }

  private markFormGroupTouched(group: FormGroup): void {
    Object.values(group.controls).forEach((control: any) => {
      if (control.controls) {
        this.markFormGroupTouched(control);
      } else {
        control.markAsTouched();
        control.updateValueAndValidity();
      }
    });
  }

  private generatePassword(length: number = 12): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
  }
}

