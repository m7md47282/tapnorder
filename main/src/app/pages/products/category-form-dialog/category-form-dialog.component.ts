import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Category } from '../../../models/category.model';
import { CategoriesService } from '../../../services/categories.service';

export interface CategoryFormData {
  name: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
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

  constructor(
    public dialogRef: MatDialogRef<CategoryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category: Category | null; menuId?: string | null },
    private categoriesService: CategoriesService
  ) {
    this.isEditMode = !!data.category;
    
    this.categoryForm = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]),
      description: new FormControl(''),
      icon: new FormControl(''),
      displayOrder: new FormControl(0, [Validators.min(0)]),
      isActive: new FormControl(true)
    });
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.category) {
      this.categoryForm.patchValue({
        name: this.data.category.name,
        description: this.data.category.description || '',
        icon: this.data.category.icon || '',
        displayOrder: this.data.category.displayOrder || 0,
        isActive: this.data.category.isActive !== false
      });
    } else {
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

  get f() {
    return this.categoryForm.controls;
  }

  onSubmit(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const formValue = this.categoryForm.value;
    
    const categoryData: CategoryFormData = {
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

