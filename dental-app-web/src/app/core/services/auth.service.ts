import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { User, LoginResponse } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    private accessTokenKey = 'accessToken';
    private refreshTokenKey = 'refreshToken';

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
