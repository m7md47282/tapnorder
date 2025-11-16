import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ApexOptions } from 'ng-apexcharts';

export interface FinancialTransaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod: string;
  reference?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  cashOnHand: number;
  accountsReceivable: number;
  accountsPayable: number;
}

@Component({
  selector: 'app-accounting-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule, NgApexchartsModule],
  templateUrl: './accounting-dashboard.component.html',
  styleUrls: ['./accounting-dashboard.component.scss']
})
export class AccountingDashboardComponent implements OnInit {
  dateRangeFilter = new FormControl('month');
  
  summary: FinancialSummary = {
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    cashOnHand: 0,
    accountsReceivable: 0,
    accountsPayable: 0
  };

  transactions: FinancialTransaction[] = [];
  filteredTransactions: FinancialTransaction[] = [];
  
  isLoading: boolean = false;

  // Chart options
  incomeExpenseChart: Partial<ApexOptions> = {
    series: [],
    chart: { type: 'bar', height: 350 },
    xaxis: { categories: [] },
    colors: []
  };
  categoryChart: Partial<ApexOptions> = {
    series: [],
    chart: { type: 'donut', height: 350 },
    labels: [],
    colors: []
  };

  // Mock data
  private mockTransactions: FinancialTransaction[] = [
    { id: '1', type: 'INCOME', category: 'Sales', description: 'Daily Sales', amount: 1250.50, date: new Date().toISOString(), paymentMethod: 'Cash' },
    { id: '2', type: 'EXPENSE', category: 'Supplies', description: 'Office Supplies', amount: 150.00, date: new Date().toISOString(), paymentMethod: 'Card' },
    { id: '3', type: 'INCOME', category: 'Sales', description: 'Daily Sales', amount: 980.25, date: new Date(Date.now() - 86400000).toISOString(), paymentMethod: 'Card' },
    { id: '4', type: 'EXPENSE', category: 'Rent', description: 'Monthly Rent', amount: 2000.00, date: new Date(Date.now() - 172800000).toISOString(), paymentMethod: 'Bank Transfer' },
    { id: '5', type: 'EXPENSE', category: 'Utilities', description: 'Electricity Bill', amount: 250.00, date: new Date(Date.now() - 259200000).toISOString(), paymentMethod: 'Card' },
  ];

  constructor(
    private api: ApiService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.initializeCharts();
  }

  loadData(): void {
    this.isLoading = true;

    // Mock API call
    setTimeout(() => {
      this.transactions = this.mockTransactions;
      this.filteredTransactions = this.transactions;
      this.calculateSummary();
      this.isLoading = false;
    }, 500);
  }

  calculateSummary(): void {
    this.summary.totalIncome = this.transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    
    this.summary.totalExpenses = this.transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
    
    this.summary.netProfit = this.summary.totalIncome - this.summary.totalExpenses;
    this.summary.cashOnHand = 5000; // Mock
    this.summary.accountsReceivable = 1200; // Mock
    this.summary.accountsPayable = 800; // Mock
  }

  initializeCharts(): void {
    this.incomeExpenseChart = {
      series: [
        {
          name: 'Income',
          data: [1250, 980, 1100, 1350, 1200]
        },
        {
          name: 'Expenses',
          data: [400, 300, 250, 200, 350]
        }
      ],
      chart: {
        type: 'bar',
        height: 350
      },
      xaxis: {
        categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      },
      colors: ['#4caf50', '#f44336']
    };

    this.categoryChart = {
      series: [44, 55, 13, 43, 22],
      chart: {
        type: 'donut',
        height: 350
      },
      labels: ['Sales', 'Rent', 'Supplies', 'Utilities', 'Other'],
      colors: ['#1976d2', '#4caf50', '#ff9800', '#f44336', '#9c27b0']
    };
  }

  addTransaction(): void {
    this.notification.info('Add transaction functionality coming soon');
  }

  exportReport(): void {
    this.notification.info('Export functionality coming soon');
  }
}

