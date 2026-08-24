import { API_ENDPOINTS } from '@/src/constants/app';
import type { components } from '@/src/generated/openapi';
import { http } from '@/src/lib/http/client';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { PostType, ShareType } from '@/src/models/Post';

export type PostTypeSubType = {
  value: ShareType;
  label: string;
};

export type PostTypeConfig = {
  type: PostType;
  name: string;
  description?: string;
  subTypes: PostTypeSubType[];
  requiredFields: string[];
  recommendedFields: string[];
};

export type CanteenWindowConfig = {
  id: number;
  name: string;
  floor?: string | null;
  isActive: boolean;
};

export type CanteenConfig = {
  code: string;
  name: string;
  campus: string;
  isActive: boolean;
  windows: CanteenWindowConfig[];
};

export type ExploreConfig = {
  postTypes: PostTypeConfig[];
  canteens: CanteenConfig[];
  cuisines: string[];
  flavors: string[];
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedConfig: ExploreConfig | null = null;
let cacheExpiresAt = 0;
let inFlightRequest: Promise<ExploreConfig> | null = null;

const mapPostType = (item: components['schemas']['PostTypeConfig']): PostTypeConfig | null => {
  if ((item.type !== 'share' && item.type !== 'seeking') || !item.name) return null;
  return {
    type: item.type,
    name: item.name,
    description: item.description,
    subTypes: (item.sub_types ?? []).flatMap((subType) => (
      (subType.value === 'recommend' || subType.value === 'warning') && subType.label
        ? [{ value: subType.value, label: subType.label }]
        : []
    )),
    requiredFields: item.required_fields ?? [],
    recommendedFields: item.recommended_fields ?? [],
  };
};

const mapCanteen = (item: components['schemas']['CanteenConfig']): CanteenConfig | null => {
  if (!item.id || !item.name || !item.campus) return null;
  return {
    code: item.id,
    name: item.name,
    campus: item.campus,
    isActive: true,
    windows: (item.windows ?? []).flatMap((window) => (
      typeof window.id === 'number' && window.name
        ? [{
            id: window.id,
            name: window.name,
            floor: window.floor ?? null,
            isActive: true,
          }]
        : []
    )),
  };
};

const fetchConfig = async (): Promise<ExploreConfig> => {
  const response = await http.get<ApiResponse<components['schemas']['ExploreConfig']>>(
    API_ENDPOINTS.CONFIG,
  );
  const data = unwrapApiResponse(response);
  return {
    postTypes: (data.post_types ?? []).flatMap((item) => {
      const mapped = mapPostType(item);
      return mapped ? [mapped] : [];
    }),
    canteens: (data.canteens ?? []).flatMap((item) => {
      const mapped = mapCanteen(item);
      return mapped?.isActive
        ? [{ ...mapped, windows: mapped.windows.filter((window) => window.isActive) }]
        : [];
    }),
    cuisines: data.cuisines ?? [],
    flavors: data.flavors ?? [],
  };
};

const loadConfig = async (force = false): Promise<ExploreConfig> => {
  if (!force && cachedConfig && Date.now() < cacheExpiresAt) return cachedConfig;
  if (!force && inFlightRequest) return inFlightRequest;

  inFlightRequest = fetchConfig()
    .then((config) => {
      cachedConfig = config;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return config;
    })
    .finally(() => {
      inFlightRequest = null;
    });
  return inFlightRequest;
};

export const configService = {
  async getPostTypes(force = false): Promise<PostTypeConfig[]> {
    return [...(await loadConfig(force)).postTypes];
  },

  async getCanteens(force = false): Promise<CanteenConfig[]> {
    return [...(await loadConfig(force)).canteens];
  },

  async getCuisines(force = false): Promise<string[]> {
    return [...(await loadConfig(force)).cuisines];
  },

  async getFlavors(force = false): Promise<string[]> {
    return [...(await loadConfig(force)).flavors];
  },

  async getExploreConfig(force = false): Promise<ExploreConfig> {
    const config = await loadConfig(force);
    return {
      postTypes: [...config.postTypes],
      canteens: [...config.canteens],
      cuisines: [...config.cuisines],
      flavors: [...config.flavors],
    };
  },
};
