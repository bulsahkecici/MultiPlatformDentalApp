import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, tap, catchError, map, throwError, shareReplay, finalize } from 'rxjs';
import { ApiService } from './api.service';
import { User, LoginResponse } from '../models/models';

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private accessTokenKey = 'accessToken';
  private refreshTokenKey = 'refreshToken';
  private refreshInProgress$: Observable<TokenRefreshResponse> | null = null;

  constructor(private apiService: ApiService) {
    this.loadUserFromStorage();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.apiService.post<LoginResponse>('/api/auth/login', { email, password })
      .pipe(
        tap(response => {
          this.setTokens(response.accessToken, response.refreshToken);
          this.currentUserSubject.next(response.user);
          this.saveUserToStorage(response.user);
        })
      );
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.apiService.post('/api/auth/logout', { refreshToken }).subscribe();
    }
    this.clearTokens();
    this.currentUserSubject.next(null);
    localStorage.removeItem('currentUser');
  }

  validateSession(): Observable<User | null> {
    const token = this.getAccessToken();
    if (!token) {
      return of(null);
    }

    return this.apiService.get<{ user: User }>('/api/auth/me').pipe(
      tap(response => {
        this.currentUserSubject.next(response.user);
        this.saveUserToStorage(response.user);
      }),
      map(response => response.user),
      catchError(() => {
        this.clearTokens();
        this.currentUserSubject.next(null);
        localStorage.removeItem('currentUser');
        return of(null);
      })
    );
  }

  refreshToken(): Observable<TokenRefreshResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }

    if (!this.refreshInProgress$) {
      this.refreshInProgress$ = this.apiService.post<TokenRefreshResponse>('/api/auth/refresh', { refreshToken }).pipe(
        tap(response => this.setTokens(response.accessToken, response.refreshToken)),
        shareReplay(1),
        finalize(() => {
          this.refreshInProgress$ = null;
        })
      );
    }

    return this.refreshInProgress$;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.accessTokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  private loadUserFromStorage(): void {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        this.currentUserSubject.next(user);
      } catch (e) {
        console.error('Failed to parse user from storage');
      }
    }
  }

  private saveUserToStorage(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
}
