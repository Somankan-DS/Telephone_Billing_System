export enum Role {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

export interface AuthUserPayload {
  id: string;
  email: string;
  role: Role;
  customerId?: string | null;
  iat?: number;
  exp?: number;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface UserSummaryDto {
  id: string;
  email: string;
  role: Role;
  customerId?: string | null;
  createdAt: string;
}

export interface CustomerProfileDto {
  id: string;
  accountNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  prepaidBalance: string;
  creditLimit: string;
  tariffPlanId?: string | null;
}

export interface UserProfileResponseDto {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: CustomerProfileDto | null;
}

export interface LoginResponseDto {
  token: string;
  user: UserSummaryDto;
}
