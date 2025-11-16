import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Sale, PaymentMethod } from '../../../models/product.model';

@Component({
  selector: 'app-sale-detail-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './sale-detail-dialog.component.html',
  styleUrls: ['./sale-detail-dialog.component.scss']
})
export class SaleDetailDialogComponent {
  PaymentMethod = PaymentMethod;

  constructor(
    public dialogRef: MatDialogRef<SaleDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { sale: Sale }
  ) {}

  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH]: 'Cash',
      [PaymentMethod.CARD]: 'Card',
      [PaymentMethod.MOBILE_PAYMENT]: 'Mobile Payment',
      [PaymentMethod.CREDIT]: 'Credit',
      [PaymentMethod.MIXED]: 'Mixed'
    };
    return labels[method] || method;
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  onClose(): void {
    this.dialogRef.close();
  }

  onPrint(): void {
    window.print();
  }
}

