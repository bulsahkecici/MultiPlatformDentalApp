import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { User } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private apiService: ApiService) {}

  getUsers(): Observable<{ users: User[] }> {
    return this.apiService.get<{ users: User[] }>('/api/users');
  }

  /** Dişhekimi seçicileri için — admin yetkisi gerektirmez (bkz. src/routes/users.js). */
  getDentists(): Observable<{ dentists: { id: number; email: string; firstName: string; lastName: string }[] }> {
    return this.apiService.get('/api/users/dentists');
  }

  getUser(id: number): Observable<{ user: User }> {
    return this.apiService.get<{ user: User }>(`/api/users/${id}`);
  }

  createUser(user: {
    email: string;
    password: string;
    roles: string[];
    firstName?: string;
    lastName?: string;
    phone?: string;
    tcNo?: string;
    university?: string;
    diplomaNo?: string;
  }): Observable<{ user: User }> {
    return this.apiService.post<{ user: User }>('/api/users', user);
  }

  updateUser(id: number, user: Partial<User>): Observable<{ user: User }> {
    return this.apiService.put<{ user: User }>(`/api/users/${id}`, user);
  }

  updateRoles(id: number, roles: string[]): Observable<{ user: User }> {
    return this.apiService.put<{ user: User }>(`/api/users/${id}/roles`, { roles });
  }

  deleteUser(id: number): Observable<void> {
    return this.apiService.delete<void>(`/api/users/${id}`);
  }
}
