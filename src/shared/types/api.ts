export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[] | Record<string, any>;
  };
}
