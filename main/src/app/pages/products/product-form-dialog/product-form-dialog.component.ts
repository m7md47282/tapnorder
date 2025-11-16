import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Product } from '../../../models/product.model';

@Component({
  selector: 'app-product-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './product-form-dialog.component.html',
  styleUrls: ['./product-form-dialog.component.scss']
})
export class ProductFormDialogComponent implements OnInit {
  productForm: FormGroup;
  isEditMode: boolean = false;
  categories: string[] = ['Beverages', 'Food', 'Dairy', 'Meat', 'Vegetables', 'Fruits', 'Snacks', 'Other'];

  constructor(
    public dialogRef: MatDialogRef<ProductFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product | null }
  ) {
    this.isEditMode = !!data.product;
    
    this.productForm = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(3)]),
      description: new FormControl(''),
      sku: new FormControl('', [Validators.required]),
      barcode: new FormControl(''),
      price: new FormControl('', [Validators.required, Validators.min(0)]),
      cost: new FormControl('', [Validators.min(0)]),
      stock: new FormControl('', [Validators.required, Validators.min(0)]),
      category: new FormControl(''),
      image: new FormControl(''),
      taxRate: new FormControl(0.1, [Validators.min(0), Validators.max(1)]),
      unit: new FormControl(''),
      isActive: new FormControl(true)
    });
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.product) {
      this.productForm.patchValue({
        name: this.data.product.name,
        description: this.data.product.description || '',
        sku: this.data.product.sku,
        barcode: this.data.product.barcode || '',
        price: this.data.product.price,
        cost: this.data.product.cost || '',
        stock: this.data.product.stock,
        category: this.data.product.category || '',
        image: this.data.product.image || '',
        taxRate: this.data.product.taxRate || 0.1,
        unit: this.data.product.unit || '',
        isActive: this.data.product.isActive
      });
    }
  }

  get f() {
    return this.productForm.controls;
  }

  onSubmit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const formValue = this.productForm.value;
    const productData: Partial<Product> = {
      name: formValue.name,
      description: formValue.description,
      sku: formValue.sku,
      barcode: formValue.barcode,
      price: parseFloat(formValue.price),
      cost: formValue.cost ? parseFloat(formValue.cost) : undefined,
      stock: parseInt(formValue.stock),
      category: formValue.category,
      image: formValue.image,
      taxRate: parseFloat(formValue.taxRate),
      unit: formValue.unit,
      isActive: formValue.isActive
    };

    this.dialogRef.close(productData);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

