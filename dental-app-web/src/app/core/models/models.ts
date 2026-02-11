export interface User {
    id: number;
    email: string;
    roles: string[];
    emailVerified: boolean;
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
    lastLoginAt?: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
}

export interface Patient {
    id: number;
    firstName?: string;
    first_name?: string; // Backend format
    lastName?: string;
    last_name?: string; // Backend format
    dateOfBirth?: string;
    date_of_birth?: string; // Backend format
    gender?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    postal_code?: string; // Backend format
    country?: string;
    bloodType?: string;
    blood_type?: string; // Backend format
    allergies?: string;
    medicalConditions?: string;
    medical_conditions?: string; // Backend format
    currentMedications?: string;
    current_medications?: string; // Backend format
    emergencyContactName?: string;
    emergency_contact_name?: string; // Backend format
    emergencyContactPhone?: string;
    emergency_contact_phone?: string; // Backend format
    insuranceProvider?: string;
    insurance_provider?: string; // Backend format
    insurancePolicyNumber?: string;
    insurance_policy_number?: string; // Backend format
    notes?: string;
    createdAt?: string;
    created_at?: string; // Backend format
}

export interface Appointment {
    id: number;
    patientId?: number;
    patient_id?: number; // Backend format
    dentistId?: number;
    dentist_id?: number; // Backend format
    appointmentDate?: string;
    appointment_date?: string; // Backend format
    startTime?: string;
    start_time?: string; // Backend format
    endTime?: string;
    end_time?: string; // Backend format
    appointmentType?: string;
    appointment_type?: string; // Backend format
    status: string;
    notes?: string;
    cancellationReason?: string;
    cancellation_reason?: string; // Backend format
    patientFirstName?: string;
    patient_first_name?: string; // Backend format
    patientLastName?: string;
    patient_last_name?: string; // Backend format
    dentistEmail?: string;
    dentist_email?: string; // Backend format
}

export interface Treatment {
    id: number;
    patientId?: number;
    patient_id?: number; // Backend format
    appointmentId?: number;
    appointment_id?: number; // Backend format
    dentistId?: number;
    dentist_id?: number; // Backend format
    treatmentDate?: string;
    treatment_date?: string; // Backend format
    treatmentType?: string;
    treatment_type?: string; // Backend format
    toothNumber?: string;
    tooth_number?: string; // Backend format
    description?: string;
    diagnosis?: string;
    procedureNotes?: string;
    procedure_notes?: string; // Backend format
    cost?: number;
    currency: string;
    status: string;
    patientFirstName?: string;
    patient_first_name?: string; // Backend format
    patientLastName?: string;
    patient_last_name?: string; // Backend format
    dentistEmail?: string;
    dentist_email?: string; // Backend format
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

// Backend response format
export interface AppointmentsResponse {
    appointments: Appointment[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface PatientsResponse {
    patients: Patient[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface TreatmentsResponse {
    treatments: Treatment[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface ToothHotspot {
    toothNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TariffItem {
    code: string;
    name: string;
    priceExclVat?: number;
    price_excl_vat?: number;
    vatRate?: number;
    vat_rate?: number;
    priceInclVat?: number;
    price_incl_vat?: number;
    currency: string;
}

export interface TariffCategory {
    name: string;
    notes: string[];
    items: TariffItem[];
}

export interface TariffSource {
    title: string;
    year: number;
    vat_rate_default?: number;
    vatRateDefault?: number;
}

export interface TariffData {
    source?: TariffSource;
    categories: TariffCategory[];
}

export interface TreatmentPlanItem {
    toothNumber: number;
    treatmentType: string;
    cost?: number;
    currency: string;
    notes?: string;
}

export interface CreateTreatmentPlanRequest {
    patientId: number;
    dentistId?: number | null;
    title: string;
    description?: string;
    items: TreatmentPlanItem[];
}
