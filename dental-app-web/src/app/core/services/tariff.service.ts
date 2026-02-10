import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap } from 'rxjs';
import { TariffData, TariffCategory, TariffItem } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class TariffService {
    private tariffData: TariffData | null = null;
    private jsonPath = 'assets/tdb_2026_tarife_full.json';

    constructor(private http: HttpClient) { }

    loadTariffData(): Observable<TariffData> {
        if (this.tariffData) {
            return of(this.tariffData);
        }

        return this.http.get<TariffData>(this.jsonPath).pipe(
            tap(data => this.tariffData = data)
        );
    }

    getCategories(): Observable<TariffCategory[]> {
        return this.loadTariffData().pipe(
            map(data => data.categories)
        );
    }

    getItemsByCategory(categoryName: string): Observable<TariffItem[]> {
        return this.getCategories().pipe(
            map(categories => {
                const category = categories.find(c => c.name === categoryName);
                return category ? category.items : [];
            })
        );
    }

    getItemByCode(code: string): Observable<TariffItem | undefined> {
        return this.getCategories().pipe(
            map(categories => {
                for (const category of categories) {
                    const item = category.items.find(i => i.code === code);
                    if (item) return item;
                }
                return undefined;
            })
        );
    }
}
