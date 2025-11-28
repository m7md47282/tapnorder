import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { AddonsService } from '../../../services/addons.service';
import {
  AddonGroup,
  AddonOption,
  CreateAddonGroupCommand,
  UpdateAddonGroupCommand
} from '../../../models/addon.model';
import { CategoriesService } from '../../../services/categories.service';
import { Category } from '../../../models/category.model';
import { ItemsService } from '../../../services/items.service';
import { Item } from '../../../models/item.model';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-addon-groups',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './addon-groups.component.html',
  styleUrls: ['./addon-groups.component.scss']
})
export class AddonGroupsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private addonsService = inject(AddonsService);
  private categoriesService = inject(CategoriesService);
  private itemsService = inject(ItemsService);
  private notification = inject(NotificationService);

  protected readonly selectionTypeOptions = [
    { value: 'single', label: 'Single select (radio)' },
    { value: 'multiple', label: 'Multi select (checkbox)' },
    { value: 'quantity', label: 'Quantity based (steppers)' }
  ];

  groups = signal<AddonGroup[]>([]);
  filteredGroups = computed(() => {
    const term = (this.search.value ?? '').trim().toLowerCase();
    if (!term) {
      return this.groups();
    }
    return this.groups().filter(group =>
      [group.name, group.description]
        .filter(Boolean)
        .some(val => (val ?? '').toLowerCase().includes(term))
    );
  });

  categories: Category[] = [];
  items: Item[] = [];
  currency = 'JOD';

  isLoading = signal(false);
  editingGroup: AddonGroup | null = null;

  search = this.fb.control('');

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    selectionType: ['single', Validators.required],
    minSelect: [0],
    maxSelect: [1],
    isRequired: [false],
    isActive: [true],
    appliesToCategoryIds: [[]],
    appliesToItemIds: [[]],
    options: this.fb.array([])
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  get optionsArray(): FormArray<FormGroup> {
    return this.form.get('options') as FormArray<FormGroup>;
  }

  addOption(option?: AddonOption): void {
    this.optionsArray.push(this.createOptionGroup(option));
  }

  removeOption(index: number): void {
    this.optionsArray.removeAt(index);
  }

  onSubmit(): void {
    if (this.form.invalid || this.optionsArray.length === 0) {
      this.form.markAllAsTouched();
      this.notification.warning('Please complete the required fields and add at least one option.');
      return;
    }

    const payload = this.buildPayloadFromForm();
    if (!payload) {
      return;
    }

    this.isLoading.set(true);

    if (this.editingGroup) {
      const updatePayload: UpdateAddonGroupCommand = {
        ...payload,
        id: this.editingGroup.id
      };
      this.addonsService.updateAddonGroup(this.editingGroup.id, updatePayload).subscribe({
        next: () => {
          this.notification.success('Addon group updated.');
          this.resetForm();
          this.loadGroups();
        },
        error: (error) => {
          console.error(error);
          this.notification.error('Failed to update addon group.');
          this.isLoading.set(false);
        }
      });
    } else {
      this.addonsService.createAddonGroup(payload).subscribe({
        next: () => {
          this.notification.success('Addon group created.');
          this.resetForm();
          this.loadGroups();
        },
        error: (error) => {
          console.error(error);
          this.notification.error('Failed to create addon group.');
          this.isLoading.set(false);
        }
      });
    }
  }

  editGroup(group: AddonGroup): void {
    this.editingGroup = group;
    this.form.patchValue({
      name: group.name,
      description: group.description,
      selectionType: group.selectionType,
      minSelect: group.minSelect ?? 0,
      maxSelect: group.maxSelect ?? null,
      isRequired: group.isRequired ?? false,
      isActive: group.isActive ?? true,
      appliesToCategoryIds: group.appliesToCategoryIds ?? [],
      appliesToItemIds: group.appliesToItemIds ?? []
    });

    this.optionsArray.clear();
    group.options?.forEach(option => this.addOption(option));
    if (this.optionsArray.length === 0) {
      this.addOption();
    }
  }

  deleteGroup(group: AddonGroup): void {
    if (!confirm(`Delete addon group "${group.name}"?`)) {
      return;
    }
    this.isLoading.set(true);
    this.addonsService.deleteAddonGroup(group.id).subscribe({
      next: () => {
        this.notification.success('Addon group deleted.');
        this.resetForm();
        this.loadGroups();
      },
      error: (error) => {
        console.error(error);
        this.notification.error('Failed to delete addon group.');
        this.isLoading.set(false);
      }
    });
  }

  resetForm(): void {
    this.editingGroup = null;
    this.form.reset({
      name: '',
      description: '',
      selectionType: 'single',
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
      isActive: true,
      appliesToCategoryIds: [],
      appliesToItemIds: []
    });
    this.optionsArray.clear();
    this.addOption();
  }

  private loadInitialData(): void {
    this.isLoading.set(true);
    this.addOption();
    this.loadGroups();
    this.categoriesService.getCategories({ isActive: true }).subscribe(categories => {
      this.categories = Array.isArray(categories) ? categories : [];
    });
    this.itemsService.getItems({ isAvailable: true }).subscribe(items => {
      this.items = Array.isArray(items) ? items : [];
    });
  }

  private loadGroups(): void {
    this.addonsService.getAddonGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups || []);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error(error);
        this.notification.error('Failed to load addon groups.');
        this.isLoading.set(false);
      }
    });
  }

  private createOptionGroup(option?: AddonOption): FormGroup {
    return this.fb.group({
      id: [option?.id || this.generateOptionId()],
      name: [option?.name || '', Validators.required],
      description: [option?.description || ''],
      price: [option?.price ?? 0, [Validators.required, Validators.min(0)]],
      isDefault: [option?.isDefault ?? false],
      maxQuantity: [option?.maxQuantity ?? 1, [Validators.min(1)]],
      defaultQuantity: [option?.defaultQuantity ?? 0, [Validators.min(0)]]
    });
  }

  private buildPayloadFromForm(): CreateAddonGroupCommand | null {
    if (!this.form.valid) {
      return null;
    }
    const value = this.form.value;
    const options = this.optionsArray.controls.map(control => control.value as AddonOption);
    return {
      name: value.name,
      description: value.description,
      selectionType: value.selectionType,
      minSelect: value.minSelect,
      maxSelect: value.maxSelect,
      isRequired: value.isRequired,
      isActive: value.isActive,
      menuId: undefined,
      placeId: undefined,
      appliesToCategoryIds: value.appliesToCategoryIds || [],
      appliesToItemIds: value.appliesToItemIds || [],
      options
    };
  }

  private generateOptionId(): string {
    return `addon-opt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

