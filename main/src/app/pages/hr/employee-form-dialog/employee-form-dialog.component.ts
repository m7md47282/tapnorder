import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { User, UserRole, AdminCreateUserPayload } from '../../../models/user.model';
import { getRoleId, getAllRolesWithIds } from '../../../utils/role-ids.util';
import { TenantContextService } from '../../../services/tenant-context.service';
import { LocalStorageService } from '../../../services/local-storage.service';

@Component({
  selector: 'app-employee-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './employee-form-dialog.component.html',
  styleUrls: ['./employee-form-dialog.component.scss']
})
export class EmployeeFormDialogComponent implements OnInit {
  employeeForm: FormGroup;
  isEditMode: boolean = false;
  availableRoles: Array<{ role: UserRole; id: number; name: string }> = [];
  currentPlaceId: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<EmployeeFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user: User | null },
    private tenantContext: TenantContextService,
    private localStorage: LocalStorageService
  ) {
    this.isEditMode = !!data.user;
    
    // Get available roles (exclude SUPER_ADMIN for regular admins)
    const allRoles = getAllRolesWithIds();
    this.availableRoles = allRoles.filter(r => r.role !== UserRole.SUPER_ADMIN);
    
    this.employeeForm = new FormGroup({
      firstName: new FormControl('', [Validators.required]),
      lastName: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      phoneNumber: new FormControl(''),
      roleId: new FormControl('', [Validators.required]),
      password: new FormControl('', this.isEditMode ? [] : [Validators.required, Validators.minLength(6)]),
      isActive: new FormControl(true)
    });
  }

  ngOnInit(): void {
    // Initialize placeId from context
    this.currentPlaceId = this.tenantContext.getCurrentPlaceId() || 
                          this.localStorage.getUser<any>()?.placeId || 
                          null;

    if (this.isEditMode && this.data.user) {
      const user = this.data.user;
      this.employeeForm.patchValue({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email,
        phoneNumber: (user as any).phoneNumber || '',
        roleId: getRoleId(user.role),
        isActive: user.isActive
      });
      // Remove password requirement in edit mode
      this.employeeForm.get('password')?.clearValidators();
      this.employeeForm.get('password')?.updateValueAndValidity();
    }
  }

  get f() {
    return this.employeeForm.controls;
  }

  getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: 'Super Admin',
      [UserRole.ADMIN]: 'Admin',
      [UserRole.RESTAURANT_MANAGER]: 'Restaurant Manager',
      [UserRole.SHIFT_MANAGER]: 'Shift Manager',
      [UserRole.WAITER]: 'Waiter',
      [UserRole.CASHIER]: 'Cashier',
      [UserRole.HOST]: 'Host',
      [UserRole.CHEF]: 'Chef',
      [UserRole.BARTENDER]: 'Bartender',
      [UserRole.DELIVERY_DRIVER]: 'Delivery Driver',
      [UserRole.INVENTORY_MANAGER]: 'Inventory Manager',
      [UserRole.ACCOUNTANT]: 'Accountant',
      [UserRole.SALES_STAFF]: 'Sales Staff',
      [UserRole.STORE_MANAGER]: 'Store Manager'
    };
    return roleNames[role] || role;
  }

  onSubmit(): void {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    const formValue = this.employeeForm.value;
    const userData: AdminCreateUserPayload = {
      email: formValue.email,
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      phoneNumber: formValue.phoneNumber || undefined,
      roleId: Number(formValue.roleId),
      displayName: `${formValue.firstName} ${formValue.lastName}`.trim(),
      username: formValue.email.split('@')[0], // Use email prefix as username
      ...(formValue.password && { password: formValue.password }),
      places: this.currentPlaceId ? [this.currentPlaceId] : undefined
    };

    this.dialogRef.close({
      ...userData,
      isActive: formValue.isActive
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

