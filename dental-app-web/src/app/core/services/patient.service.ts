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

  getDocuments(id: number): Observable<{ documents: any[] }> {
    return this.apiService.get<{ documents: any[] }>(`/api/patients/${id}/documents`);
  }

  uploadDocument(id: number, file: File, category: string, title: string): Observable<{ document: any }> {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    form.append('title', title);
    return this.apiService.postForm<{ document: any }>(`/api/patients/${id}/documents`, form);
  }

  downloadDocument(patientId: number, documentId: number): Observable<Blob> {
    return this.apiService.getBlob(`/api/patients/${patientId}/documents/${documentId}/download`);
  }

  getConsents(id: number): Observable<{ consents: any[] }> {
    return this.apiService.get<{ consents: any[] }>(`/api/patients/${id}/consents`);
  }

  createConsent(id: number, consent: any): Observable<{ consent: any }> {
    return this.apiService.post<{ consent: any }>(`/api/patients/${id}/consents`, consent);
  }

  exportRecord(id: number): Observable<Blob> {
    return this.apiService.getBlob(`/api/patients/${id}/export`);
  }
}
