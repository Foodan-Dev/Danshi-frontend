import { http } from '@/src/lib/http/client';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { User } from '@/src/models/User';
import { API_ENDPOINTS, USE_MOCK } from '@/src/constants/app';

export type LoginInput = { email?: string; username?: string; password: string };
export type RegisterInput = {
  email: string;
  password: string;
  name: string; // 强制必填
  gender?: 'male' | 'female';
  hometown?: string;
  avatar_url?: string | null;
};

export type AuthPayload = { token: string; user: User; refresh_token?: string };
export type RefreshPayload = { token: string; refresh_token?: string };

export interface AuthRepository {
  login(input: LoginInput): Promise<AuthPayload>;
  register(input: RegisterInput): Promise<AuthPayload>;
  me(): Promise<{ user: User }>;
  logout(): Promise<void>;
  refresh(refreshToken: string): Promise<RefreshPayload>;
}

export class ApiAuthRepository implements AuthRepository {
  async login(input: LoginInput): Promise<AuthPayload> {
    const res = await http.post<ApiResponse<AuthPayload>>(API_ENDPOINTS.AUTH.LOGIN, input);
    return unwrapApiResponse<AuthPayload>(res);
  }
  async register(input: RegisterInput): Promise<AuthPayload> {
    const res = await http.post<ApiResponse<AuthPayload>>(API_ENDPOINTS.AUTH.REGISTER, input);
    return unwrapApiResponse<AuthPayload>(res);
  }
  async me(): Promise<{ user: User }> {
    const res = await httpAuth.get<ApiResponse<{ user: User }>>(API_ENDPOINTS.AUTH.ME);
    return unwrapApiResponse<{ user: User }>(res);
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
    const res = await http.post<ApiResponse<RefreshPayload>>(API_ENDPOINTS.AUTH.REFRESH, { refresh_token: refreshToken });
    return unwrapApiResponse<RefreshPayload>(res);
  }
}

// Mock
export class MockAuthRepository implements AuthRepository {
  private mockUser: User = {
    id: '1234567890',
    email: 'knd@example.com',
    name: 'knd',
    gender: 'male',
    hometown: 'Shanghai',
    role: 'admin', // 改为管理员以便访问管理界面
    avatar_url: null,
  };
  private mockPassword: string = 'password123';

  // get avatar
  private computeAvatar(seed: string) {
    const s = seed?.trim() || 'guest';
    return `https://api.dicebear.com/7.x/identicon/png?seed=${encodeURIComponent(s)}`;
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    await new Promise((r) => setTimeout(r, 400));
    // 基于本地 Mock 的严格校验：
    // 1) must provide identifier and password
    // 2) identifier must match current mockUser (email or username)
    // 3) password must match mockPassword
    const providedId = input.email ?? input.username ?? '';
    const idMatch = providedId === this.mockUser.email || providedId === this.mockUser.name;
    const pwdMatch = !!input.password && input.password === this.mockPassword;
    if (!idMatch || !pwdMatch) {
      throw new Error('账号或密码错误');
    }
    const seed = this.mockUser.email || this.mockUser.name;
    this.mockUser = { ...this.mockUser, avatar_url: this.computeAvatar(seed) };
    return { token: 'mock-token', refresh_token: 'mock-refresh-token', user: this.mockUser };
  }
  async register(input: RegisterInput): Promise<AuthPayload> {
    await new Promise((r) => setTimeout(r, 500));
    if (!input.name) throw new Error('用户名不能为空');
    const avatar_url = this.computeAvatar(input.email || input.name);
    this.mockUser = { ...this.mockUser, email: input.email, name: input.name, avatar_url };
    this.mockPassword = input.password;
    return { token: 'mock-token', refresh_token: 'mock-refresh-token', user: this.mockUser };
  }
  async me(): Promise<{ user: User }> {
    await new Promise((r) => setTimeout(r, 200));
    const seed = this.mockUser.email || this.mockUser.name;
    const ensured = this.mockUser.avatar_url ? this.mockUser.avatar_url : this.computeAvatar(seed);
    this.mockUser = { ...this.mockUser, avatar_url: ensured };
    return { user: this.mockUser };
  }
  async logout(): Promise<void> {
    await new Promise((r) => setTimeout(r, 100));
  }
  async refresh(refreshToken: string): Promise<RefreshPayload> {
    await new Promise((r) => setTimeout(r, 300));
    if (!refreshToken) throw new Error('无效的刷新令牌');
    return { token: 'mock-token-refreshed', refresh_token: 'mock-refresh-token-next' };
  }
}

export const authRepository: AuthRepository = USE_MOCK
  ? new MockAuthRepository()
  : new ApiAuthRepository();
