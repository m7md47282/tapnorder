import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../material.module';
import { BusinessHoursMap, Place } from '../../../models/place.model';

export interface PlaceBranchDialogData {
  place: Place;
}

@Component({
  selector: 'app-place-branch-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './place-branch-dialog.component.html',
  styleUrls: ['./place-branch-dialog.component.scss'],
})
export class PlaceBranchDialogComponent {
  readonly branchForm: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<PlaceBranchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PlaceBranchDialogData,
    private fb: FormBuilder
  ) {
    this.branchForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      address: this.fb.group({
        street: [data.place.address?.street ?? '', Validators.required],
        city: [data.place.address?.city ?? '', Validators.required],
        state: [data.place.address?.state ?? '', Validators.required],
        zipCode: [data.place.address?.zipCode ?? '', Validators.required],
        country: [data.place.address?.country ?? '', Validators.required],
      }),
      contact: this.fb.group({
        phone: [data.place.contact?.phone ?? '', Validators.required],
        email: [data.place.contact?.email ?? '', [Validators.required, Validators.email]],
        website: [data.place.contact?.website ?? ''],
      }),
      settings: this.fb.group({
        allowOnlineOrders: [data.place.settings?.allowOnlineOrders ?? true],
        requireOrderConfirmation: [data.place.settings?.requireOrderConfirmation ?? false],
        currency: [data.place.settings?.currency ?? 'USD'],
        timezone: [data.place.settings?.timezone ?? 'UTC'],
        language: [data.place.settings?.language ?? 'en'],
      }),
    });
  }

  submit(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      ...this.branchForm.getRawValue(),
      businessHours: this.defaultBusinessHours(),
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private defaultBusinessHours(): BusinessHoursMap {
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
}

