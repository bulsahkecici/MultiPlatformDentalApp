import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { TariffService } from '../../../core/services/tariff.service';
import { TariffCategory, TariffItem } from '../../../core/models/models';

@Component({
    selector: 'app-tariff-selector',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatListModule,
        MatIconModule
    ],
    template: `
    <div class="tariff-selector">
      <div class="filters">
        <mat-form-field appearance="outline" class="category-select">
          <mat-label>Kategori</mat-label>
          <mat-select [(ngModel)]="selectedCategoryName" (selectionChange)="onCategoryChange()">
            <mat-option *ngFor="let cat of categories" [value]="cat.name">
              {{ cat.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="search-field">
          <mat-label>İşlem Ara</mat-label>
          <input matInput [(ngModel)]="searchText" (input)="filterItems()" placeholder="Kod veya isim...">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      <div class="items-list">
        <mat-action-list>
          <button mat-list-item *ngFor="let item of filteredItems" (click)="selectItem(item)">
            <span matListItemTitle>{{ item.name }}</span>
            <span matListItemLine>Kod: {{ item.code }} | ₺{{ item.priceInclVat || item.price_incl_vat }}</span>
            <mat-icon matListItemMeta color="primary">add_circle</mat-icon>
          </button>
        </mat-action-list>
      </div>
    </div>
  `,
    styles: [`
    .tariff-selector {
      display: flex;
      flex-direction: column;
      height: 400px;
    }
    .filters {
      display: flex;
      gap: 16px;
      padding: 8px 0;
    }
    .category-select {
      flex: 1;
    }
    .search-field {
      flex: 1;
    }
    .items-list {
      flex: 1;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
  `]
})
export class TariffSelectorComponent implements OnInit {
    @Output() itemSelected = new EventEmitter<TariffItem>();

    categories: TariffCategory[] = [];
    selectedCategoryName: string = '';
    allItems: TariffItem[] = [];
    filteredItems: TariffItem[] = [];
    searchText: string = '';

    constructor(private tariffService: TariffService) { }

    ngOnInit() {
        this.tariffService.getCategories().subscribe(cats => {
            this.categories = cats;
            if (cats.length > 0) {
                this.selectedCategoryName = cats[0].name;
                this.onCategoryChange();
            }
        });
    }

    onCategoryChange() {
        this.tariffService.getItemsByCategory(this.selectedCategoryName).subscribe(items => {
            this.allItems = items;
            this.filterItems();
        });
    }

    filterItems() {
        if (!this.searchText) {
            this.filteredItems = this.allItems;
        } else {
            const search = this.searchText.toLowerCase();
            this.filteredItems = this.allItems.filter(i =>
                i.name.toLowerCase().includes(search) ||
                i.code.toLowerCase().includes(search)
            );
        }
    }

    selectItem(item: TariffItem) {
        this.itemSelected.emit(item);
    }
}
