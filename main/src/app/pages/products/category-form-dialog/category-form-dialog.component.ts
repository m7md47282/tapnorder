import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Category } from '../../../models/category.model';
import { CategoriesService } from '../../../services/categories.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { TenantContextService } from '../../../services/tenant-context.service';
import { PlaceService } from '../../../services/place.service';
import { PlaceBranch } from '../../../models/place.model';

export interface CategoryFormData extends Partial<Category> {
  placeId: string; // Required, fetched from localStorage/tenant context, not in form
  branchId?: string | null; // Optional, visible to user
}

@Component({
  selector: 'app-category-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './category-form-dialog.component.html',
  styleUrls: ['./category-form-dialog.component.scss']
})
export class CategoryFormDialogComponent implements OnInit {
  categoryForm: FormGroup;
  isEditMode: boolean = false;
  suggestedIcons: string[] = [
    'restaurant_menu',
    'dinner_dining',
    'lunch_dining',
    'breakfast_dining',
    'cake',
    'local_drink',
    'local_cafe',
    'local_pizza',
    'set_meal',
    'soup_kitchen',
    'fastfood',
    'eco',
    'restaurant'
  ];

  // Branch selection
  availableBranches: PlaceBranch[] = [];
  isLoadingBranches: boolean = false;
  currentPlaceId: string | null = null; // Hidden from user, auto-filled

  constructor(
    public dialogRef: MatDialogRef<CategoryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category: Category | null; menuId?: string | null },
    private categoriesService: CategoriesService,
    private localStorage: LocalStorageService,
    private tenantContext: TenantContextService,
    private placeService: PlaceService,
    private cdr: ChangeDetectorRef
  ) {
    this.isEditMode = !!data.category;
    
    this.categoryForm = new FormGroup({
      branchId: new FormControl(null), // Optional, visible, default to null (shared)
      name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]),
      description: new FormControl(''),
      icon: new FormControl(''),
      displayOrder: new FormControl(0, [Validators.min(0)]),
      isActive: new FormControl(true)
    });
  }

  ngOnInit(): void {
    // Initialize placeId from context (hidden from user)
    this.initializePlaceId();
    
    if (this.isEditMode && this.data.category) {
      const category = this.data.category;
      const placeId = category.placeId || this.currentPlaceId || '';
      
      this.categoryForm.patchValue({
        branchId: category.branchId || null,
        name: category.name,
        description: category.description || '',
        icon: category.icon || '',
        displayOrder: category.displayOrder || 0,
        isActive: category.isActive !== false
      });
      
      // Load branches for the place if editing
      if (placeId) {
        this.currentPlaceId = placeId;
        this.loadBranchesForPlace(placeId);
      }
    } else {
      // For new categories, load branches for the current place
      if (this.currentPlaceId) {
        this.loadBranchesForPlace(this.currentPlaceId);
      }
      
      // Suggest icon based on category name
      this.categoryForm.get('name')?.valueChanges.subscribe(name => {
        if (name && !this.isEditMode) {
          const suggestedIcon = this.categoriesService.getCategoryIcon(name);
          if (suggestedIcon && !this.categoryForm.get('icon')?.value) {
            this.categoryForm.patchValue({ icon: suggestedIcon });
          }
        }
      });
    }
  }

  /**
   * Initialize placeId from tenant context (hidden from user)
   */
  private initializePlaceId(): void {
    const currentPlaceId = this.tenantContext.getCurrentPlaceId();
    if (currentPlaceId) {
      this.currentPlaceId = currentPlaceId;
    } else {
      // If no place in context, try to get from user
      const user = this.localStorage.getUser<any>();
      if (user?.placeId) {
        this.currentPlaceId = user.placeId;
      }
    }
  }

  /**
   * Load branches for the current place
   */
  loadBranchesForPlace(placeId: string): void {
    console.log('Loading branches for place:', placeId);
    if (!placeId) {
      this.availableBranches = [];
      return;
    }

    this.isLoadingBranches = true;
    this.placeService.getBranches({ place_id: placeId }).subscribe({
      next: (branches) => {
        this.availableBranches = branches || [];
        this.isLoadingBranches = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading branches:', error);
        this.availableBranches = [];
        this.isLoadingBranches = false;
        this.cdr.detectChanges();
      }
    });
  }

  get f() {
    return this.categoryForm.controls;
  }

  onSubmit(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const formValue = this.categoryForm.value;
    
    // Get placeId from tenant context or localStorage (not from form)
    const placeId = this.currentPlaceId || this.tenantContext.getCurrentPlaceId() || (this.localStorage.getUser<any>()?.placeId);
    
    if (!placeId) {
      console.error('Place ID is required to create/update category');
      return;
    }
    
    const categoryData: CategoryFormData = {
      placeId: placeId,
      branchId: formValue.branchId || null, // null means shared
      name: formValue.name.trim(),
      description: formValue.description?.trim() || undefined,
      icon: formValue.icon?.trim() || undefined,
      displayOrder: parseInt(formValue.displayOrder) || 0,
      isActive: formValue.isActive !== false
    };

    this.dialogRef.close(categoryData);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getSuggestedIcon(): string {
    const name = this.categoryForm.get('name')?.value || '';
    return this.categoriesService.getCategoryIcon(name);
  }
}

