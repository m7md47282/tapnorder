import { Component, Inject, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Product } from '../../../models/product.model';
import { CategoriesService } from '../../../services/categories.service';
import { ItemsService } from '../../../services/items.service';
import { InventoryService } from '../../../services/inventory.service'; // New
import { LocalStorageService } from '../../../services/local-storage.service';
import { Item, ItemRecipeIngredient } from '../../../models/item.model'; // Updated
import { Category } from '../../../models/category.model';
import { Inventory } from '../../../models/inventory.model'; // New
import { TenantContextService } from '../../../services/tenant-context.service';
import { PlaceService } from '../../../services/place.service';
import { PlaceBranch } from '../../../models/place.model';

export interface ProductFormData extends Partial<Product> {
  placeId: string; // Required, fetched from localStorage/tenant context, not in form
  branchId?: string | null; // Optional, visible to user
  imageFile?: File;
  imageBase64?: string;
  imageMimeType?: string;
  recipe?: ItemRecipeIngredient[]; // Updated to ItemRecipeIngredient
}

@Component({
  selector: 'app-product-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './product-form-dialog.component.html',
  styleUrls: ['./product-form-dialog.component.scss']
})
export class ProductFormDialogComponent implements OnInit {
  @ViewChild('categoryInput') categoryInput!: ElementRef<HTMLInputElement>;
  
  productForm: FormGroup;
  isEditMode: boolean = false;
  categories: Category[] = [];
  filteredCategories: Category[] = [];
  isLoadingCategories: boolean = false;
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  isUploadingImage: boolean = false;
  isLoadingProductData: boolean = false; // Loading state for full product data
  
  // Ingredients/Recipe management
  availableInventory: Inventory[] = []; // Now fetching from InventoryService
  isLoadingInventory: boolean = false;
  // Units now come from the inventory item's unit or generic if needed, but for simplicity we can let them choose or lock to inventory unit
  units: string[] = ['kilogram', 'gram', 'liter', 'milliliter', 'piece', 'cup'];

  // Branch selection
  availableBranches: PlaceBranch[] = [];
  isLoadingBranches: boolean = false;
  currentPlaceId: string | null = null; // Hidden from user, auto-filled

