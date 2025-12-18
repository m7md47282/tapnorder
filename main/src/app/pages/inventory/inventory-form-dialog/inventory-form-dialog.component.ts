import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Inventory, CreateInventoryCommand, UpdateInventoryCommand } from '../../../models/inventory.model';
import { TenantContextService } from '../../../services/tenant-context.service';
import { PlaceService } from '../../../services/place.service';
import { Place, PlaceBranch } from '../../../models/place.model';

export interface InventoryFormData {
  placeId: string;
  branchId?: string | null;
  ingredientName: string;
  unit: 'kilogram' | 'gram' | 'liter' | 'milliliter' | 'piece' | 'cup';
  currentQuantity: number;
  costPerUnit: number;
  minStockLevel?: number;
  supplier?: string;
  notes?: string;
}

@Component({
  selector: 'app-inventory-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './inventory-form-dialog.component.html',
  styleUrls: ['./inventory-form-dialog.component.scss']
})
export class InventoryFormDialogComponent implements OnInit {
  inventoryForm: FormGroup;
  isEditMode: boolean = false;
  
  units: Array<'kilogram' | 'gram' | 'liter' | 'milliliter' | 'piece' | 'cup'> = [
    'kilogram', 'gram', 'liter', 'milliliter', 'piece', 'cup'
  ];

  // Place and Branch data
  availablePlaces: Place[] = [];
  availableBranches: PlaceBranch[] = [];
  isLoadingPlaces: boolean = false;
  isLoadingBranches: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<InventoryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { inventory: Inventory | null },
    private tenantContext: TenantContextService,
    private placeService: PlaceService
  ) {
    this.isEditMode = !!data.inventory;
    
    this.inventoryForm = new FormGroup({
      placeId: new FormControl('', [Validators.required]),
      branchId: new FormControl(null), // null = shared, default value
      ingredientName: new FormControl('', [Validators.required, Validators.minLength(2)]),
      unit: new FormControl('gram', [Validators.required]),
      currentQuantity: new FormControl('', [Validators.required, Validators.min(0)]),
      costPerUnit: new FormControl('', [Validators.required, Validators.min(0)]),
      minStockLevel: new FormControl('', [Validators.min(0)]),
      supplier: new FormControl(''),
      notes: new FormControl('')
    });
  }

  ngOnInit(): void {
    this.loadPlaces();
    
    // Set up place change listener to load branches
    this.inventoryForm.get('placeId')?.valueChanges.subscribe(placeId => {
      if (placeId) {
        this.loadBranchesForPlace(placeId);
      } else {
        this.availableBranches = [];
        this.inventoryForm.patchValue({ branchId: null });
      }
    });

    if (this.isEditMode && this.data.inventory) {
      const inv = this.data.inventory;
      this.inventoryForm.patchValue({
        placeId: inv.placeId,
        branchId: inv.branchId || null,
        ingredientName: inv.ingredientName,
        unit: inv.unit,
        currentQuantity: inv.currentQuantity,
        costPerUnit: inv.costPerUnit,
        minStockLevel: inv.minStockLevel || '',
        supplier: inv.supplier || '',
        notes: inv.notes || ''
      });
      
      // Load branches for the place if editing
      if (inv.placeId) {
        this.loadBranchesForPlace(inv.placeId);
      }
    } else {
      // Set default place from context for new items
      const currentPlaceId = this.tenantContext.getCurrentPlaceId();
      if (currentPlaceId) {
        this.inventoryForm.patchValue({ placeId: currentPlaceId });
        this.loadBranchesForPlace(currentPlaceId);
      }
    }
  }

  loadPlaces(): void {
    this.isLoadingPlaces = true;
    this.placeService.getPlaces().subscribe({
      next: (places) => {
        this.availablePlaces = places;
        this.isLoadingPlaces = false;
      },
      error: (error) => {
        console.error('Error loading places:', error);
        this.isLoadingPlaces = false;
      }
    });
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
    return this.inventoryForm.controls;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.inventoryForm.invalid) {
      this.inventoryForm.markAllAsTouched();
      console.log('Inventory form errors:', this.inventoryForm.errors);
      return;
    }

    const formValue = this.inventoryForm.value;
    const placeId = formValue.placeId;
    
    if (!placeId) {
      console.error('Place ID is required to create inventory item');
      return;
    }

    const inventoryData: InventoryFormData = {
      placeId: placeId,
      branchId: formValue.branchId || null, // null means shared
      ingredientName: formValue.ingredientName,
      unit: formValue.unit,
      currentQuantity: parseFloat(formValue.currentQuantity),
      costPerUnit: parseFloat(formValue.costPerUnit),
      minStockLevel: formValue.minStockLevel ? parseFloat(formValue.minStockLevel) : undefined,
      supplier: formValue.supplier || undefined,
      notes: formValue.notes || undefined
    };

    this.dialogRef.close(inventoryData);
  }
}

