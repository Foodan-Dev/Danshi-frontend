import { authRepository, type RegisterInput } from '@/src/repositories/auth_repository';
import { AuthStorage } from '@/src/lib/auth/auth_storage';
import type { User } from '@/src/models/User';
import { AppError } from '@/src/lib/errors/app_error';
import { REGEX } from '@/src/constants/app';

export type AuthState = { token: string; user: User };

const isEmail = (v: string) => REGEX.EMAIL.test(v);
const isUsername = (v: string) => REGEX.USERNAME.test(v);

export const authService = {
  async login(input: { identifier: string; password: string }): Promise<AuthState> {
    const { identifier, password } = input;
    if (!identifier) throw new AppError('请输入邮箱或用户名');
    const email = isEmail(identifier) ? identifier : undefined;
    const username = !email && isUsername(identifier) ? identifier : undefined;
    if (!email && !username) throw new AppError('请输入有效的邮箱或用户名');
    if (!password) throw new AppError('请输入密码');
    const { token, refresh_token, user } = await authRepository.login({ email, username, password });
    await AuthStorage.setToken(token);
    if (refresh_token) await AuthStorage.setRefreshToken(refresh_token);
    return { token, user };
  },

  async register(input: RegisterInput): Promise<AuthState> {
    if (!input.name || !input.name.trim()) throw new AppError('用户名不能为空');
    if (!input.email || !isEmail(input.email)) throw new AppError('邮箱格式不正确');
    if (!input.password || input.password.length < 8 || input.password.length > 64) throw new AppError('密码长度需 8-64');
    const { token, refresh_token, user } = await authRepository.register(input);
    await AuthStorage.setToken(token);
    if (refresh_token) await AuthStorage.setRefreshToken(refresh_token);
    return { token, user };
  },

  async me(): Promise<User> {
    const { user } = await authRepository.me();
    return user;
  },

  async logout(): Promise<void> {
    await authRepository.logout();
    await AuthStorage.clearToken();
    await AuthStorage.clearRefreshToken();
  },

  async refresh(): Promise<{ token: string; refreshToken?: string }> {
    const rt = await AuthStorage.getRefreshToken();
    if (!rt) throw new AppError('缺少刷新令牌');
    const { token, refresh_token } = await authRepository.refresh(rt);
    await AuthStorage.setToken(token);
    if (refresh_token) await AuthStorage.setRefreshToken(refresh_token);
    return { token, refreshToken: refresh_token };
  },
};
