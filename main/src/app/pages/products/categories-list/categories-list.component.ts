import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Category } from '../../../models/category.model';
import { CategoriesService } from '../../../services/categories.service';
import { ItemsService } from '../../../services/items.service';
import { NotificationService } from '../../../services/notification.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { ActivatedRoute } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { CategoryFormDialogComponent } from '../category-form-dialog/category-form-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { Item } from '../../../models/item.model';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './categories-list.component.html',
  styleUrls: ['./categories-list.component.scss']
})
export class CategoriesListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['icon', 'name', 'description', 'itemCount', 'status', 'actions'];
  dataSource = new MatTableDataSource<Category>([]);
  
  searchControl = new FormControl('');
  statusFilter = new FormControl('all');
  
  isLoading: boolean = false;
  menuId: string | null = null; // Menu ID for categories API
  
  private destroy$ = new Subject<void>();

  constructor(
    private categoriesService: CategoriesService,
    private itemsService: ItemsService,
    private notification: NotificationService,
    private localStorage: LocalStorageService,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Get menuId from route params or localStorage
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const newMenuId = params['menuId'] || this.localStorage.getItem<string>('menuId') || null;
      if (newMenuId !== this.menuId) {
        this.menuId = newMenuId;
        if (this.menuId) {
          this.localStorage.setItem('menuId', this.menuId);
        }
        this.loadCategories();
      }
    });
    
    // If no menuId in route, try localStorage
    if (!this.menuId) {
      this.menuId = this.localStorage.getItem<string>('menuId');
    }
    
    this.loadCategories();
    this.setupFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupFilters(): void {
    // Search filter
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.applyFilters();
      });

    // Status filter
    this.statusFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  loadCategories(): void {
    this.isLoading = true;

    // Build query - menuId is optional
    const query: any = {};
    
    if (this.menuId) {
      query.menuId = this.menuId;
    }

    // Get categories from API
    this.categoriesService.getCategories(query).subscribe({
      next: (categories) => {
        // Get item counts if menuId is available
        if (this.menuId) {
          this.categoriesService.getCategoriesWithCounts(this.menuId).subscribe({
            next: (categoriesWithCounts) => {
              this.dataSource.data = categoriesWithCounts;
              this.setupTable();
              this.isLoading = false;
            },
            error: () => {
              // Fallback to categories without counts
              this.dataSource.data = categories;
              this.setupTable();
              this.isLoading = false;
            }
          });
        } else {
          this.dataSource.data = categories;
          this.setupTable();
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.dataSource.data = [];
        this.setupTable();
        this.isLoading = false;
        this.notification.error('Failed to load categories from the database. Please try again.');
      }
    });
  }

  setupTable(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = this.customFilterPredicate;
  }

  customFilterPredicate = (data: Category, filter: string): boolean => {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    const status = this.statusFilter.value || 'all';

    // Search filter
    const matchesSearch: boolean = !searchTerm ||
      data.name.toLowerCase().includes(searchTerm) ||
      (data.description?.toLowerCase().includes(searchTerm) ?? false);

    // Status filter
    const matchesStatus: boolean = status === 'all' ||
      (status === 'active' && data.isActive) ||
      (status === 'inactive' && !data.isActive);

    return matchesSearch && matchesStatus;
  };

  applyFilters(): void {
    this.dataSource.filter = Math.random().toString();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(CategoryFormDialogComponent, {
      width: '500px',
      data: { category: null, menuId: this.menuId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.createCategory(result);
      }
    });
  }

  openEditDialog(category: Category): void {
    const dialogRef = this.dialog.open(CategoryFormDialogComponent, {
      width: '500px',
      data: { category: { ...category }, menuId: this.menuId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateCategory(category, result);
      }
    });
  }

  createCategory(categoryData: Partial<Category>): void {
    if (!categoryData.name) {
      this.notification.error('Category name is required');
      return;
    }

    this.isLoading = true;

    const command: any = {
      name: categoryData.name,
      description: categoryData.description,
      imageUrl: categoryData.imageUrl,
      displayOrder: categoryData.displayOrder,
      isActive: categoryData.isActive !== undefined ? categoryData.isActive : true
    };

    // Only include menuId if it's available
    if (this.menuId) {
      command.menuId = this.menuId;
    }

    this.categoriesService.createCategory(command).subscribe({
      next: () => {
        this.notification.success('Category created successfully');
        this.loadCategories();
      },
      error: (error) => {
        console.error('Error creating category:', error);
        this.isLoading = false;
        this.notification.error('Failed to create category. Please try again.');
      }
    });
  }

  updateCategory(oldCategory: Category, newCategoryData: Partial<Category>): void {
    if (!oldCategory.id) {
      this.notification.error('Category ID is required');
      return;
    }

    this.isLoading = true;

    const command = {
      id: oldCategory.id,
      name: newCategoryData.name,
      description: newCategoryData.description,
      imageUrl: newCategoryData.imageUrl,
      displayOrder: newCategoryData.displayOrder,
      isActive: newCategoryData.isActive
    };

    this.categoriesService.updateCategory(command).subscribe({
      next: () => {
        this.notification.success('Category updated successfully');
        this.loadCategories();
      },
      error: (error) => {
        console.error('Error updating category:', error);
        this.isLoading = false;
        this.notification.error('Failed to update category. Please try again.');
      }
    });
  }

  deleteCategory(category: Category): void {
    if (!category.id) {
      this.notification.error('Category ID is required');
      return;
    }

    // Check if category has items
    if (category.itemCount && category.itemCount > 0) {
      this.notification.warning(`Cannot delete category "${category.name}" because it has ${category.itemCount} item(s). Please remove or reassign items first.`);
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Category',
        message: `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoading = true;
        this.categoriesService.deleteCategory(category.id!).subscribe({
          next: () => {
            this.notification.success('Category deleted successfully');
            this.loadCategories();
          },
          error: (error) => {
            console.error('Error deleting category:', error);
            this.isLoading = false;
            this.notification.error('Failed to delete category. Please try again.');
          }
        });
      }
    });
  }

  getStatusColor(status: boolean | undefined): string {
    return status ? 'primary' : 'warn';
  }

  getStatusLabel(status: boolean | undefined): string {
    return status ? 'Active' : 'Inactive';
  }

  getCategoryIcon(category: Category): string {
    return category.icon || this.categoriesService.getCategoryIcon(category.name);
  }
}

