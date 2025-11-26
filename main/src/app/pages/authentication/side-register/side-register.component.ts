import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';
import { NotificationService } from 'src/app/services/notification.service';
import { getAllRolesWithIds } from 'src/app/utils/role-ids.util';
import { UserRole } from 'src/app/models/user.model';

@Component({
  selector: 'app-side-register',
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './side-register.component.html',
})
export class AppSideRegisterComponent {
  options = this.settings.getOptions();
  isLoading = false;
  availableRoles = getAllRolesWithIds();
  
  // Filter out SUPER_ADMIN from public registration (only admins can create super admins)
  publicRoles = this.availableRoles.filter(r => r.role !== UserRole.SUPER_ADMIN);

  form = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(3)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: new FormControl('', [Validators.required]),
    firstName: new FormControl(''),
    lastName: new FormControl(''),
    roleId: new FormControl<number | null>(null), // Optional - backend assigns default if not provided
  }, { validators: this.passwordMatchValidator });

  constructor(
    private settings: CoreService,
    private router: Router,
    private authService: AuthService,
    private notification: NotificationService
  ) {}

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const formGroup = control as FormGroup;
    const password = formGroup.get('password')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  get f() {
    return this.form.controls;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.errors?.['passwordMismatch']) {
        this.notification.error('Passwords do not match');
      }
      return;
    }

    this.isLoading = true;
    const { username, email, password, firstName, lastName, roleId } = this.form.value;

    const registerData: any = {
      username: username!,
      email: email!,
      password: password!,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    };

    // Include roleId if selected (backend may assign default role if not provided)
    if (roleId) {
      registerData.roleId = roleId;
    }

    this.authService.register(registerData).subscribe({
      next: (response) => {
        this.isLoading = false;
        // User is automatically logged in after registration
        // Check user role and redirect accordingly
        const user = response.user;
        let redirectUrl = '/dashboard';
        
        // Chefs go directly to kitchen, not dashboard
        if (user?.role === UserRole.CHEF) {
          redirectUrl = '/kitchen';
        }
        // Cashiers go directly to POS, not dashboard
        else if (user?.role === UserRole.CASHIER) {
          redirectUrl = '/pos';
        }
        
        this.router.navigate([redirectUrl]);
      },
      error: () => {
        this.isLoading = false;
        // Error is already handled by auth service
      }
    });
  }

  /**
   * Get display name for role
   */
  getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: 'Super Admin',
      [UserRole.ADMIN]: 'Admin',
      [UserRole.RESTAURANT_MANAGER]: 'Restaurant Manager',
      [UserRole.SHIFT_MANAGER]: 'Shift Manager',
      [UserRole.WAITER]: 'Waiter/Server',
      [UserRole.CASHIER]: 'Cashier',
      [UserRole.HOST]: 'Host/Hostess',
      [UserRole.CHEF]: 'Chef/Kitchen Staff',
      [UserRole.BARTENDER]: 'Bartender',
      [UserRole.DELIVERY_DRIVER]: 'Delivery Driver',
      [UserRole.INVENTORY_MANAGER]: 'Inventory Manager',
      [UserRole.ACCOUNTANT]: 'Accountant',
      [UserRole.SALES_STAFF]: 'Sales Staff',
      [UserRole.STORE_MANAGER]: 'Store Manager'
    };
    return roleNames[role] || role;
  }
}
