import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Product } from '../../../models/product.model';

@Component({
  selector: 'app-stock-adjustment-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './stock-adjustment-dialog.component.html',
  styleUrls: ['./stock-adjustment-dialog.component.scss']
})
export class StockAdjustmentDialogComponent implements OnInit {
  adjustmentForm: FormGroup;
  adjustmentType: 'IN' | 'OUT' | 'ADJUSTMENT' = 'ADJUSTMENT';
  currentStock: number = 0;
  newStock: number = 0;

  constructor(
    public dialogRef: MatDialogRef<StockAdjustmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product }
  ) {
    this.currentStock = data.product.stock;
    
    this.adjustmentForm = new FormGroup({
      type: new FormControl('ADJUSTMENT', [Validators.required]),
      quantity: new FormControl('', [Validators.required, Validators.min(0)]),
      reason: new FormControl('', [Validators.required])
    });
  }

  ngOnInit(): void {
    this.adjustmentForm.get('type')?.valueChanges.subscribe(type => {
      this.adjustmentType = type;
      this.calculateNewStock();
    });

    this.adjustmentForm.get('quantity')?.valueChanges.subscribe(() => {
      this.calculateNewStock();
    });
  }

  calculateNewStock(): void {
    const quantity = parseFloat(this.adjustmentForm.get('quantity')?.value || '0');
    const type = this.adjustmentForm.get('type')?.value;

    if (type === 'IN') {
      this.newStock = this.currentStock + quantity;
    } else if (type === 'OUT') {
      this.newStock = Math.max(0, this.currentStock - quantity);
    } else {
      this.newStock = quantity;
    }
  }

  get f() {
    return this.adjustmentForm.controls;
  }

  onSubmit(): void {
    if (this.adjustmentForm.invalid) {
      this.adjustmentForm.markAllAsTouched();
      return;
    }

    const formValue = this.adjustmentForm.value;
    this.dialogRef.close({
      type: formValue.type,
      quantity: parseFloat(formValue.quantity),
      reason: formValue.reason
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

