import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
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

    /**
     * Uygulama açılışında oturumu backend ile doğrula (GET /api/auth/me).
     * Token geçersizse temizler; APP_INITIALIZER üzerinden çağrılır.
     */
    restoreSession(): Observable<User | null> {
        const token = this.getAccessToken();
        if (!token) {
            return of(null);
        }
        return this.apiService.get<{ user: User }>('/api/auth/me').pipe(
            tap(res => {
                this.currentUserSubject.next(res.user);
                this.saveUserToStorage(res.user);
            }),
            catchError(() => {
                this.clearTokens();
                this.currentUserSubject.next(null);
                sessionStorage.removeItem('currentUser');
                return of(null);
            })
        ) as Observable<User | null>;
    }

    login(email: string, password: string, mfaCode?: string): Observable<LoginResponse> {
        return this.apiService.post<LoginResponse>('/api/auth/login', { email, password, mfaCode })
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
        sessionStorage.removeItem('currentUser');
    }

    getAccessToken(): string | null {
        return sessionStorage.getItem(this.accessTokenKey);
    }

    getRefreshToken(): string | null {
        return sessionStorage.getItem(this.refreshTokenKey);
    }

    setTokens(accessToken: string, refreshToken: string): void {
        sessionStorage.setItem(this.accessTokenKey, accessToken);
        sessionStorage.setItem(this.refreshTokenKey, refreshToken);
    }

    clearTokens(): void {
        sessionStorage.removeItem(this.accessTokenKey);
        sessionStorage.removeItem(this.refreshTokenKey);
    }

    private loadUserFromStorage(): void {
        const userJson = sessionStorage.getItem('currentUser');
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
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    }
}
