import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface InstitutionAgreement {
  id: number;
  institution_name: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  discount_percentage: number;
  category_discounts?: Record<string, number>;
  is_active: boolean;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InstitutionAgreementService {
  constructor(private apiService: ApiService) {}

  getAgreements(): Observable<InstitutionAgreement[]> {
    return this.apiService.get<{ agreements: InstitutionAgreement[] }>('/api/institution-agreements').pipe(
      map(response => response.agreements || [])
    );
  }

  createAgreement(agreement: Partial<InstitutionAgreement>): Observable<InstitutionAgreement> {
    return this.apiService.post<{ agreement: InstitutionAgreement }>('/api/institution-agreements', agreement).pipe(
      map(response => response.agreement)
    );
  }

  updateAgreement(id: number, agreement: Partial<InstitutionAgreement>): Observable<InstitutionAgreement> {
    return this.apiService.put<{ agreement: InstitutionAgreement }>(`/api/institution-agreements/${id}`, agreement).pipe(
      map(response => response.agreement)
    );
  }

  deleteAgreement(id: number): Observable<{ message: string }> {
    return this.apiService.delete<{ message: string }>(`/api/institution-agreements/${id}`);
  }
}