  constructor(
    public dialogRef: MatDialogRef<ProductFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product | null; menuId?: string | null; loadFullData?: boolean },
    private categoriesService: CategoriesService,
    private itemsService: ItemsService,
    private inventoryService: InventoryService, // Injected
    private localStorage: LocalStorageService,
    private cdr: ChangeDetectorRef,
    private tenantContext: TenantContextService,
    private placeService: PlaceService
  ) {
    this.isEditMode = !!data.product;
    
    this.productForm = new FormGroup({
      branchId: new FormControl(null), // Optional, visible, default to null (shared)
      name: new FormControl('', [Validators.required, Validators.minLength(3)]),
      description: new FormControl(''),
      // sku: new FormControl('', [Validators.required]), // SKU might be auto-generated or optional
      price: new FormControl('', [Validators.required, Validators.min(0)]),
      // cost: REMOVED - Calculated on backend
      // stock: REMOVED - Calculated on backend
      categoryId: new FormControl(''),
      image: new FormControl(''),
      imageFile: new FormControl(null),
      // taxRate: new FormControl(0.1, [Validators.min(0), Validators.max(1)]), // Optional/Default
      isActive: new FormControl(true),
      recipe: new FormArray([])
    });
  }

  ngOnInit(): void {
    // Initialize placeId from context (hidden from user)
    this.initializePlaceId();
    
    this.loadCategories();
    this.loadInventory(); // Load inventory items for recipe builder
    
    if (this.isEditMode && this.data.product) {
      const product = this.data.product;
      const placeId = product.placeId || this.currentPlaceId || '';
      
      // Populate form with available product data immediately
      this.productForm.patchValue({
        branchId: product.branchId || null,
        name: product.name,
        description: product.description || '',
        price: product.price,
        categoryId: product.categoryId || '',
        image: product.image || '',
        isActive: product.isActive
      });
      
      // Load branches for the place if editing
      if (placeId) {
        this.currentPlaceId = placeId;
        this.loadBranchesForPlace(placeId);
      }
      
      if (product.image) {
        this.imagePreview = product.image;
      }
      
      // If loadFullData flag is set, load full item data (including recipe) after dialog opens
      if (this.data.loadFullData && product.id) {
        this.loadFullProductData(product.id);
      } else {
        // Otherwise, try to load recipe from existing product data
        const productWithRecipe = product as any;
        if (productWithRecipe.recipe && productWithRecipe.recipe.length > 0) {
          while (this.recipeFormArray.length !== 0) {
            this.recipeFormArray.removeAt(0);
          }
          
          productWithRecipe.recipe.forEach((ingredient: ItemRecipeIngredient) => {
            this.addIngredient(ingredient);
          });
        }
      }
    } else {
      // For new items, load branches for the current place
      if (this.currentPlaceId) {
        this.loadBranchesForPlace(this.currentPlaceId);
      }
    }
  }

  /**
   * Load full product data including recipe after dialog is opened
   */
  private loadFullProductData(productId: string): void {
    this.isLoadingProductData = true;
    
    this.itemsService.getItemById(productId).subscribe({
      next: (item: Item) => {
        // Update form with any additional data from full item
        if (item.description !== undefined) {
          this.productForm.patchValue({ description: item.description });
        }
        if (item.price !== undefined) {
          this.productForm.patchValue({ price: item.price });
        }
        if (item.categoryId) {
          this.productForm.patchValue({ categoryId: item.categoryId });
        }
        if (item.branchId !== undefined) {
          this.productForm.patchValue({ branchId: item.branchId });
        }
        
        // Load recipe if it exists
        if (item.recipe && item.recipe.length > 0) {
          while (this.recipeFormArray.length !== 0) {
            this.recipeFormArray.removeAt(0);
          }
          
          item.recipe.forEach((ingredient: ItemRecipeIngredient) => {
            this.addIngredient(ingredient);
          });
        }
        
        this.isLoadingProductData = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading full product data:', error);
        this.isLoadingProductData = false;
        // Form already has basic data, so we can continue
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Initialize placeId from tenant context (hidden from user)
   */
  private initializePlaceId(): void {
    const currentPlaceId = this.tenantContext.getCurrentPlaceId();
    if (currentPlaceId) {
      this.currentPlaceId = currentPlaceId;
    } else {
      // If no place in context, try to get from user
      const user = this.localStorage.getUser<any>();
      if (user?.placeId) {
        this.currentPlaceId = user.placeId;
      }
    }
  }

  /**
   * Load branches for the current place
   */
  loadBranchesForPlace(placeId: string): void {
    console.log('Loading branches for place:', placeId);
    if (!placeId) {
      this.availableBranches = [];
      return;
    }

    this.isLoadingBranches = true;
    this.placeService.getBranches({ place_id: placeId }).subscribe({
      next: (branches) => {
        this.availableBranches = branches || [];
        this.isLoadingBranches = false;
      },
      error: (error) => {
        console.error('Error loading branches:', error);
        this.availableBranches = [];
        this.isLoadingBranches = false;
      }
    });
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    const menuId = this.data.menuId || this.localStorage.getItem<string>('menuId');
    const query: any = {};
    
    if (menuId) {
      query.menuId = menuId;
    }
    
    // Include placeId to filter categories by place
    const placeId = this.currentPlaceId || this.tenantContext.getCurrentPlaceId() || (this.localStorage.getUser<any>()?.placeId);
    if (placeId) {
      query.placeId = placeId;
    }

    this.categoriesService.getCategories(query).subscribe({
      next: (categories) => {
        this.categories = categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.filteredCategories = [...this.categories];
        this.isLoadingCategories = false;
        this.matchCategoryForEditMode();
        
        if (this.productForm.get('categoryId')?.value) {
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.isLoadingCategories = false;
      }
    });
  }

  private matchCategoryForEditMode(): void {
    if (!this.isEditMode || !this.data.product) return;
    const product = this.data.product;
    if (product.category && !product.categoryId) {
      const foundCategory = this.categories.find(cat => 
        cat.name?.toLowerCase() === product.category?.toLowerCase()
      );
      if (foundCategory) {
        this.productForm.patchValue({ categoryId: foundCategory.id });
      }
    }
  }

  get f() { return this.productForm.controls; }

  filterCategories(value: string): void {
    const filterValue = value?.toLowerCase() || '';
    this.filteredCategories = !filterValue 
      ? [...this.categories] 
      : this.categories.filter(cat => cat.name?.toLowerCase().includes(filterValue));
    }

  displayCategoryById = (categoryId: string | null | undefined): string => {
    if (!categoryId || !this.categories.length) return '';
    return this.categories.find(cat => cat.id === categoryId)?.name || '';
  }

  onCategorySelected(event: any): void {
    setTimeout(() => {
      if (this.categoryInput?.nativeElement) {
        this.categoryInput.nativeElement.blur();
      }
    }, 0);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      // Validation omitted for brevity, kept basic logic
      this.selectedImageFile = file;
      this.productForm.patchValue({ imageFile: file });
      const reader = new FileReader();
      reader.onload = (e: any) => { this.imagePreview = e.target.result; };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.productForm.patchValue({ imageFile: null, image: '' });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Load Inventory Items for Recipe Builder
   */
  loadInventory(): void {
    this.isLoadingInventory = true;
    // We might want to filter by placeId if available
    // const placeId = ... 
    this.inventoryService.getInventory({}).subscribe({
      next: (inventory) => {
        this.availableInventory = inventory;
        this.isLoadingInventory = false;
      },
      error: (error) => {
        console.error('Error loading inventory:', error);
        this.isLoadingInventory = false;
      }
    });
  }

  get recipeFormArray(): FormArray {
    return this.productForm.get('recipe') as FormArray;
  }

  /**
   * Add ingredient to recipe form
   */
  addIngredient(existing?: ItemRecipeIngredient): void {
    const group = new FormGroup({
      inventoryId: new FormControl(existing?.inventoryId || '', [Validators.required]),
      quantity: new FormControl(existing?.quantity || '', [Validators.required, Validators.min(0.0001)]),
      unit: new FormControl(existing?.unit || 'gram', [Validators.required])
    });
    
    // When inventory item changes, auto-set unit to that item's unit (optional UX enhancement)
    group.get('inventoryId')?.valueChanges.subscribe(id => {
      const invItem = this.availableInventory.find(i => i.id === id);
      if (invItem) {
        group.patchValue({ unit: invItem.unit }, { emitEvent: false });
      }
    });

    this.recipeFormArray.push(group);
  }

  removeIngredient(index: number): void {
    this.recipeFormArray.removeAt(index);
  }

  getInventoryName(id: string): string {
    return this.availableInventory.find(i => i.id === id)?.ingredientName || '';
  }

  onCancel(): void {
    this.dialogRef.close();
  }
  
  async onSubmit(): Promise<void> {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const formValue = this.productForm.value;
    
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    
    if (this.selectedImageFile) {
      try {
        this.isUploadingImage = true;
        imageBase64 = await this.fileToBase64(this.selectedImageFile);
        imageMimeType = this.selectedImageFile.type;
      } catch (error) {
        console.error('Error converting file to base64:', error);
        this.isUploadingImage = false;
        return;
      }
    }

    // Construct Recipe Array
    const recipe: ItemRecipeIngredient[] = formValue.recipe.map((r: any) => ({
      inventoryId: r.inventoryId,
      ingredientName: this.getInventoryName(r.inventoryId),
      quantity: Number(r.quantity),
      unit: r.unit
    }));

    // Get placeId from tenant context or localStorage (not from form)
    const placeId = this.currentPlaceId || this.tenantContext.getCurrentPlaceId() || (this.localStorage.getUser<any>()?.placeId);
    
    if (!placeId) {
      console.error('Place ID is required to create item');
      return;
    }

    const productData: ProductFormData = {
      placeId: placeId,
      branchId: formValue.branchId || null, // null means shared
      name: formValue.name,
      description: formValue.description,
      // sku: formValue.sku,
      price: Number(formValue.price),
      categoryId: formValue.categoryId || undefined,
      image: formValue.image,
      imageBase64: imageBase64,
      imageMimeType: imageMimeType,
      imageFile: this.selectedImageFile || undefined,
      isActive: formValue.isActive,
      recipe: recipe.length > 0 ? recipe : undefined
    };

    this.isUploadingImage = false;
    this.dialogRef.close(productData);
  }
}
