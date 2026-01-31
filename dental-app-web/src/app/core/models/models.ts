export interface User {
    id: number;
    email: string;
    roles: string[];
    emailVerified: boolean;
    lastLoginAt?: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
}

export interface Patient {
    id: number;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    bloodType?: string;
    allergies?: string;
    medicalConditions?: string;
    currentMedications?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
    notes?: string;
    createdAt: string;
}

export interface Appointment {
    id: number;
    patientId: number;
    dentistId: number;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    appointmentType?: string;
    status: string;
    notes?: string;
    cancellationReason?: string;
    patientFirstName?: string;
    patientLastName?: string;
    dentistEmail?: string;
}

export interface Treatment {
    id: number;
    patientId: number;
    appointmentId?: number;
    dentistId: number;
    treatmentDate: string;
    treatmentType: string;
    toothNumber?: string;
    description?: string;
    diagnosis?: string;
    procedureNotes?: string;
    cost?: number;
    currency: string;
    status: string;
    patientFirstName?: string;
    patientLastName?: string;
    dentistEmail?: string;
}

export interface Notification {
    id: number;
    userId: number;
    type: string;
    title: string;
    message: string;
    data?: any;
    isRead: boolean;
    createdAt: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
