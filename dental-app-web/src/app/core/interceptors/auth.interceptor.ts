import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const accessToken = authService.getAccessToken();

  const isAuthEndpoint = req.url.includes('/api/auth/login')
    || req.url.includes('/api/auth/refresh')
    || req.url.includes('/api/auth/logout');

  let authReq = req;
  if (accessToken) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint && authService.getRefreshToken()) {
        return authService.refreshToken().pipe(
          switchMap(tokens => {
            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${tokens.accessToken}`
              }
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            authService.logout();
            router.navigate(['/login']);
            return throwError(() => refreshError);
          })
        );
      }

      if (error.status === 401 && !isAuthEndpoint) {
        authService.logout();
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
