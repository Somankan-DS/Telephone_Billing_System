import { prisma } from '../../shared/database';
import { LoginDto, ChangePasswordDto, LoginResponseDto, UserProfileResponseDto, Role } from './auth.types';
import { hashPassword, comparePassword, dummyHashCompare, validatePasswordStrength } from '../../shared/utils/hash';
import { JwtService } from './jwt.service';
import { UnauthorizedError, ForbiddenError, ValidationError, NotFoundError } from '../../shared/errors';

export class AuthService {
  /**
   * Authenticate user credentials and return signed JWT with user metadata.
   */
  public async login(dto: LoginDto & { identifier?: string }): Promise<LoginResponseDto> {
    const rawIdentifier = dto.identifier || dto.email;
    const email = rawIdentifier?.trim().toLowerCase();
    const password = dto.password;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { customer: true },
    });

    if (!user) {
      // Defend against timing attacks / account enumeration
      await dummyHashCompare(password);
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Account is deactivated. Please contact support.', 'ACCOUNT_DEACTIVATED');
    }

    const customerId = user.customer ? user.customer.id : null;
    const token = JwtService.signToken({
      id: user.id,
      email: user.email,
      role: user.role as Role,
      customerId,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role as Role,
        customerId,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  /**
   * Fetch authenticated user's profile with IDOR protection.
   * Derives user ID strictly from the verified JWT.
   */
  public async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });

    if (!user) {
      throw new NotFoundError('User profile not found', 'USER_NOT_FOUND');
    }

    const customerData = user.customer
      ? {
          id: user.customer.id,
          accountNumber: user.customer.accountNumber,
          firstName: user.customer.firstName,
          lastName: user.customer.lastName,
          phone: user.customer.phone,
          address: user.customer.address,
          city: user.customer.city,
          state: user.customer.state,
          postalCode: user.customer.postalCode,
          status: user.customer.status as any,
          prepaidBalance: user.customer.prepaidBalance.toString(),
          creditLimit: user.customer.creditLimit.toString(),
          tariffPlanId: user.customer.tariffPlanId,
        }
      : null;

    return {
      id: user.id,
      email: user.email,
      role: user.role as Role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      customer: customerData,
    };
  }

  /**
   * Self-service password change with IDOR protection.
   * Bound exclusively to the authenticated caller's userId.
   */
  public async changePassword(userId: string, dto: ChangePasswordDto & { current_password?: string; new_password?: string }): Promise<void> {
    const currentPassword = dto.currentPassword || dto.current_password;
    const newPassword = dto.newPassword || dto.new_password;

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }

    if (currentPassword === newPassword) {
      throw new ValidationError('New password must be different from current password');
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new ValidationError('New password does not meet security requirements', strength.errors);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Current password does not match', 'INCORRECT_CURRENT_PASSWORD');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });
  }
}
