import { Component, Inject, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Product } from '../../../models/product.model';
import { CategoriesService } from '../../../services/categories.service';
import { ItemsService } from '../../../services/items.service';
import { LocalStorageService } from '../../../services/local-storage.service';
import { Item, ItemIngredient } from '../../../models/item.model';
import { Category } from '../../../models/category.model';

export interface ProductFormData extends Partial<Product> {
  imageFile?: File;
  imageBase64?: string;
  imageMimeType?: string;
  recipe?: ItemIngredient[]; // Recipe with ingredients (Products from inventory)
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
  
  // Ingredients/Recipe management
  availableProducts: Item[] = []; // Products from inventory that can be used as ingredients
  isLoadingProducts: boolean = false;
  units: string[] = ['ml', 'g', 'kg', 'l', 'piece', 'cup', 'tbsp', 'tsp', 'oz', 'lb'];

  constructor(
    public dialogRef: MatDialogRef<ProductFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product | null; menuId?: string | null },
    private categoriesService: CategoriesService,
    private itemsService: ItemsService,
    private localStorage: LocalStorageService,
    private cdr: ChangeDetectorRef
  ) {
    this.isEditMode = !!data.product;
    
    this.productForm = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(3)]),
      description: new FormControl(''),
      sku: new FormControl('', [Validators.required]),
      barcode: new FormControl(''),
      price: new FormControl('', [Validators.required, Validators.min(0)]),
      cost: new FormControl('', [Validators.min(0)]),
      stock: new FormControl('', [Validators.required, Validators.min(0)]),
      categoryId: new FormControl(''),
      image: new FormControl(''), // Keep for edit mode (existing URL)
      imageFile: new FormControl(null), // For new file uploads
      taxRate: new FormControl(0.1, [Validators.min(0), Validators.max(1)]),
      unit: new FormControl(''),
      isActive: new FormControl(true),
      recipe: new FormArray([]) // Form array for ingredients
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadAvailableProducts();
    
    if (this.isEditMode && this.data.product) {
      this.productForm.patchValue({
        name: this.data.product.name,
        description: this.data.product.description || '',
        sku: this.data.product.sku,
        barcode: this.data.product.barcode || '',
        price: this.data.product.price,
        cost: this.data.product.cost || '',
        stock: this.data.product.stock,
        categoryId: this.data.product.categoryId || '',
        image: this.data.product.image || '',
        taxRate: this.data.product.taxRate || 0.1,
        unit: this.data.product.unit || '',
        isActive: this.data.product.isActive
      });
      
      // Set preview if image URL exists
      if (this.data.product.image) {
        this.imagePreview = this.data.product.image;
      }
      
      // Load recipe if it exists in the product data
      const productWithRecipe = this.data.product as Product & { recipe?: ItemIngredient[] };
      if (productWithRecipe.recipe && productWithRecipe.recipe.length > 0) {
        // Clear existing recipe form array
        while (this.recipeFormArray.length !== 0) {
          this.recipeFormArray.removeAt(0);
        }
        
        // Add each ingredient to the form array
        productWithRecipe.recipe.forEach(ingredient => {
          const ingredientGroup = new FormGroup({
            productId: new FormControl(ingredient.productId, [Validators.required]),
            quantity: new FormControl(ingredient.quantity, [Validators.required, Validators.min(0.01)]),
            unit: new FormControl(ingredient.unit, [Validators.required])
          });
          this.recipeFormArray.push(ingredientGroup);
        });
      }
    }
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    
    // Get menuId from data or localStorage
    const menuId = this.data.menuId || this.localStorage.getItem<string>('menuId');
    
    // Build query - menuId is optional
    const query: any = {};
    if (menuId) {
      query.menuId = menuId;
    }

    // Get categories directly from categories API
    this.categoriesService.getCategories(query).subscribe({
      next: (categories) => {
        this.categories = categories.sort((a, b) => {
          const nameA = a.name?.toLowerCase() || '';
          const nameB = b.name?.toLowerCase() || '';
          return nameA.localeCompare(nameB);
        });
        this.filteredCategories = [...this.categories];
        this.isLoadingCategories = false;
        
        // Handle category matching for edit mode
        this.matchCategoryForEditMode();
        
        // Update the display of category field if it has a value
        // This ensures the category name is displayed after categories are loaded
        const currentCategoryId = this.productForm.get('categoryId')?.value;
        if (currentCategoryId) {
          // Force change detection to update the autocomplete display
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.categories = [];
        this.filteredCategories = [];
        this.isLoadingCategories = false;
      }
    });
  }

  /**
   * Match category for edit mode when product has category name but no categoryId
   */
  private matchCategoryForEditMode(): void {
    if (!this.isEditMode || !this.data.product) {
      return;
    }

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

  get f() {
    return this.productForm.controls;
  }

  /**
   * Filter categories based on input value
   */
  filterCategories(value: string): void {
    const filterValue = value?.toLowerCase() || '';
    if (!filterValue) {
      this.filteredCategories = [...this.categories];
    } else {
      // Filter by category name (for user typing)
      this.filteredCategories = this.categories.filter(cat => 
        cat.name?.toLowerCase().includes(filterValue)
      );
    }
  }

  /**
   * Display category name in autocomplete by ID
   * This function is called by mat-autocomplete to display the category name
   * when the form control value is a category ID
   */
  displayCategoryById = (categoryId: string | null | undefined): string => {
    if (!categoryId) {
      return '';
    }
    if (!this.categories || this.categories.length === 0) {
      // Categories not loaded yet, return empty to avoid showing ID
      return '';
    }
    const category = this.categories.find(cat => cat.id === categoryId);
    return category?.name || '';
  }

  /**
   * Handle category selection and close autocomplete
   */
  onCategorySelected(event: any): void {
    // The category ID is automatically set to the form control by mat-autocomplete
    // The displayCategoryById function will be called to show the category name
    // Close the autocomplete panel by blurring the input field
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
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.productForm.get('imageFile')?.setErrors({ invalidType: true });
        return;
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.productForm.get('imageFile')?.setErrors({ maxSize: true });
        return;
      }
      
      this.selectedImageFile = file;
      this.productForm.patchValue({ imageFile: file });
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.productForm.patchValue({ 
      imageFile: null,
      image: '' 
    });
  }


  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix if present (keep only base64)
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Load available Products (Items from inventory) that can be used as ingredients
   */
  loadAvailableProducts(): void {
    this.isLoadingProducts = true;
    
    // Get menuId from data or localStorage
    const menuId = this.data.menuId || this.localStorage.getItem<string>('menuId');
    
    // Build query - load all items that can be used as ingredients
    const query: any = { 
      isAvailable: true // Only load available items
    };
    
    if (menuId) {
      query.menuId = menuId;
    }
    
    this.itemsService.getItems(query).subscribe({
      next: (items) => {
        // Filter items that can be used as ingredients (inventory products)
        // For now, we'll use all items, but you could filter by category or flag
        this.availableProducts = items;
        this.isLoadingProducts = false;
      },
      error: (error) => {
        console.error('Error loading products for ingredients:', error);
        this.availableProducts = [];
        this.isLoadingProducts = false;
      }
    });
  }

  /**
   * Get the recipe FormArray
   */
  get recipeFormArray(): FormArray {
    return this.productForm.get('recipe') as FormArray;
  }

  /**
   * Add a new ingredient to the recipe
   */
  addIngredient(): void {
    const ingredientGroup = new FormGroup({
      productId: new FormControl('', [Validators.required]),
      quantity: new FormControl('', [Validators.required, Validators.min(0.01)]),
      unit: new FormControl('ml', [Validators.required])
    });
    
    this.recipeFormArray.push(ingredientGroup);
  }

  /**
   * Remove an ingredient from the recipe
   */
  removeIngredient(index: number): void {
    this.recipeFormArray.removeAt(index);
  }

  /**
   * Get product name by ID for display
   */
  getProductName(productId: string): string {
    const product = this.availableProducts.find(p => p.id === productId);
    return product ? product.name : '';
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
    
    // Convert file to base64 if a new file is selected
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

    // Build recipe array from form array
    const recipe: ItemIngredient[] = formValue.recipe.map((ing: any) => ({
      productId: ing.productId,
      productName: this.getProductName(ing.productId),
      quantity: parseFloat(ing.quantity),
      unit: ing.unit
    }));

    // Only save categoryId, not category name
    // The backend should use categoryId to look up the category
    const productData: ProductFormData = {
      name: formValue.name,
      description: formValue.description,
      sku: formValue.sku,
      barcode: formValue.barcode,
      price: parseFloat(formValue.price),
      cost: formValue.cost ? parseFloat(formValue.cost) : undefined,
      stock: parseInt(formValue.stock),
      categoryId: formValue.categoryId || undefined, // Only save categoryId
      image: formValue.image, // Existing URL (for edit mode)
      imageBase64: imageBase64, // New file base64 data
      imageMimeType: imageMimeType, // MIME type for new file
      imageFile: this.selectedImageFile || undefined, // File reference
      taxRate: parseFloat(formValue.taxRate),
      unit: formValue.unit,
      isActive: formValue.isActive,
      recipe: recipe.length > 0 ? recipe : undefined // Include recipe if ingredients exist
    };

    this.isUploadingImage = false;
    this.dialogRef.close(productData);
  }
}

