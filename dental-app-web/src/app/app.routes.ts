import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadComponent: () => import('./features/layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'patients',
        loadComponent: () => import('./features/patients/patients.component').then(m => m.PatientsComponent)
      },
      {
        path: 'appointments',
        loadComponent: () => import('./features/appointments/appointments.component').then(m => m.AppointmentsComponent)
      },
      {
        path: 'treatments',
        loadComponent: () => import('./features/treatments/treatments.component').then(m => m.TreatmentsComponent)
      },
      {
        path: 'payments',
        canActivate: [RoleGuard],
        data: { roles: ['admin', 'secretary'] },
        loadComponent: () => import('./features/payments/payments.component').then(m => m.PaymentsComponent)
      },
      {
        path: 'admin',
        canActivate: [RoleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('./features/admin/admin-management.component').then(m => m.AdminManagementComponent)
      },
      {
        path: 'earnings',
        canActivate: [RoleGuard],
        data: { roles: ['dentist'] },
        loadComponent: () => import('./features/dentist-earnings/dentist-earnings.component').then(m => m.DentistEarningsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
