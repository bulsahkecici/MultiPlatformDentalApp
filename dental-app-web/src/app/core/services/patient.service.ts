import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Patient, PatientsResponse } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  constructor(private apiService: ApiService) {}

  getPatients(page: number = 1, limit: number = 20, search?: string): Observable<PatientsResponse> {
    const params: any = { page, limit };
    if (search) {
      params.search = search;
    }
    return this.apiService.get<PatientsResponse>('/api/patients', params);
  }

  getPatient(id: number): Observable<{ patient: Patient }> {
    return this.apiService.get<{ patient: Patient }>(`/api/patients/${id}`);
  }

  createPatient(patient: Partial<Patient>): Observable<{ patient: Patient }> {
    return this.apiService.post<{ patient: Patient }>('/api/patients', patient);
  }

  updatePatient(id: number, patient: Partial<Patient>): Observable<{ patient: Patient }> {
    return this.apiService.put<{ patient: Patient }>(`/api/patients/${id}`, patient);
  }

  deletePatient(id: number): Observable<void> {
    return this.apiService.delete<void>(`/api/patients/${id}`);
  }
}
