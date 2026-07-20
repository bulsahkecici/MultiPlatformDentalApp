import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideAnimationsAsync(),
        provideHttpClient(withInterceptors([authInterceptor])),
        // Açılışta oturumu /api/auth/me ile doğrula (hard-refresh sonrası oturum korunur)
        {
            provide: APP_INITIALIZER,
            useFactory: (auth: AuthService) => () => firstValueFrom(auth.restoreSession()),
            deps: [AuthService],
            multi: true
        }
    ]
};
