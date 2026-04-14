import type { User } from '@/mobile/app/data/contracts/entities';

export type RegisterData = {
  email: string;
  password: string;
  name: string;
  username: string;
  bio?: string;
  interests?: string[];
  profilePhoto?: string;
  coverPhoto?: string;
};

export type AuthActionCode =
  | 'duplicate_email'
  | 'duplicate_username'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'signup_pending_confirmation'
  | 'unexpected';

export type AuthActionResult = {
  success: boolean;
  code?: AuthActionCode;
  message?: string;
};

export type AuthContextType = {
  user: User | null;
  booted: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (data: RegisterData) => Promise<AuthActionResult>;
  resendConfirmationEmail: (email: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  requestPasswordReset: (currentPassword: string) => Promise<AuthActionResult>;
};
