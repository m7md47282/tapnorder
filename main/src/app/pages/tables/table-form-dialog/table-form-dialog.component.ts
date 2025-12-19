import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Table, TableStatus } from '../../../models/product.model';
import { TenantContextService } from '../../../services/tenant-context.service';
import { PlaceService } from '../../../services/place.service';
import { Place, PlaceBranch } from '../../../models/place.model';

export interface TableFormData {
  tableNumber: string;
  capacity: number;
  placeId: string;
  branchId?: string | null;
  status?: TableStatus;
  location?: string;
  notes?: string;
  isActive?: boolean;
}

@Component({
  selector: 'app-table-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './table-form-dialog.component.html',
  styleUrls: ['./table-form-dialog.component.scss']
})
export class TableFormDialogComponent implements OnInit {
  tableForm: FormGroup;
  isEditMode: boolean = false;
  currentPlaceId: string | null = null;
  
  tableStatuses: TableStatus[] = [
    TableStatus.AVAILABLE,
    TableStatus.OCCUPIED,
    TableStatus.RESERVED,
    TableStatus.CLEANING,
    TableStatus.OUT_OF_SERVICE
  ];

  // Branch data
  availableBranches: PlaceBranch[] = [];
  isLoadingBranches: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<TableFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { table: Table | null },
    private tenantContext: TenantContextService,
    private placeService: PlaceService
  ) {
    this.isEditMode = !!data.table;
    
    // Get current place ID from context
    this.currentPlaceId = this.tenantContext.getCurrentPlaceId();
    
    this.tableForm = new FormGroup({
      branchId: new FormControl(null),
      tableNumber: new FormControl('', [Validators.required, Validators.minLength(1)]),
      capacity: new FormControl('', [Validators.required, Validators.min(1)]),
      status: new FormControl(TableStatus.AVAILABLE, [Validators.required]),
      location: new FormControl(''),
      notes: new FormControl(''),
      isActive: new FormControl(true)
    });
  }

  ngOnInit(): void {
    // Determine place ID
    if (this.isEditMode && this.data.table) {
      const table = this.data.table;
      this.currentPlaceId = table.placeId;
      this.tableForm.patchValue({
        branchId: table.branchId || null,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: table.status,
        location: table.location || '',
        notes: table.notes || '',
        isActive: table.isActive !== undefined ? table.isActive : true
      });
    } else {
      // For new tables, use current place from context
      if (!this.currentPlaceId) {
        this.currentPlaceId = this.tenantContext.getCurrentPlaceId();
      }
    }

    // Load branches for the current place
    if (this.currentPlaceId) {
      this.loadBranchesForPlace(this.currentPlaceId);
    }
  }

  loadBranchesForPlace(placeId: string): void {
    this.isLoadingBranches = true;
    this.placeService.getBranches({ place_id: placeId }).subscribe({
      next: (branches) => {
        this.availableBranches = branches || [];
        this.isLoadingBranches = false;
      },
      error: (error) => {
        console.error('Error loading branches:', error);
        this.availableBranches = [];
        this.isLoadingBranches = false;
      }
    });
  }

  get f() {
    return this.tableForm.controls;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.tableForm.invalid) {
      this.tableForm.markAllAsTouched();
      return;
    }

    if (!this.currentPlaceId) {
      console.error('Place ID is required to create table');
      return;
    }

    const formValue = this.tableForm.value;

    const tableData: TableFormData = {
      tableNumber: formValue.tableNumber,
      capacity: parseInt(formValue.capacity, 10),
      placeId: this.currentPlaceId,
      branchId: formValue.branchId || null,
      status: formValue.status,
      location: formValue.location || undefined,
      notes: formValue.notes || undefined,
      isActive: formValue.isActive !== undefined ? formValue.isActive : true
    };

    this.dialogRef.close(tableData);
  }
}

