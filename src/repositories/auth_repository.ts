import { http } from '@/src/lib/http/client';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { User } from '@/src/models/User';
import { API_ENDPOINTS } from '@/src/constants/app';
import { AppError } from '@/src/lib/errors/app_error';
import type { components } from '@/src/generated/openapi';

export type LoginInput = components['schemas']['LoginRequest'];
export type EmailVerificationCodeInput = components['schemas']['EmailVerificationCodeRequest'];
type RegisterRequest = components['schemas']['RegisterRequest'];
export type RegisterInput = Omit<RegisterRequest, 'gender' | 'name'> & {
  gender?: User['gender'];
  name: string;
};

type AuthContractPayload = components['schemas']['AuthResponse'];
type RefreshContractPayload = components['schemas']['TokenResponse'];
type UserContract = components['schemas']['UserOut'];
type MeContractPayload = components['schemas']['ApiEnvelope_dict_str__UserOut__']['data'];

export type AuthPayload = { token: string; user: User; refresh_token?: string };
export type RefreshPayload = { token: string; refresh_token?: string };

function isUserRole(role: string | null | undefined): role is User['role'] {
  return role === 'user' || role === 'admin' || role === 'super_admin';
}

function toUser(user: UserContract): User {
  if (!isUserRole(user.role)) {
    throw new AppError('服务端返回了无效的用户角色');
  }
  const gender = user.gender === 'male' || user.gender === 'female'
    ? user.gender
    : undefined;
  return {
    id: user.id,
    email: user.email,
    name: user.name?.trim() || user.email.split('@')[0],
    role: user.role,
    avatar_url: user.avatar_url,
    ...(gender ? { gender } : {}),
    ...(user.hometown ? { hometown: user.hometown } : {}),
  };
}

function toAuthPayload(payload: AuthContractPayload): AuthPayload {
  return {
    token: payload.token,
    refresh_token: payload.refresh_token,
    user: toUser(payload.user),
  };
}

export interface AuthRepository {
  login(input: LoginInput): Promise<AuthPayload>;
  requestRegistrationCode(input: EmailVerificationCodeInput): Promise<void>;
  register(input: RegisterInput): Promise<AuthPayload>;
  me(): Promise<{ user: User }>;
  logout(): Promise<void>;
  refresh(refreshToken: string): Promise<RefreshPayload>;
}

export class ApiAuthRepository implements AuthRepository {
  async login(input: LoginInput): Promise<AuthPayload> {
    const res = await http.post<ApiResponse<AuthContractPayload>>(API_ENDPOINTS.AUTH.LOGIN, input);
    return toAuthPayload(unwrapApiResponse(res));
  }
  async requestRegistrationCode(input: EmailVerificationCodeInput): Promise<void> {
    const res = await http.post<ApiResponse<null>>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFICATION_CODES,
      input,
    );
    unwrapApiResponse(res);
  }
  async register(input: RegisterInput): Promise<AuthPayload> {
    const res = await http.post<ApiResponse<AuthContractPayload>>(API_ENDPOINTS.AUTH.REGISTER, input);
    return toAuthPayload(unwrapApiResponse(res));
  }
  async me(): Promise<{ user: User }> {
    const res = await httpAuth.get<ApiResponse<MeContractPayload>>(API_ENDPOINTS.AUTH.ME);
    const payload = unwrapApiResponse(res);
    if (!payload.user) {
      throw new AppError('服务端响应缺少用户信息');
    }
    return { user: toUser(payload.user) };
  }
  async logout(): Promise<void> {
    try {
      const res = await httpAuth.post<ApiResponse<null>>(API_ENDPOINTS.AUTH.LOGOUT);
      // Ensure API envelope code is OK (e.g., { code:200, message:"退出成功", data:null })
      unwrapApiResponse<null>(res);
    } catch {
      // Best-effort: ignore logout errors
    }
  }
  async refresh(refreshToken: string): Promise<RefreshPayload> {
    const input: components['schemas']['RefreshTokenRequest'] = { refresh_token: refreshToken };
    const res = await http.post<ApiResponse<RefreshContractPayload>>(API_ENDPOINTS.AUTH.REFRESH, input);
    return unwrapApiResponse(res);
  }
}

export const authRepository: AuthRepository = new ApiAuthRepository();
