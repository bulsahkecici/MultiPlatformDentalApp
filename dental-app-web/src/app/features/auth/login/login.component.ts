import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="brand-mark">
          <mat-icon>medical_services</mat-icon>
        </div>
        <h1>Bulka Dental</h1>
        <p class="subtitle">Klinik yönetim sistemine hoş geldiniz</p>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>E-posta</mat-label>
            <input matInput type="email" formControlName="email" required autocomplete="email">
            <mat-icon matPrefix class="field-icon">mail_outline</mat-icon>
            <mat-error *ngIf="loginForm.get('email')?.hasError('required')">
              E-posta gereklidir
            </mat-error>
            <mat-error *ngIf="loginForm.get('email')?.hasError('email')">
              Geçerli bir e-posta adresi giriniz
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Şifre</mat-label>
            <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password" required autocomplete="current-password">
            <mat-icon matPrefix class="field-icon">lock_outline</mat-icon>
            <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword" tabindex="-1">
              <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
              Şifre gereklidir
            </mat-error>
          </mat-form-field>

          <div *ngIf="errorMessage" class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>

          <button mat-raised-button color="primary" type="submit" class="full-width submit-btn" [disabled]="isLoading || !loginForm.valid">
            <mat-spinner *ngIf="isLoading" diameter="20" class="inline-spinner"></mat-spinner>
            <span *ngIf="!isLoading">Giriş Yap</span>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background:
        radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.12), transparent 45%),
        radial-gradient(circle at 85% 80%, rgba(30, 58, 138, 0.10), transparent 45%),
        linear-gradient(135deg, #eff6ff 0%, #f8fafc 60%, #eff6ff 100%);
      padding: 16px;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 40px 36px 32px;
      background: var(--surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      text-align: center;
    }
    .brand-mark {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #3b82f6, #1e3a8a);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      box-shadow: 0 8px 16px rgba(30, 58, 138, 0.25);
    }
    .brand-mark mat-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 22px;
      color: var(--ink-900);
    }
    .subtitle {
      margin: 0 0 28px;
      font-size: 13px;
      color: var(--ink-500);
    }
    form {
      text-align: left;
    }
    .full-width {
      width: 100%;
      margin-bottom: 6px;
    }
    .field-icon {
      color: var(--ink-500);
      margin-right: 4px;
    }
    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--warn-600);
      background: var(--warn-50);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      margin: 4px 0 16px;
      font-size: 13px;
      line-height: 1.4;
    }
    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    .submit-btn {
      height: 46px;
      font-size: 15px;
      margin-top: 8px;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  hidePassword = true;

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
