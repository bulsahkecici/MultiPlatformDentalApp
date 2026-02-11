import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { User } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private apiService: ApiService) {}

  getUsers(limit: number = 500, role?: string, page: number = 1, search?: string): Observable<{ users: User[] }> {
    const params: any = { limit, page };
    if (role) params.role = role;
    if (search) params.search = search;
    return this.apiService.get<{ users: User[] }>('/api/users', params);
  }

  getUser(id: number): Observable<{ user: User }> {
    return this.apiService.get<{ user: User }>(`/api/users/${id}`);
  }

  createUser(user: any): Observable<{ user: User }> {
    return this.apiService.post<{ user: User }>('/api/users', user);
  }

  updateUser(id: number, user: Partial<User>): Observable<{ user: User }> {
    return this.apiService.put<{ user: User }>(`/api/users/${id}`, user);
  }

  deleteUser(id: number): Observable<void> {
    return this.apiService.delete<void>(`/api/users/${id}`);
  }
}
