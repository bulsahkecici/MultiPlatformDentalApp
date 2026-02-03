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
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>BULKA DENTAL - Giriş</mat-card-title>
        </mat-card-header>
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

            <button mat-raised-button color="primary" type="submit" class="full-width" [disabled]="isLoading || !loginForm.valid">
              <mat-spinner *ngIf="isLoading" diameter="20" class="inline-spinner"></mat-spinner>
              <span *ngIf="!isLoading">Giriş Yap</span>
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #E6F2FF 0%, #FFFFFF 50%, #E6F2FF 100%);
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 20px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    .error-message {
      color: #f44336;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    mat-card-title {
      text-align: center;
      color: #1E3A8A;
      font-weight: bold;
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
