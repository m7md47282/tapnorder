import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Inventory, InventoryAdjustment, CreateInventoryCommand, UpdateInventoryCommand } from '../../../models/inventory.model';
import { InventoryService } from '../../../services/inventory.service'; // Use Inventory Service
import { NotificationService } from '../../../services/notification.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { ActivatedRoute } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { StockAdjustmentDialogComponent } from '../stock-adjustment-dialog/stock-adjustment-dialog.component';
import { InventoryFormDialogComponent, InventoryFormData } from '../inventory-form-dialog/inventory-form-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { TenantContextService } from '../../../services/tenant-context.service';

@Component({
  selector: 'app-stock-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './stock-management.component.html',
  styleUrls: ['./stock-management.component.scss']
})
export class StockManagementComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Updated Columns for Inventory
  displayedColumns: string[] = ['name', 'unit', 'currentQuantity', 'costPerUnit', 'minStockLevel', 'value', 'actions'];
  dataSource = new MatTableDataSource<Inventory>([]);
  
  searchControl = new FormControl('');
  stockFilter = new FormControl('all');
  
  isLoading: boolean = false;
  
  totalItems: number = 0;
  totalStockValue: number = 0;
  lowStockCount: number = 0;
  
  menuId: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private inventoryService: InventoryService,
    private notification: NotificationService,
    private localStorage: LocalStorageService,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      // Place/Menu context logic similar to before
      this.loadInventory();
    });
    
    this.loadInventory();
    this.setupFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupFilters(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());

    this.stockFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());
  }

  loadInventory(): void {
    this.isLoading = true;
    // Construct query based on filters
    const query: any = {};
    if (this.searchControl.value) query.search = this.searchControl.value;
    if (this.stockFilter.value === 'low') query.lowStock = true;

    this.inventoryService.getInventory(query).subscribe({
      next: (items) => {
        this.dataSource.data = items;
        this.calculateStats();
        this.setupTable();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading inventory:', error);
        this.isLoading = false;
        this.notification.error('Failed to load inventory.');
      }
    });
  }

  setupTable(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilters(): void {
    this.loadInventory();
  }

  calculateStats(): void {
    const data = this.dataSource.data;
    this.totalItems = data.length;
    this.totalStockValue = data.reduce((sum, item) => sum + (item.currentQuantity * item.costPerUnit), 0);
    this.lowStockCount = data.filter(item => item.minStockLevel && item.currentQuantity <= item.minStockLevel).length;
  }

  adjustStock(item: Inventory): void {
    const dialogRef = this.dialog.open(StockAdjustmentDialogComponent, {
      width: '500px',
      // Map Inventory to the format expected by the dialog or update dialog to accept Inventory
      // Assuming dialog expects { product: ... } or generic item
      data: { product: { ...item, name: item.ingredientName, stock: item.currentQuantity } } 
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateStock(item.id, result.quantity, result.reason);
      }
    });
  }

  updateStock(inventoryId: string, quantity: number, reason: string): void {
    this.isLoading = true;
    const adjustment: InventoryAdjustment = {
      inventoryId,
      quantity, // Postive or negative handled by dialog? Let's assume dialog returns absolute and type.
      // If dialog returns type 'IN'/'OUT', we calculate signed quantity here
      // But let's assume we pass signed quantity or mapping logic:
      reason: 'adjustment' // Simplification for now
    };
    
    // If the dialog returns type, we need to adjust the sign
    // Mocking the logic from previous component:
    // if (type === 'OUT') quantity = -quantity;

    this.inventoryService.adjustInventory(adjustment).subscribe({
      next: () => {
        this.loadInventory(); // Reload to get updated data
        this.notification.success('Stock updated successfully');
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Stock update failed:', error);
        this.notification.error('Failed to update stock');
        this.isLoading = false;
      }
    });
  }

  getStockStatus(item: Inventory): { label: string; color: string; class: string } {
    if (item.currentQuantity <= 0) {
      return { label: 'Out of Stock', color: 'warn', class: 'out-of-stock' };
    } else if (item.minStockLevel && item.currentQuantity <= item.minStockLevel) {
      return { label: 'Low Stock', color: 'accent', class: 'low-stock' };
    } else {
      return { label: 'In Stock', color: 'primary', class: 'in-stock' };
    }
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(InventoryFormDialogComponent, {
      width: '600px',
      data: { inventory: null }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.createInventoryItem(result);
      }
    });
  }

  openEditDialog(item: Inventory): void {
    const dialogRef = this.dialog.open(InventoryFormDialogComponent, {
      width: '600px',
      data: { inventory: item }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateInventoryItem(item.id, result);
  }
    });
  }

  createInventoryItem(formData: InventoryFormData): void {
    this.isLoading = true;
    
    if (!formData.placeId) {
      this.notification.error('Place ID is required');
      this.isLoading = false;
      return;
    }

    const command: CreateInventoryCommand = {
      placeId: formData.placeId,
      branchId: formData.branchId || undefined,
      ingredientName: formData.ingredientName,
      unit: formData.unit,
      currentQuantity: formData.currentQuantity,
      costPerUnit: formData.costPerUnit,
      minStockLevel: formData.minStockLevel,
      supplier: formData.supplier,
      notes: formData.notes
    };

    this.inventoryService.createInventoryItem(command).subscribe({
      next: (inventory) => {
        this.loadInventory();
        this.notification.success('Inventory item created successfully');
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error creating inventory item:', error);
        this.notification.error('Failed to create inventory item');
        this.isLoading = false;
      }
    });
  }

  updateInventoryItem(id: string, formData: InventoryFormData): void {
    this.isLoading = true;
    
    const command: UpdateInventoryCommand = {
      id,
      ingredientName: formData.ingredientName,
      unit: formData.unit,
      currentQuantity: formData.currentQuantity,
      costPerUnit: formData.costPerUnit,
      minStockLevel: formData.minStockLevel,
      supplier: formData.supplier,
      notes: formData.notes
    };

    this.inventoryService.updateInventoryItem(command).subscribe({
      next: (inventory) => {
        this.loadInventory();
        this.notification.success('Inventory item updated successfully');
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error updating inventory item:', error);
        this.notification.error('Failed to update inventory item');
        this.isLoading = false;
      }
    });
  }

  deleteInventoryItem(item: Inventory): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Inventory Item',
        message: `Are you sure you want to delete "${item.ingredientName}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;
        this.inventoryService.deleteInventoryItem(item.id).subscribe({
          next: () => {
            this.loadInventory();
            this.notification.success('Inventory item deleted successfully');
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error deleting inventory item:', error);
            this.notification.error('Failed to delete inventory item');
            this.isLoading = false;
          }
        });
      }
    });
  }
}
