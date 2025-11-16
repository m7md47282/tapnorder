import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';
import { NotificationService } from 'src/app/services/notification.service';
import { UserRole } from 'src/app/models/user.model';

@Component({
  selector: 'app-side-login',
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './side-login.component.html',
  styleUrl: './side-login.component.scss',
})
export class AppSideLoginComponent {
  form = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(3)]),
    password: new FormControl('', [Validators.required]),
    rememberMe: new FormControl(false),
  });

  isLoading = false;
  returnUrl: string = '/dashboard';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private notification: NotificationService
  ) {
    // Get return url from route parameters or default to '/'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
  }

  get f() {
    return this.form.controls;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { username, password, rememberMe } = this.form.value;

    this.authService.login(
      {
        username: username!,
        password: password!,
      },
      rememberMe || false
    ).subscribe({
      next: () => {
        this.isLoading = false;
        // Check user role and redirect accordingly
        const user = this.authService.getCurrentUser();
        let redirectUrl = this.returnUrl;
        
        // Chefs go directly to kitchen, not dashboard
        if (user?.role === UserRole.CHEF) {
          redirectUrl = '/kitchen';
        }
        // Cashiers go directly to POS, not dashboard
        else if (user?.role === UserRole.CASHIER) {
          redirectUrl = '/pos';
        }
        // For other users, use the returnUrl (defaults to /dashboard)
        
        this.router.navigate([redirectUrl]);
      },
      error: (error) => {
        this.isLoading = false;
        // Error is already handled by auth service
      }
    });
  }
}
