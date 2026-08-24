import { http } from '@/src/lib/http/client';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { User } from '@/src/models/User';
import { API_ENDPOINTS } from '@/src/constants/app';
import { AppError } from '@/src/lib/errors/app_error';
import type { components } from '@/src/generated/openapi';
import { normalizeRoles, primaryRole } from '@/src/lib/auth/roles';

type LoginContract = components['schemas']['loginRequest'];
type RegisterContract = components['schemas']['registerRequest'];
type VerificationCodeContract = components['schemas']['sendVerificationCodeRequest'];
type AuthContractPayload = components['schemas']['AuthResult'];
type RefreshContractPayload = components['schemas']['TokenResult'];
type UserContract = components['schemas']['UserView'];
type MeContractPayload = components['schemas']['currentUserResponse'];
type SessionContract = components['schemas']['SessionView'];

export type LoginInput = Omit<LoginContract, 'email' | 'password'> & {
  email: string;
  password: string;
};

export type EmailVerificationCodeInput = Omit<VerificationCodeContract, 'email'> & {
  email: string;
};

export type RegisterInput = Omit<
  RegisterContract,
  'email' | 'password' | 'verification_code' | 'gender' | 'name'
> & {
  email: string;
  password: string;
  verification_code: string;
  gender?: User['gender'];
  name: string;
};

export type AuthPayload = { token: string; user: User; refresh_token?: string };
export type RefreshPayload = { token: string; refresh_token?: string };

export type Session = {
  id: number;
  deviceLabel?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  isCurrent: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

function isGender(gender: string | null | undefined): gender is NonNullable<User['gender']> {
  return gender === 'male' || gender === 'female' || gender === 'other';
}

function requireString(value: string | null | undefined, field: string): string {
  if (!value) throw new AppError(`服务端响应缺少 ${field}`);
  return value;
}

function requireNumber(value: number | null | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new AppError(`服务端响应缺少有效的 ${field}`);
  }
  return value;
}

function toUser(user: UserContract): User {
  const roles = normalizeRoles(user.roles);
  const email = requireString(user.email, '用户邮箱');
  const gender = isGender(user.gender) ? user.gender : null;
  return {
    id: requireNumber(user.id, '用户 ID'),
    email,
    name: user.name?.trim() || email.split('@')[0],
    role: primaryRole(roles),
    roles,
    avatar_url: user.avatar_url ?? null,
    bio: user.bio ?? null,
    gender,
  };
}

function toAuthPayload(payload: AuthContractPayload): AuthPayload {
  if (!payload.user) throw new AppError('服务端响应缺少用户信息');
  return {
    token: requireString(payload.token, '访问令牌'),
    refresh_token: payload.refresh_token || undefined,
    user: toUser(payload.user),
  };
}

function toRefreshPayload(payload: RefreshContractPayload): RefreshPayload {
  return {
    token: requireString(payload.token, '访问令牌'),
    refresh_token: payload.refresh_token || undefined,
  };
}

function toSession(session: SessionContract): Session {
  return {
    id: requireNumber(session.id, '会话 ID'),
    deviceLabel: session.device_label ?? null,
    ip: session.ip ?? null,
    userAgent: session.user_agent ?? null,
    isCurrent: session.is_current ?? false,
    createdAt: requireString(session.created_at, '会话创建时间'),
    lastSeenAt: requireString(session.last_seen_at, '会话最近使用时间'),
    expiresAt: requireString(session.expires_at, '会话过期时间'),
  };
}

export interface AuthRepository {
  login(input: LoginInput): Promise<AuthPayload>;
  requestRegistrationCode(input: EmailVerificationCodeInput): Promise<void>;
  register(input: RegisterInput): Promise<AuthPayload>;
  me(): Promise<{ user: User }>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  listSessions(): Promise<Session[]>;
  revokeSession(sessionId: number): Promise<void>;
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
    if (!payload.user) throw new AppError('服务端响应缺少用户信息');
    return { user: toUser(payload.user) };
  }

  async logout(): Promise<void> {
    try {
      const res = await httpAuth.post<ApiResponse<null>>(API_ENDPOINTS.AUTH.LOGOUT);
      unwrapApiResponse(res);
    } catch {
      // 本地退出必须继续完成，服务端撤销是 best-effort。
    }
  }

  async logoutAll(): Promise<void> {
    const res = await httpAuth.post<ApiResponse<null>>(API_ENDPOINTS.AUTH.LOGOUT_ALL);
    unwrapApiResponse(res);
  }

  async listSessions(): Promise<Session[]> {
    const res = await httpAuth.get<ApiResponse<components['schemas']['sessionsResponse']>>(
      API_ENDPOINTS.AUTH.SESSIONS,
    );
    return (unwrapApiResponse(res).sessions ?? []).map(toSession);
  }

  async revokeSession(sessionId: number): Promise<void> {
    const path = API_ENDPOINTS.AUTH.SESSION.replace(':sessionId', encodeURIComponent(String(sessionId)));
    const res = await httpAuth.delete<ApiResponse<null>>(path);
    unwrapApiResponse(res);
  }

  async refresh(refreshToken: string): Promise<RefreshPayload> {
    const input: components['schemas']['refreshRequest'] = { refresh_token: refreshToken };
    const res = await http.post<ApiResponse<RefreshContractPayload>>(API_ENDPOINTS.AUTH.REFRESH, input);
    return toRefreshPayload(unwrapApiResponse(res));
  }
}

export const authRepository: AuthRepository = new ApiAuthRepository();
