import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SocketService } from '../../../core/services/socket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { User, Notification } from '../../../core/models/models';

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
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule
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
          <button mat-icon-button [matMenuTriggerFor]="notifMenu" matTooltip="Bildirimler"
                  (menuOpened)="onNotificationsOpened()">
            <mat-icon [matBadge]="unreadCount > 0 ? unreadCount : null" matBadgeColor="warn">
              notifications
            </mat-icon>
          </button>
          <mat-menu #notifMenu="matMenu" class="notification-menu">
            <div class="notif-header" (click)="$event.stopPropagation()">
              <span>Bildirimler</span>
              <button mat-button *ngIf="notifications.length > 0" (click)="markAllRead()">
                Tümünü okundu işaretle
              </button>
            </div>
            <div *ngIf="notifications.length === 0" class="notif-empty">Bildirim yok</div>
            <button mat-menu-item *ngFor="let n of notifications">
              <div class="notif-item">
                <strong>{{ n.title }}</strong>
                <small>{{ n.message }}</small>
              </div>
            </button>
          </mat-menu>
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
    .notif-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      font-weight: bold;
      border-bottom: 1px solid rgba(0,0,0,0.12);
    }
    .notif-empty {
      padding: 16px;
      color: rgba(0,0,0,0.54);
      text-align: center;
    }
    .notif-item {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    .notif-item small {
      color: rgba(0,0,0,0.6);
    }
  `]
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isAdmin = false;
  isDentist = false;
  isSecretary = false;
  unreadCount = 0;
  notifications: Notification[] = [];
  private notifSub?: Subscription;

  constructor(
    private authService: AuthService,
    private socketService: SocketService,
    private notificationService: NotificationService,
    private snackBar: MatSnackBar,
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

    // Gerçek zamanlı bildirim bağlantısı (AuthGuard arkasındayız, token mevcut)
    const token = this.authService.getAccessToken();
    if (token) {
      this.socketService.connect(token);
    }
    this.notifSub = this.socketService.notification$.subscribe(n => {
      this.unreadCount++;
      this.snackBar.open(`${n.title}: ${n.message}`, 'Kapat', { duration: 5000 });
    });
    this.refreshUnreadCount();
  }

  ngOnDestroy(): void {
    this.notifSub?.unsubscribe();
    this.socketService.disconnect();
  }

  onNotificationsOpened(): void {
    this.notificationService.getNotifications(20).subscribe({
      next: res => (this.notifications = res.notifications ?? []),
      error: () => (this.notifications = [])
    });
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.unreadCount = 0;
        this.refreshUnreadCount();
      }
    });
  }

  private refreshUnreadCount(): void {
    this.notificationService.getUnreadCount().subscribe({
      next: res => (this.unreadCount = res.count ?? 0),
      error: () => (this.unreadCount = 0)
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
