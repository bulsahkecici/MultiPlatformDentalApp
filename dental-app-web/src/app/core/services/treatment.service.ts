import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Treatment, TreatmentsResponse, CreateTreatmentPlanRequest } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class TreatmentService {
  constructor(private apiService: ApiService) { }

  createTreatmentPlan(request: CreateTreatmentPlanRequest): Observable<any> {
    return this.apiService.post<any>('/api/treatment-plans', request);
  }

  getTreatments(
    page: number = 1,
    limit: number = 20,
    patientId?: number,
    startDate?: string,
    endDate?: string
  ): Observable<TreatmentsResponse> {
    const params: any = { page, limit };
    if (patientId) params.patientId = patientId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.apiService.get<TreatmentsResponse>('/api/treatments', params);
  }

  getTreatment(id: number): Observable<{ treatment: Treatment }> {
    return this.apiService.get<{ treatment: Treatment }>(`/api/treatments/${id}`);
  }

  createTreatment(treatment: Partial<Treatment>): Observable<{ treatment: Treatment }> {
    return this.apiService.post<{ treatment: Treatment }>('/api/treatments', treatment);
  }

  updateTreatment(id: number, treatment: Partial<Treatment>): Observable<{ treatment: Treatment }> {
    return this.apiService.put<{ treatment: Treatment }>(`/api/treatments/${id}`, treatment);
  }

  deleteTreatment(id: number): Observable<void> {
    return this.apiService.delete<void>(`/api/treatments/${id}`);
  }
}
