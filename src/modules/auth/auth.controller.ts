import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../shared/types/api';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);
      res.status(200).json({
        success: true,
        data: result,
        token: result.token,
        user: result.user,
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  };

  public getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // IDOR protection: strictly req.user!.id
      const result = await this.authService.getProfile(req.user!.id);
      res.status(200).json({
        success: true,
        data: result,
        user: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // IDOR protection: strictly req.user!.id
      await this.authService.changePassword(req.user!.id, req.body);
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Password updated successfully' },
        message: 'Password updated successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
