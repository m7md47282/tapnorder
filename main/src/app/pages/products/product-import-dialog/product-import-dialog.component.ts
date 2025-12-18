import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ItemsService } from '../../../services/items.service';
import { CategoriesService } from '../../../services/categories.service';
import { NotificationService } from '../../../services/notification.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { TenantContextService } from '../../../services/tenant-context.service';
import { PlaceService } from '../../../services/place.service';
import { CreateItemCommand } from '../../../models/item.model';
import { Category } from '../../../models/category.model';
import { PlaceBranch } from '../../../models/place.model';
import { forkJoin, of, firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as XLSX from 'xlsx';

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

@Component({
  selector: 'app-product-import-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './product-import-dialog.component.html',
  styleUrls: ['./product-import-dialog.component.scss']
})
export class ProductImportDialogComponent implements OnInit {
  selectedFile: File | null = null;
  parsedData: any[] = [];
  parsedDataWithMeta: Array<{ item: CreateItemCommand; categoryId: string; categoryValid: boolean; rowNumber: number }> = [];
  isProcessing: boolean = false;
  importResult: ImportResult | null = null;
  previewData: any[] = [];
  showPreview: boolean = false;
  categories: Category[] = [];
  categoryMap: Map<string, Category> = new Map(); // Map categoryId -> Category
  categoryNameMap: Map<string, string> = new Map(); // Map category name -> categoryId
  isLoadingCategories: boolean = false;
  
  // Branch selection
  availableBranches: PlaceBranch[] = [];
  branchMap: Map<string, PlaceBranch> = new Map(); // Map branchId -> PlaceBranch
  branchNameMap: Map<string, string> = new Map(); // Map branch name -> branchId
  isLoadingBranches: boolean = false;
  selectedBranchId: string | null = null; // null means shared across all branches

  // Expected Excel columns - categoryId or category (name) are both acceptable
  // branchId or branch (name) are both acceptable
  expectedColumns = ['name', 'description', 'price', 'isAvailable'];
  requiredCategoryColumn = 'categoryId'; // Will accept 'category' or 'categoryId'
  optionalColumns = ['imageUrl', 'preparationTime', 'ingredients', 'branchId', 'branch'];

  private placeId: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<ProductImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { menuId?: string | null; placeId?: string | null },
    private itemsService: ItemsService,
    private categoriesService: CategoriesService,
    private notification: NotificationService,
    private localStorage: LocalStorageService,
    private tenantContext: TenantContextService,
    private placeService: PlaceService
  ) {}

  ngOnInit(): void {
    // Initialize placeId from data, tenant context, or localStorage
    this.placeId = this.data.placeId || 
                   this.tenantContext.getCurrentPlaceId() || 
                   this.localStorage.getUser<any>()?.placeId || 
                   null;
    this.loadCategories();
    if (this.placeId) {
      this.loadBranches();
    }
  }

  loadBranches(): void {
    if (!this.placeId) {
      return;
    }
    this.isLoadingBranches = true;
    this.placeService.getBranches({ place_id: this.placeId }).subscribe({
      next: (branches) => {
        this.availableBranches = branches || [];
        this.buildBranchMap();
        this.isLoadingBranches = false;
      },
      error: (error) => {
        console.error('Error loading branches:', error);
        this.availableBranches = [];
        this.buildBranchMap();
        this.isLoadingBranches = false;
      }
    });
  }

  private buildBranchMap(): void {
    this.branchMap.clear();
    this.branchNameMap.clear();
    this.availableBranches.forEach(branch => {
      this.branchMap.set(branch.id, branch);
      this.branchNameMap.set(branch.name, branch.id);
    });
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    const menuId = this.data.menuId || this.localStorage.getItem<string>('menuId');
    console.log('this is the loadcategories function');
    const query: any = {};
    
    if (menuId) {
      query.menuId = menuId;
    }
    
    // Include placeId to filter categories by place
    if (this.placeId) {
      query.placeId = this.placeId;
    }
    
    this.categoriesService.getCategories(query).subscribe({
      next: (categories) => {
        if (Array.isArray(categories)) {
          this.categories = categories;
        } else {
          console.warn('Categories response is not an array:', categories);
          this.categories = [];
        }
        this.buildCategoryMap();
        this.updatePreviewDataWithCategories();
        this.isLoadingCategories = false;
      },
      error: (error) => {
        console.error('Error loading categories from API:', error);
        this.categories = [];
        this.buildCategoryMap();
        this.updatePreviewDataWithCategories();
        this.isLoadingCategories = false;
      }
    });
  }

  private buildCategoryMap(): void {
    this.categoryMap.clear();
    this.categoryNameMap.clear();
    this.categories.forEach(cat => {
      this.categoryMap.set(cat.id, cat);
      this.categoryNameMap.set(cat.name, cat.id);
    });
  }

  /**
   * Update preview data with category information when categories are loaded
   */
  private updatePreviewDataWithCategories(): void {
    if (this.previewData.length === 0 || this.categoryMap.size === 0) {
      return;
    }

    this.previewData.forEach((previewItem, index) => {
      if (previewItem.categoryId) {
        const category = this.categoryMap.get(previewItem.categoryId);
        if (category) {
          previewItem.categoryValid = true;
          previewItem.categoryName = category.name;
          previewItem.category = category.name;
        } else {
          previewItem.categoryValid = false;
        }
      }
    });
  }

  private generateCategoryId(categoryName: string): string {
    return categoryName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.parseExcel();
    }
  }

  parseExcel(): void {
    if (!this.selectedFile) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        if (!worksheet) {
          this.notification.error('Excel file is empty or invalid');
          return;
        }

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        
        if (jsonData.length === 0) {
          this.notification.error('Excel file is empty');
          return;
        }

        // Parse header - normalize to lowercase and handle variations
        const rawHeaders = (jsonData[0] || []).map((h: any) => String(h).trim());
        const headerMap: { [key: string]: string } = {};
        const normalizedHeaders: string[] = [];
        
        rawHeaders.forEach((rawHeader: string) => {
          const normalized = rawHeader.toLowerCase().replace(/[_\s]/g, '');
          headerMap[normalized] = rawHeader; // Keep original for display
          normalizedHeaders.push(normalized);
        });
        
        // Validate headers - check if required columns exist (case-insensitive, ignoring underscores/spaces)
        const normalizedRequired = this.expectedColumns.map(col => col.toLowerCase().replace(/[_\s]/g, ''));
        const missingRequired = normalizedRequired.filter(col => !normalizedHeaders.includes(col));
        
        // Check for category column (either categoryId or category)
        const hasCategoryId = normalizedHeaders.includes('categoryid');
        const hasCategory = normalizedHeaders.includes('category');
        const hasCategoryColumn = hasCategoryId || hasCategory;
        
        if (missingRequired.length > 0 || !hasCategoryColumn) {
          const missingCols = this.expectedColumns.filter(col => 
            normalizedRequired.includes(col.toLowerCase().replace(/[_\s]/g, '')) && 
            missingRequired.includes(col.toLowerCase().replace(/[_\s]/g, ''))
          );
          if (!hasCategoryColumn) {
            missingCols.push('categoryId or category');
          }
          this.notification.error(`Missing required columns: ${missingCols.join(', ')}`);
          return;
        }

        // Parse data rows
        this.parsedData = [];
        this.parsedDataWithMeta = [];
        this.previewData = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const rowData = jsonData[i] || [];
          if (rowData.length === 0 || rowData.every((v: any) => !String(v).trim())) {
            continue; // Skip empty rows
          }

          const row: any = {};
          normalizedHeaders.forEach((normalizedHeader, index) => {
            const value = String(rowData[index] || '').trim();
            
            // Convert to appropriate types based on normalized header
            if (normalizedHeader === 'price') {
              row.price = parseFloat(value) || 0;
            } else if (normalizedHeader === 'preparationtime') {
              row.preparationTime = parseInt(value) || undefined;
            } else if (normalizedHeader === 'isavailable') {
              row.isAvailable = this.parseBoolean(value);
            } else if (normalizedHeader === 'ingredients') {
              // Parse ingredients as comma-separated array
              row.ingredients = value ? value.split(',').map((ing: string) => ing.trim()).filter((ing: string) => ing) : [];
            } else if (normalizedHeader === 'imageurl' || normalizedHeader === 'image') {
              row.imageUrl = value || undefined;
            } else if (normalizedHeader === 'name') {
              row.name = value;
            } else if (normalizedHeader === 'description') {
              row.description = value;
            } else if (normalizedHeader === 'categoryid' || normalizedHeader === 'category') {
              // Accept both categoryId and category (name)
              // Store the raw value - we'll process it below
              row.categoryRaw = value;
            } else if (normalizedHeader === 'branchid' || normalizedHeader === 'branch') {
              // Accept both branchId and branch (name)
              // Store the raw value - we'll process it below
              row.branchRaw = value;
            }
          });

          // Process category - match category name from import with existing categories
          // The import will contain category names (from dropdown), we need to match them
          // and save the category ID (not the category name)
          let categoryId = '';
          let categoryName = '';
          let category: Category | undefined;
          
          if (row.categoryRaw) {
            const rawValue = String(row.categoryRaw).trim();
            
            // First, try to find by ID (in case someone imports with ID)
            category = this.categoryMap.get(rawValue);
            if (category) {
              categoryId = category.id;
              categoryName = category.name;
            } else {
              // If not found by ID, try to find by name (case-insensitive)
              // This is the main use case: category name from dropdown
              const normalizedRawValue = rawValue.toLowerCase().trim();
              
              // Try exact match first (case-insensitive)
              let foundCategoryId: string | undefined;
              for (const [name, id] of this.categoryNameMap.entries()) {
                if (name.toLowerCase().trim() === normalizedRawValue) {
                  foundCategoryId = id;
                  break;
                }
              }
              
              if (foundCategoryId) {
                category = this.categoryMap.get(foundCategoryId);
                if (category) {
                  categoryId = category.id;
                  categoryName = category.name;
                }
              } else {
                // Category name not found in existing categories
                categoryName = rawValue;
                categoryId = ''; // No valid category ID found
              }
            }
          }
          
          const categoryValid = !!category;
          
          if (!category && row.categoryRaw) {
            // Category not found - add to errors but still allow import
            console.warn(`Category "${row.categoryRaw}" not found in system categories`);
          }

          // Map to CreateItemCommand format
          // Always use categoryId when a match is found, never use category name
          if (!this.placeId) {
            throw new Error('Place ID is required to import items');
          }
          
          // Process branch - match branch name from import with existing branches
          // The import will contain branch names (from dropdown), we need to match them
          // and save the branch ID (not the branch name)
          let branchId: string | null = null;
          let branchName = '';
          let branch: PlaceBranch | undefined;
          
          if (row.branchRaw) {
            const rawValue = String(row.branchRaw).trim();
            
            // Handle empty string or "Shared" as null (shared across all branches)
            if (rawValue === '' || rawValue.toLowerCase() === 'shared' || rawValue.toLowerCase() === 'shared (all branches)') {
              branchId = null;
            } else {
              // First, try to find by ID (in case someone imports with ID)
              branch = this.branchMap.get(rawValue);
              if (branch) {
                branchId = branch.id;
                branchName = branch.name;
              } else {
                // If not found by ID, try to find by name (case-insensitive)
                // This is the main use case: branch name from dropdown
                const normalizedRawValue = rawValue.toLowerCase().trim();
                
                // Try exact match first (case-insensitive)
                let foundBranchId: string | undefined;
                for (const [name, id] of this.branchNameMap.entries()) {
                  if (name.toLowerCase().trim() === normalizedRawValue) {
                    foundBranchId = id;
                    break;
                  }
                }
                
                if (foundBranchId) {
                  branch = this.branchMap.get(foundBranchId);
                  if (branch) {
                    branchId = branch.id;
                    branchName = branch.name;
                  }
                } else {
                  // Branch name not found in existing branches
                  branchName = rawValue;
                  branchId = null; // Invalid branch, treat as shared
                  console.warn(`Branch "${rawValue}" not found in system branches`);
                }
              }
            }
          } else {
            // No branch specified in row, use selected branch or null (shared)
            branchId = this.selectedBranchId || null;
          }
          
          const itemCommand: CreateItemCommand = {
            name: row.name || '',
            description: row.description || '',
            price: row.price || 0,
            imageUrl: row.imageUrl || undefined,
            isAvailable: row.isAvailable !== undefined ? row.isAvailable : true,
            preparationTime: row.preparationTime || undefined,
            ingredients: row.ingredients || undefined,
            menuId: this.data.menuId || undefined,
            placeId: this.placeId, // Required - items are linked to place
            branchId: branchId // If provided, item is branch-specific; if null, shared across all branches
          };
          
          // Always use categoryId when category is found (matched by name or ID)
          // Only use category name as fallback if no match found (for backward compatibility)
          if (category && categoryId) {
            // Category was matched - use categoryId (not category name)
            itemCommand.categoryId = categoryId;
          } else if (categoryName && !category) {
            // Category name provided but not found in existing categories
            // Fallback: use category name (for backward compatibility, but should be avoided)
            itemCommand.category = categoryName;
          }

          this.parsedData.push(itemCommand);
          
          // Store metadata for all items
          this.parsedDataWithMeta.push({
            item: itemCommand,
            categoryId: categoryId,
            categoryValid: categoryValid,
            rowNumber: i + 1 // +1 because header is row 1
          });
          
          // Store preview data (first 5 rows) with category and branch info for display
          if (i <= 6) {
            this.previewData.push({
              ...itemCommand,
              rowNumber: i + 1,
              categoryId: categoryId,
              categoryName: categoryName || row.categoryRaw || 'Uncategorized',
              categoryValid: categoryValid,
              branchName: branchName || (branchId ? this.branchMap.get(branchId)?.name : 'Shared (All Branches)') || 'Shared (All Branches)',
              branchId: branchId
            });
          }
        }

        if (this.parsedData.length === 0) {
          this.notification.error('No valid data rows found in Excel file');
          return;
        }

        // Validate category IDs after all data is parsed
        const invalidCategoryIds = this.parsedDataWithMeta
          .filter(meta => meta.categoryId && !meta.categoryValid)
          .map(meta => ({ row: meta.rowNumber, categoryId: meta.categoryId }));

        if (invalidCategoryIds.length > 0) {
          const invalidIds = invalidCategoryIds.slice(0, 10).map(i => `Row ${i.row}: "${i.categoryId}"`).join(', ');
          const moreText = invalidCategoryIds.length > 10 ? ` and ${invalidCategoryIds.length - 10} more` : '';
          this.notification.warning(`Found ${invalidCategoryIds.length} products with invalid category IDs: ${invalidIds}${moreText}`);
        }

        this.showPreview = true;
        this.notification.success(`Successfully parsed ${this.parsedData.length} products`);
      } catch (error: any) {
        console.error('Error parsing Excel:', error);
        this.notification.error(`Error parsing Excel file: ${error.message}`);
      }
    };

    reader.readAsArrayBuffer(this.selectedFile);
  }

  private parseBoolean(value: string): boolean {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'y';
  }

  private async loadXLSXPopulate(): Promise<any> {
    // Try dynamic import with different access patterns
    try {
      const module = await import('xlsx-populate');
      const mod = module as any;
      
      console.log('xlsx-populate module structure:', Object.keys(mod));
      console.log('module.default:', mod.default);
      console.log('module.fromBlankAsync:', typeof mod.fromBlankAsync);
      
      // Try direct access first (CommonJS exports)
      if (typeof mod.fromBlankAsync === 'function') {
        return mod;
      }
      
      // Try default export
      if (mod.default) {
        const defaultExport = mod.default;
        if (typeof defaultExport.fromBlankAsync === 'function') {
          return defaultExport;
        }
        // Sometimes CommonJS modules wrap in { default: { ... } }
        if (defaultExport.default && typeof defaultExport.default.fromBlankAsync === 'function') {
          return defaultExport.default;
        }
      }
      
      // Try accessing through namespace
      if (mod.xlsxPopulate && typeof mod.xlsxPopulate.fromBlankAsync === 'function') {
        return mod.xlsxPopulate;
      }
      
      throw new Error(`Could not find fromBlankAsync. Available keys: ${Object.keys(mod).join(', ')}`);
    } catch (error) {
      console.error('Error loading xlsx-populate:', error);
      throw error;
    }
  }

  async downloadTemplate(): Promise<void> {
    try {
      // Load branches if not already loaded
      if (this.placeId && this.availableBranches.length === 0) {
        await firstValueFrom(
          this.placeService.getBranches({ place_id: this.placeId }).pipe(
            catchError((error) => {
              console.error('Error loading branches:', error);
              return of([]);
            })
          )
        ).then(branches => {
          this.availableBranches = branches || [];
        });
      }
      
      // Fetch categories directly using categoriesService
      if (this.categories.length === 0) {
        this.notification.info('Loading categories...');
        try {
          const query: any = {};
          // Include placeId to filter categories by place
          if (this.placeId) {
            query.placeId = this.placeId;
          }
          
          const fetchedCategories = await firstValueFrom(
            this.categoriesService.getCategories(query).pipe(
              catchError((error) => {
                console.error('Error loading categories:', error);
                return of([]); // Return empty array on error
              })
            )
          );
          
          if (Array.isArray(fetchedCategories)) {
            this.categories = fetchedCategories;
            this.buildCategoryMap();
          } else {
            this.categories = [];
          }
          
          if (this.categories.length === 0) {
            this.notification.warning('No categories found. The template will be created without category dropdowns. You can still manually enter category names.');
          }
        } catch (error) {
          console.error('Error fetching categories:', error);
          this.notification.warning('Failed to load categories. The template will be created without category dropdowns.');
          this.categories = [];
        }
      }

      // Load xlsx-populate module
      const XLSXPopulate = await this.loadXLSXPopulate();
      
      // Create a new workbook using xlsx-populate
      const workbook = await XLSXPopulate.fromBlankAsync();
      
      // Get the default sheet and rename it to Products
      const productsSheet = workbook.sheet(0);
      productsSheet.name('Products');
      
      // Set headers - use 'category' and 'branch' as header names since dropdowns show names
      const headers = ['name', 'description', 'price', 'category', 'isAvailable', 'imageUrl', 'preparationTime', 'ingredients', 'branch'];
      headers.forEach((header, index) => {
        productsSheet.cell(1, index + 1).value(header);
        productsSheet.cell(1, index + 1).style({ bold: true, fill: '4472C4', fontColor: 'FFFFFF' });
      });
      
      // Get example category name for the example row
      const exampleCategoryName = this.categories.length > 0 ? this.categories[0].name : 'Enter Category Name';
      
      // Get example branch name for the example row (or leave empty for shared)
      const exampleBranchName = this.availableBranches.length > 0 ? this.availableBranches[0].name : '';
      
      // Add example row with category name and branch name
      const exampleRow = ['Sample Product', 'Product description', 10.99, exampleCategoryName, true, 'https://example.com/image.jpg', 15, 'ingredient1, ingredient2', exampleBranchName];
      exampleRow.forEach((value, index) => {
        productsSheet.cell(2, index + 1).value(value);
      });
      
      // Set column widths
      productsSheet.column(1).width(20); // name
      productsSheet.column(2).width(30); // description
      productsSheet.column(3).width(10); // price
      productsSheet.column(4).width(25); // category (with dropdown if available)
      productsSheet.column(5).width(12); // isAvailable
      productsSheet.column(6).width(30); // imageUrl
      productsSheet.column(7).width(15); // preparationTime
      productsSheet.column(8).width(30); // ingredients
      productsSheet.column(9).width(25); // branch (with dropdown if available)
      
      // Create Branches sheet with all available branches (always create, even if empty)
      const branchesSheet = workbook.addSheet('Branches');
      branchesSheet.cell(1, 1).value('Branch Name');
      branchesSheet.cell(1, 2).value('Branch ID');
      branchesSheet.cell(1, 1).style({ bold: true, fill: 'FFC000', fontColor: 'FFFFFF' });
      branchesSheet.cell(1, 2).style({ bold: true, fill: 'FFC000', fontColor: 'FFFFFF' });
      
      // Add "Shared (All Branches)" option at the top
      branchesSheet.cell(2, 1).value('Shared (All Branches)');
      branchesSheet.cell(2, 2).value('');
      
      // Add branch data (names in column A for dropdown, IDs in column B for reference)
      this.availableBranches.forEach((branch, index) => {
        branchesSheet.cell(index + 3, 1).value(branch.name);
        branchesSheet.cell(index + 3, 2).value(branch.id);
      });
      
      branchesSheet.column(1).width(30);
      branchesSheet.column(2).width(25);
      
      // Add data validation dropdown to branch column (column I, rows 2-1000)
      // Use column A (Branch Name) for the dropdown values to show names, not IDs
      const branchRangeFormula = `Branches!$A$2:$A$${this.availableBranches.length + 2}`; // Include "Shared" option
      
      // Apply data validation to each cell in the range
      for (let row = 2; row <= 1000; row++) {
        const cell = productsSheet.cell(row, 9); // Column I (branch column)
        cell.dataValidation({
          type: 'list',
          allowBlank: true,
          showInputMessage: true,
          promptTitle: 'Branch Selection',
          prompt: 'Select a branch name from the dropdown (or leave empty for shared items). See Branches sheet for reference.',
          showErrorMessage: false,
          formula1: branchRangeFormula
        });
      }
      
      // Only create dropdown if categories are available
      if (this.categories.length > 0) {
        // Create Categories sheet with all available categories
        const categoriesSheet = workbook.addSheet('Categories');
        categoriesSheet.cell(1, 1).value('Category Name');
        categoriesSheet.cell(1, 2).value('Category ID');
        categoriesSheet.cell(1, 1).style({ bold: true, fill: '70AD47', fontColor: 'FFFFFF' });
        categoriesSheet.cell(1, 2).style({ bold: true, fill: '70AD47', fontColor: 'FFFFFF' });
        
        // Add category data (names in column A for dropdown, IDs in column B for reference)
        this.categories.forEach((cat, index) => {
          categoriesSheet.cell(index + 2, 1).value(cat.name);
          categoriesSheet.cell(index + 2, 2).value(cat.id);
        });
        
        categoriesSheet.column(1).width(30);
        categoriesSheet.column(2).width(25);
        
        // Add data validation dropdown to category column (column D, rows 2-1000)
        // The dropdown will show category names from the Categories sheet
        const categoryRangeFormula = `Categories!$A$2:$A$${this.categories.length + 1}`;
        
        // Apply data validation to each cell in the range (xlsx-populate requires cell-level validation)
        for (let row = 2; row <= 1000; row++) {
          const cell = productsSheet.cell(row, 4); // Column D (category column)
          cell.dataValidation({
            type: 'list',
            allowBlank: false,
            showInputMessage: true,
            promptTitle: 'Category Selection',
            prompt: 'Click the dropdown arrow to select a category from the list',
            showErrorMessage: true,
            errorStyle: 'stop',
            errorTitle: 'Invalid Category',
            error: 'Please select a valid category from the dropdown list',
            formula1: categoryRangeFormula
          });
        }
      } else {
        // No categories available - add a note in the Categories sheet
        const categoriesSheet = workbook.addSheet('Categories');
        categoriesSheet.cell(1, 1).value('Note');
        categoriesSheet.cell(2, 1).value('No categories found. You can manually enter category names in the category column.');
        categoriesSheet.cell(1, 1).style({ bold: true, fill: 'FF9800', fontColor: 'FFFFFF' });
        categoriesSheet.column(1).width(60);
      }
      
      // Generate file and download
      const blob = await workbook.outputAsync();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'product-import-template.xlsx';
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (this.categories.length > 0) {
        this.notification.success(`Excel template downloaded! The category column has a dropdown list with ${this.categories.length} available categories. Click on any cell in the category column to see the dropdown.`);
      } else {
        this.notification.success('Excel template downloaded! Note: No categories were found, so you can manually enter category names in the category column.');
      }
    } catch (error: any) {
      console.error('Error creating Excel template:', error);
      this.notification.error('Failed to create Excel template. Please try again.');
    }
  }

  importProducts(): void {
    if (this.parsedData.length === 0) {
      this.notification.error('No products to import');
      return;
    }

    this.isProcessing = true;
    this.importResult = null;

    // Create all items in parallel (or sequentially if preferred)
    const importObservables = this.parsedData.map((item, index) => 
      this.itemsService.createItem(item).pipe(
        map(() => ({ success: true, index })),
        catchError((error) => {
          console.error(`Error importing row ${index + 2}:`, error);
          return of({ 
            success: false, 
            index, 
            error: error.message || 'Unknown error',
            itemName: item.name 
          });
        })
      )
    );

    forkJoin(importObservables).subscribe({
      next: (results) => {
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
        const errors = results
          .filter(r => !r.success)
          .map(r => `Row ${(r.index + 2)} (${(r as any).itemName || 'Unknown'}): ${(r as any).error || 'Unknown error'}`);

        this.importResult = {
          success: successCount,
          failed: failedCount,
          errors
        };

        this.isProcessing = false;

        if (failedCount === 0) {
          this.notification.success(`Successfully imported ${successCount} products`);
        } else {
          this.notification.warning(`Imported ${successCount} products, ${failedCount} failed`);
        }
      },
      error: (error) => {
        console.error('Error during import:', error);
        this.isProcessing = false;
        this.notification.error('Error importing products');
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onClose(): void {
    this.dialogRef.close(this.importResult);
  }

  /**
   * Update category for a specific row in the preview
   * @param rowIndex - Index in previewData array
   * @param categoryId - Selected category ID
   */
  updateCategoryForRow(rowIndex: number, categoryId: string): void {
    if (rowIndex < 0 || rowIndex >= this.previewData.length) {
      return;
    }

    const category = this.categoryMap.get(categoryId);
    if (!category) {
      return;
    }

    // Update preview data
    const previewItem = this.previewData[rowIndex];
    previewItem.categoryId = categoryId;
    previewItem.categoryName = category.name;
    previewItem.categoryValid = true;
    previewItem.category = category.name;

    // Find corresponding item in parsedDataWithMeta and update it
    const rowNumber = previewItem.rowNumber;
    const metaIndex = this.parsedDataWithMeta.findIndex(m => m.rowNumber === rowNumber);
    
    if (metaIndex !== -1) {
      const meta = this.parsedDataWithMeta[metaIndex];
      meta.categoryId = categoryId;
      meta.categoryValid = true;
      meta.item.category = category.name;
      
      // Update corresponding item in parsedData
      const dataIndex = this.parsedData.findIndex((_, idx) => idx === metaIndex);
      if (dataIndex !== -1) {
        this.parsedData[dataIndex].category = category.name;
      }
    }
  }

  /**
   * Get category name by ID
   */
  getCategoryNameById(categoryId: string): string {
    const category = this.categoryMap.get(categoryId);
    return category ? category.name : '';
  }

  /**
   * Get the current category ID for a row, defaulting to first category if invalid
   */
  getCurrentCategoryIdForRow(item: any): string {
    if (item.categoryId && item.categoryValid && this.categoryMap.has(item.categoryId)) {
      return item.categoryId;
    }
    // Return first category ID if available, or empty string
    return this.categories.length > 0 ? this.categories[0].id : '';
  }
}

