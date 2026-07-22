import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeTr from '@angular/common/locales/tr';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

// Ödemeler ekranındaki `number:'1.2-2'` pipe'ı LOCALE_ID hiç register
// edilmediği için varsayılan en-US'a düşüyordu (1,234.56 — virgül binlik,
// nokta ondalık), tam olarak paranın göründüğü ekranda. Diğer bileşenler
// zaten `toLocaleString('tr-TR')` ile elle doğru biçimlendiriyor; bu kayıt
// Angular pipe'larının da aynı locale'i kullanmasını sağlıyor.
registerLocaleData(localeTr);

export const appConfig: ApplicationConfig = {
    providers: [
        { provide: LOCALE_ID, useValue: 'tr' },
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideAnimationsAsync(),
        provideHttpClient(withInterceptors([authInterceptor])),
        // MatDialog/CDK Overlay içinde açılan datepicker'ların DateAdapter'ı
        // kök enjektörden bulabilmesi için — standalone dialog bileşenlerinin
        // kendi imports'unda MatNativeDateModule olması yeterli değil.
        provideNativeDateAdapter(),
        // Açılışta oturumu /api/auth/me ile doğrula (hard-refresh sonrası oturum korunur)
        {
            provide: APP_INITIALIZER,
            useFactory: (auth: AuthService) => () => firstValueFrom(auth.restoreSession()),
            deps: [AuthService],
            multi: true
        }
    ]
};
