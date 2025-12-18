import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { UserService } from '../../../services/user.service';
import { NotificationService } from '../../../services/notification.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { EmployeeFormDialogComponent } from '../employee-form-dialog/employee-form-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { User, UserRole, AdminCreateUserPayload } from '../../../models/user.model';
import { TenantContextService } from '../../../services/tenant-context.service';
import { LocalStorageService } from '../../../services/local-storage.service';

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './hr-dashboard.component.html',
  styleUrls: ['./hr-dashboard.component.scss']
})
export class HrDashboardComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['employee', 'email', 'role', 'status', 'actions'];
  dataSource = new MatTableDataSource<User>([]);
  
  searchControl = new FormControl('');
  roleFilter = new FormControl('all');
  statusFilter = new FormControl('all');
  
  availableRoles: UserRole[] = [];
  isLoading: boolean = false;
  
  totalEmployees: number = 0;
  activeEmployees: number = 0;
  currentPlaceId: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private userService: UserService,
    private notification: NotificationService,
    private dialog: MatDialog,
    private tenantContext: TenantContextService,
    private localStorage: LocalStorageService
  ) {}

  ngOnInit(): void {
    this.currentPlaceId = this.tenantContext.getCurrentPlaceId() || 
                          this.localStorage.getUser<any>()?.placeId || 
                          null;
    this.loadEmployees();
    this.setupFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupFilters(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.applyFilters();
      });

    this.roleFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });

    this.statusFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  loadEmployees(): void {
    this.isLoading = true;

    const params: any = {};
    if (this.currentPlaceId) {
      params.placeId = this.currentPlaceId;
    }

    this.userService.getUsers(params).subscribe({
      next: (users) => {
        this.dataSource.data = users;
        this.updateRoles();
        this.calculateStats();
        this.setupTable();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading employees:', error);
        this.notification.error('Failed to load staff accounts');
        this.isLoading = false;
      }
    });
  }

  setupTable(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = this.customFilterPredicate;
  }

  customFilterPredicate = (data: User, filter: string): boolean => {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    const role = this.roleFilter.value || 'all';
    const status = this.statusFilter.value || 'all';

    const matchesSearch: boolean = !searchTerm ||
      (data.firstName || '').toLowerCase().includes(searchTerm) ||
      (data.lastName || '').toLowerCase().includes(searchTerm) ||
      data.email.toLowerCase().includes(searchTerm) ||
      data.username.toLowerCase().includes(searchTerm) ||
      this.getRoleDisplayName(data.role).toLowerCase().includes(searchTerm);

    const matchesRole: boolean = role === 'all' || data.role === role;
    const matchesStatus: boolean = status === 'all' || 
      (status === 'active' && data.isActive) ||
      (status === 'inactive' && !data.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  };

  applyFilters(): void {
    this.dataSource.filter = Math.random().toString();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.calculateStats();
  }

  updateRoles(): void {
    const roles = new Set(this.dataSource.data.map(u => u.role));
    this.availableRoles = Array.from(roles).sort();
  }

  calculateStats(): void {
    this.totalEmployees = this.dataSource.data.length;
    this.activeEmployees = this.dataSource.data.filter(u => u.isActive).length;
  }

  addEmployee(): void {
    const dialogRef = this.dialog.open(EmployeeFormDialogComponent, {
      width: '600px',
      data: { user: null }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.createEmployee(result);
      }
    });
  }

  editEmployee(user: User): void {
    const dialogRef = this.dialog.open(EmployeeFormDialogComponent, {
      width: '600px',
      data: { user: { ...user } }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateEmployee(user.id, result);
      }
    });
  }

  deleteEmployee(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Staff Account',
        message: `Are you sure you want to delete "${this.getFullName(user)}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;
        this.userService.deleteUser(user.id).subscribe({
          next: () => {
            this.dataSource.data = this.dataSource.data.filter(u => u.id !== user.id);
            this.setupTable();
            this.calculateStats();
            this.isLoading = false;
            this.notification.success('Staff account deleted successfully');
          },
          error: (error) => {
            console.error('Error deleting user:', error);
            this.isLoading = false;
            this.notification.error('Failed to delete staff account');
          }
        });
      }
    });
  }

  createEmployee(userData: AdminCreateUserPayload & { isActive: boolean }): void {
    this.isLoading = true;
    
    // Remove isActive from payload as it's handled separately
    const { isActive, ...payload } = userData;
    
    this.userService.createUser(payload).subscribe({
      next: (user) => {
        // If user should be inactive, deactivate them
        if (!isActive) {
          this.userService.deactivateUser(user.id).subscribe({
            next: (deactivatedUser) => {
              this.dataSource.data = [...this.dataSource.data, deactivatedUser];
              this.updateRoles();
              this.setupTable();
              this.calculateStats();
              this.isLoading = false;
              this.notification.success('Staff account created successfully');
            },
            error: () => {
              // User created but deactivation failed - still add to list
              this.dataSource.data = [...this.dataSource.data, user];
              this.updateRoles();
              this.setupTable();
              this.calculateStats();
              this.isLoading = false;
              this.notification.success('Staff account created, but failed to set status');
            }
          });
        } else {
          this.dataSource.data = [...this.dataSource.data, user];
          this.updateRoles();
          this.setupTable();
          this.calculateStats();
          this.isLoading = false;
          this.notification.success('Staff account created successfully');
        }
      },
      error: (error) => {
        console.error('Error creating user:', error);
        this.isLoading = false;
        this.notification.error('Failed to create staff account');
      }
    });
  }

  updateEmployee(userId: string, userData: AdminCreateUserPayload & { isActive: boolean }): void {
    this.isLoading = true;
    
    // Remove isActive from payload as it's handled separately
    const { isActive, password, ...payloadWithoutPassword } = userData;
    
    // Only include password if it was provided
    const payload: Partial<AdminCreateUserPayload> = password 
      ? { ...payloadWithoutPassword, password }
      : payloadWithoutPassword;
    
    this.userService.updateUser(userId, payload).subscribe({
      next: (updatedUser) => {
        // Update active status if needed
        const currentUser = this.dataSource.data.find(u => u.id === userId);
        if (currentUser && currentUser.isActive !== isActive) {
          const statusUpdate = isActive 
            ? this.userService.activateUser(userId)
            : this.userService.deactivateUser(userId);
          
          statusUpdate.subscribe({
            next: (userWithStatus) => {
              const index = this.dataSource.data.findIndex(u => u.id === userId);
              if (index !== -1) {
                this.dataSource.data[index] = userWithStatus;
                this.dataSource.data = [...this.dataSource.data];
                this.setupTable();
                this.calculateStats();
                this.isLoading = false;
                this.notification.success('Staff account updated successfully');
              }
            },
            error: () => {
              // Update succeeded but status change failed
              const index = this.dataSource.data.findIndex(u => u.id === userId);
              if (index !== -1) {
                this.dataSource.data[index] = updatedUser;
                this.dataSource.data = [...this.dataSource.data];
                this.setupTable();
                this.calculateStats();
                this.isLoading = false;
                this.notification.success('Staff account updated, but failed to update status');
              }
            }
          });
        } else {
          const index = this.dataSource.data.findIndex(u => u.id === userId);
          if (index !== -1) {
            this.dataSource.data[index] = updatedUser;
            this.dataSource.data = [...this.dataSource.data];
            this.setupTable();
            this.calculateStats();
            this.isLoading = false;
            this.notification.success('Staff account updated successfully');
          }
        }
      },
      error: (error) => {
        console.error('Error updating user:', error);
        this.isLoading = false;
        this.notification.error('Failed to update staff account');
      }
    });
  }

  toggleStatus(user: User): void {
    const newStatus = !user.isActive;
    this.isLoading = true;

    const statusUpdate = newStatus 
      ? this.userService.activateUser(user.id)
      : this.userService.deactivateUser(user.id);

    statusUpdate.subscribe({
      next: (updatedUser) => {
        const index = this.dataSource.data.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.dataSource.data[index] = updatedUser;
          this.dataSource.data = [...this.dataSource.data];
          this.calculateStats();
          this.isLoading = false;
          this.notification.success(`Staff account ${newStatus ? 'activated' : 'deactivated'} successfully`);
        }
      },
      error: (error) => {
        console.error('Error updating user status:', error);
        this.isLoading = false;
        this.notification.error(`Failed to ${newStatus ? 'activate' : 'deactivate'} staff account`);
      }
    });
  }

  getStatusColor(isActive: boolean): string {
    return isActive ? 'primary' : 'warn';
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  getFullName(user: User): string {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username || user.email;
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
}

