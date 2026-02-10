import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/models';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  roles: string[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatBadgeModule,
    MatTooltipModule
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav #sidenav mode="side" opened class="sidenav">
        <div class="sidenav-header">
          <h2>BULKA DENTAL</h2>
        </div>
        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon>
            <span>Kontrol Paneli</span>
          </a>
          
          <a mat-list-item routerLink="/patients" routerLinkActive="active" *ngIf="canAccessPatients()">
            <mat-icon>people</mat-icon>
            <span>Hastalar</span>
          </a>
          
          <a mat-list-item routerLink="/appointments" routerLinkActive="active" *ngIf="canAccessAppointments()">
            <mat-icon>event</mat-icon>
            <span>Randevular</span>
          </a>
          
          <a mat-list-item routerLink="/treatments" routerLinkActive="active" *ngIf="canAccessTreatments()">
            <mat-icon>medical_services</mat-icon>
            <span>Tedaviler</span>
          </a>
          
          <a mat-list-item routerLink="/payments" routerLinkActive="active" *ngIf="canAccessPayments()">
            <mat-icon>payment</mat-icon>
            <span>Ödemeler</span>
          </a>
          
          <a mat-list-item routerLink="/earnings" routerLinkActive="active" *ngIf="isDentist">
            <mat-icon>attach_money</mat-icon>
            <span>Kazançlarım</span>
          </a>
          
          <a mat-list-item routerLink="/admin" routerLinkActive="active" *ngIf="isAdmin">
            <mat-icon>admin_panel_settings</mat-icon>
            <span>Kullanıcı Yönetimi</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary">
          <button mat-icon-button (click)="sidenav.toggle()">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="spacer"></span>
          <span>{{ currentUser?.email }}</span>
          <button mat-icon-button (click)="logout()" matTooltip="Çıkış">
            <mat-icon>logout</mat-icon>
          </button>
        </mat-toolbar>
        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container {
      height: 100vh;
    }
    .sidenav {
      width: 250px;
      background-color: #1E3A8A;
    }
    .sidenav-header {
      padding: 20px;
      color: white;
      text-align: center;
      background-color: #3B82F6;
    }
    .sidenav-header h2 {
      margin: 0;
      font-weight: bold;
    }
    mat-nav-list {
      padding-top: 0;
    }
    mat-nav-list a {
      color: white;
    }
    mat-nav-list a.active {
      background-color: #3B82F6;
    }
    mat-nav-list mat-icon {
      margin-right: 10px;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .content {
      padding: 20px;
    }
  `]
})
export class MainLayoutComponent implements OnInit {
  currentUser: User | null = null;
  isAdmin = false;
  isDentist = false;
  isSecretary = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.isAdmin = user.roles.includes('admin');
        this.isDentist = user.roles.includes('dentist');
        this.isSecretary = user.roles.includes('secretary');
      }
    });
  }

  canAccessPatients(): boolean {
    return this.isAdmin || this.isDentist || this.isSecretary;
  }

  canAccessAppointments(): boolean {
    return this.isAdmin || this.isDentist || this.isSecretary;
  }

  canAccessTreatments(): boolean {
    return this.isAdmin || this.isDentist || this.isSecretary;
  }

  canAccessPayments(): boolean {
    return this.isAdmin || this.isSecretary;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
