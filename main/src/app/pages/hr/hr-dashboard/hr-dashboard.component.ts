import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { EmployeeFormDialogComponent } from '../employee-form-dialog/employee-form-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  hireDate: string;
  salary?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  avatar?: string;
}

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

  displayedColumns: string[] = ['employee', 'employeeId', 'position', 'department', 'hireDate', 'status', 'actions'];
  dataSource = new MatTableDataSource<Employee>([]);
  
  searchControl = new FormControl('');
  departmentFilter = new FormControl('all');
  statusFilter = new FormControl('all');
  
  departments: string[] = ['all'];
  isLoading: boolean = false;
  
  totalEmployees: number = 0;
  activeEmployees: number = 0;
  
  private destroy$ = new Subject<void>();

  // Mock data
  private mockEmployees: Employee[] = [
    {
      id: '1',
      employeeId: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      position: 'Store Manager',
      department: 'Management',
      hireDate: new Date('2023-01-15').toISOString(),
      salary: 5000,
      status: 'ACTIVE',
      avatar: '/assets/images/profile/user-1.jpg'
    },
    {
      id: '2',
      employeeId: 'EMP002',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+1234567891',
      position: 'Cashier',
      department: 'Sales',
      hireDate: new Date('2023-03-20').toISOString(),
      salary: 3000,
      status: 'ACTIVE',
      avatar: '/assets/images/profile/user-2.jpg'
    },
    {
      id: '3',
      employeeId: 'EMP003',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@example.com',
      phone: '+1234567892',
      position: 'Inventory Manager',
      department: 'Inventory',
      hireDate: new Date('2023-02-10').toISOString(),
      salary: 4000,
      status: 'ACTIVE',
      avatar: '/assets/images/profile/user-3.jpg'
    },
    {
      id: '4',
      employeeId: 'EMP004',
      firstName: 'Alice',
      lastName: 'Williams',
      email: 'alice.williams@example.com',
      phone: '+1234567893',
      position: 'Accountant',
      department: 'Finance',
      hireDate: new Date('2023-05-01').toISOString(),
      salary: 4500,
      status: 'ON_LEAVE',
      avatar: '/assets/images/profile/user-4.jpg'
    }
  ];

  constructor(
    private api: ApiService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
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

    this.departmentFilter.valueChanges
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

    // Mock API call
    setTimeout(() => {
      this.dataSource.data = this.mockEmployees;
      this.updateDepartments();
      this.calculateStats();
      this.setupTable();
      this.isLoading = false;
    }, 500);
  }

  setupTable(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = this.customFilterPredicate;
  }

  customFilterPredicate = (data: Employee, filter: string): boolean => {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    const department = this.departmentFilter.value || 'all';
    const status = this.statusFilter.value || 'all';

    const matchesSearch: boolean = !searchTerm ||
      data.firstName.toLowerCase().includes(searchTerm) ||
      data.lastName.toLowerCase().includes(searchTerm) ||
      data.employeeId.toLowerCase().includes(searchTerm) ||
      data.email.toLowerCase().includes(searchTerm) ||
      data.position.toLowerCase().includes(searchTerm);

    const matchesDepartment: boolean = department === 'all' || data.department === department;
    const matchesStatus: boolean = status === 'all' || data.status === status;

    return matchesSearch && matchesDepartment && matchesStatus;
  };

  applyFilters(): void {
    this.dataSource.filter = Math.random().toString();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.calculateStats();
  }

  updateDepartments(): void {
    const depts = new Set(this.dataSource.data.map(e => e.department));
    this.departments = ['all', ...Array.from(depts).sort()];
  }

  calculateStats(): void {
    this.totalEmployees = this.dataSource.data.length;
    this.activeEmployees = this.dataSource.data.filter(e => e.status === 'ACTIVE').length;
  }

  addEmployee(): void {
    const dialogRef = this.dialog.open(EmployeeFormDialogComponent, {
      width: '600px',
      data: { employee: null }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.createEmployee(result);
      }
    });
  }

  editEmployee(employee: Employee): void {
    const dialogRef = this.dialog.open(EmployeeFormDialogComponent, {
      width: '600px',
      data: { employee: { ...employee } }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateEmployee(employee.id, result);
      }
    });
  }

  deleteEmployee(employee: Employee): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Employee',
        message: `Are you sure you want to delete "${employee.firstName} ${employee.lastName}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;
        setTimeout(() => {
          this.dataSource.data = this.dataSource.data.filter(e => e.id !== employee.id);
          this.setupTable();
          this.calculateStats();
          this.isLoading = false;
          this.notification.success('Employee deleted successfully');
        }, 500);
      }
    });
  }

  createEmployee(employeeData: Partial<Employee>): void {
    this.isLoading = true;
    const newEmployee: Employee = {
      ...employeeData as Employee,
      id: Date.now().toString(),
      employeeId: 'EMP' + String(this.dataSource.data.length + 1).padStart(3, '0')
    };

    setTimeout(() => {
      this.dataSource.data = [...this.dataSource.data, newEmployee];
      this.updateDepartments();
      this.setupTable();
      this.calculateStats();
      this.isLoading = false;
      this.notification.success('Employee created successfully');
    }, 500);
  }

  updateEmployee(id: string, employeeData: Partial<Employee>): void {
    this.isLoading = true;
    setTimeout(() => {
      const index = this.dataSource.data.findIndex(e => e.id === id);
      if (index !== -1) {
        this.dataSource.data[index] = { ...this.dataSource.data[index], ...employeeData };
        this.dataSource.data = [...this.dataSource.data];
        this.setupTable();
        this.calculateStats();
        this.isLoading = false;
        this.notification.success('Employee updated successfully');
      }
    }, 500);
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'ACTIVE': 'primary',
      'INACTIVE': 'warn',
      'ON_LEAVE': 'accent'
    };
    return colors[status] || 'primary';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getFullName(employee: Employee): string {
    return `${employee.firstName} ${employee.lastName}`;
  }
}

