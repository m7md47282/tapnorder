import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Employee } from '../hr-dashboard/hr-dashboard.component';

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
  departments: string[] = ['Management', 'Sales', 'Inventory', 'Finance', 'HR', 'IT', 'Other'];
  positions: string[] = ['Store Manager', 'Cashier', 'Inventory Manager', 'Accountant', 'HR Manager', 'IT Support', 'Other'];

  constructor(
    public dialogRef: MatDialogRef<EmployeeFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { employee: Employee | null }
  ) {
    this.isEditMode = !!data.employee;
    
    this.employeeForm = new FormGroup({
      firstName: new FormControl('', [Validators.required]),
      lastName: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl('', [Validators.required]),
      position: new FormControl('', [Validators.required]),
      department: new FormControl('', [Validators.required]),
      hireDate: new FormControl('', [Validators.required]),
      salary: new FormControl('', [Validators.min(0)]),
      status: new FormControl('ACTIVE', [Validators.required])
    });
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.employee) {
      const employee = this.data.employee;
      this.employeeForm.patchValue({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        position: employee.position,
        department: employee.department,
        hireDate: employee.hireDate.split('T')[0],
        salary: employee.salary || '',
        status: employee.status
      });
    } else {
      // Set default hire date to today
      this.employeeForm.patchValue({
        hireDate: new Date().toISOString().split('T')[0]
      });
    }
  }

  get f() {
    return this.employeeForm.controls;
  }

  onSubmit(): void {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    const formValue = this.employeeForm.value;
    const employeeData: Partial<Employee> = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      phone: formValue.phone,
      position: formValue.position,
      department: formValue.department,
      hireDate: new Date(formValue.hireDate).toISOString(),
      salary: formValue.salary ? parseFloat(formValue.salary) : undefined,
      status: formValue.status
    };

    this.dialogRef.close(employeeData);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

