import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="login-page">
      <div class="bg-shape shape-a"></div>
      <div class="bg-shape shape-b"></div>

      <mat-card class="login-card">
        <div class="hero">
          <span class="hero-chip">BULKA DENTAL</span>
          <h1>Klinik Yönetim Paneli</h1>
          <p>Randevu, hasta, tedavi ve finans süreçlerini tek panelden yönetin.</p>
        </div>

        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>E-posta</mat-label>
              <input matInput type="email" formControlName="email" required>
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">
                E-posta gereklidir
              </mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">
                Geçerli bir e-posta adresi giriniz
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Şifre</mat-label>
              <input matInput type="password" formControlName="password" required>
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
                Şifre gereklidir
              </mat-error>
            </mat-form-field>

            <div *ngIf="errorMessage" class="error-message">
              {{ errorMessage }}
            </div>

            <button mat-raised-button color="primary" type="submit" class="full-width login-btn" [disabled]="isLoading || !loginForm.valid">
              <mat-spinner *ngIf="isLoading" diameter="20" class="inline-spinner"></mat-spinner>
              <span *ngIf="!isLoading">Giriş Yap</span>
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-page {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
      padding: 24px;
      background:
        radial-gradient(circle at 8% 20%, rgba(58, 123, 213, 0.18), transparent 45%),
        radial-gradient(circle at 90% 80%, rgba(22, 186, 153, 0.16), transparent 40%),
        linear-gradient(180deg, #f7faff 0%, #f1f6ff 100%);
    }

    .bg-shape {
      position: absolute;
      border-radius: 999px;
      filter: blur(2px);
      z-index: 0;
    }

    .shape-a {
      width: 360px;
      height: 360px;
      right: -90px;
      top: -120px;
      background: linear-gradient(145deg, rgba(46, 122, 255, 0.38), rgba(124, 181, 255, 0.18));
    }

    .shape-b {
      width: 260px;
      height: 260px;
      left: -60px;
      bottom: -110px;
      background: linear-gradient(145deg, rgba(25, 163, 132, 0.3), rgba(140, 229, 205, 0.16));
    }

    .login-card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 460px;
      padding: 12px;
      border-radius: 22px;
    }

    .hero {
      border-radius: 14px;
      padding: 18px;
      margin: 8px 8px 4px;
      color: #f4f8ff;
      background: linear-gradient(132deg, #123363, #1f4f95);
      box-shadow: 0 14px 28px rgba(16, 34, 69, 0.25);
    }

    .hero-chip {
      display: inline-block;
      padding: 4px 9px;
      border-radius: 999px;
      font-size: 11px;
      letter-spacing: 0.4px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.18);
      margin-bottom: 8px;
    }

    .hero h1 {
      margin: 0 0 6px;
      font-size: 1.45rem;
      line-height: 1.15;
      font-weight: 700;
    }

    .hero p {
      margin: 0;
      font-size: 0.9rem;
      opacity: 0.95;
    }

    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }

    .error-message {
      color: #c62828;
      margin-bottom: 12px;
      font-size: 13px;
      font-weight: 600;
    }

    .login-btn {
      height: 44px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }

    @media (max-width: 600px) {
      .login-page {
        padding: 12px;
      }
      .hero h1 {
        font-size: 1.22rem;
      }
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      const { email, password } = this.loginForm.value;
      
      this.authService.login(email, password).subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Login error:', error);
          
          // Daha detaylı hata mesajları
          if (error.status === 0) {
            this.errorMessage = 'Backend sunucusuna bağlanılamıyor. Sunucunun çalıştığından emin olun.';
          } else if (error.status === 401) {
            this.errorMessage = error.error?.message || 'E-posta veya şifre hatalı.';
          } else if (error.status === 403) {
            this.errorMessage = error.error?.message || 'Hesabınız kilitli veya e-posta doğrulanmamış.';
          } else if (error.status === 500) {
            this.errorMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
          } else {
            this.errorMessage = error.error?.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
          }
        }
      });
    }
  }
}
