import { API_ENDPOINTS } from '@/src/constants/app';
import type { components } from '@/src/generated/openapi';
import { AppError } from '@/src/lib/errors/app_error';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { requireNumber, requireString, toPagination } from '@/src/repositories/api_mappers';

export type SuggestionKind = 'flavor' | 'cuisine' | 'canteen' | 'canteen_window';
export type FlavorStance = 'has' | 'prefer' | 'avoid';
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export type DictionarySuggestion = {
  id: number;
  kind: SuggestionKind;
  proposedName: string;
  flavorStance: FlavorStance | null;
  status: SuggestionStatus;
  parentCanteenId: number | null;
  parentSuggestionId: number | null;
  resultingCanteenId: number | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};

export type CreateSuggestionInput = {
  kind: SuggestionKind;
  proposedName: string;
  flavorStance?: FlavorStance;
  parentCanteenCode?: string;
  parentSuggestionId?: number;
  postId?: number;
};

export type SuggestionListResult = {
  suggestions: DictionarySuggestion[];
  pagination: ReturnType<typeof toPagination>;
};

type SuggestionContract = components['schemas']['SuggestionView'];

const isKind = (value: string | undefined): value is SuggestionKind =>
  value === 'flavor' || value === 'cuisine' || value === 'canteen' || value === 'canteen_window';
const isStatus = (value: string | undefined): value is SuggestionStatus =>
  value === 'pending' || value === 'approved' || value === 'rejected';
const isFlavorStance = (value: string | null | undefined): value is FlavorStance =>
  value === 'has' || value === 'prefer' || value === 'avoid';

const toSuggestion = (value: SuggestionContract): DictionarySuggestion => {
  if (!isKind(value.kind)) throw new AppError('服务端返回了无效的建议类型');
  if (!isStatus(value.status)) throw new AppError('服务端返回了无效的建议状态');
  return {
    id: requireNumber(value.id, '建议 ID'),
    kind: value.kind,
    proposedName: requireString(value.proposed_name, '建议名称'),
    flavorStance: isFlavorStance(value.flavor_stance) ? value.flavor_stance : null,
    status: value.status,
    parentCanteenId: value.parent_canteen_id ?? null,
    parentSuggestionId: value.parent_suggestion_id ?? null,
    resultingCanteenId: value.resulting_canteen_id ?? null,
    reviewNote: value.review_note ?? null,
    createdAt: requireString(value.created_at, '建议创建时间'),
    updatedAt: requireString(value.updated_at, '建议更新时间'),
    reviewedAt: value.reviewed_at ?? null,
  };
};

const validateId = (value: number | undefined, label: string) => {
  if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
    throw new AppError(`${label}无效`);
  }
};

export const dictionarySuggestionsService = {
  async create(input: CreateSuggestionInput): Promise<DictionarySuggestion> {
    const proposedName = input.proposedName.trim();
    if (!proposedName) throw new AppError('请输入建议名称');
    if (proposedName.length > 50) throw new AppError('建议名称不能超过 50 个字');
    if (input.kind === 'flavor' && !input.flavorStance) throw new AppError('请选择口味用途');
    if (input.kind !== 'flavor' && input.flavorStance) throw new AppError('只有口味建议可以选择用途');
    if (input.kind === 'canteen_window' && !input.parentCanteenCode && !input.parentSuggestionId) {
      throw new AppError('请选择窗口所属食堂');
    }
    validateId(input.parentSuggestionId, '上级建议 ID');
    validateId(input.postId, '帖子 ID');

    const request: components['schemas']['createSuggestionRequest'] = {
      kind: input.kind,
      proposed_name: proposedName,
      flavor_stance: input.flavorStance ?? null,
      parent_canteen_code: input.parentCanteenCode?.trim() || null,
      parent_suggestion_id: input.parentSuggestionId ?? null,
      post_id: input.postId ?? null,
    };
    const response = await httpAuth.post<ApiResponse<SuggestionContract>>(
      API_ENDPOINTS.DICTIONARY_SUGGESTIONS.CREATE,
      request,
    );
    return toSuggestion(unwrapApiResponse(response));
  },

  async mine(): Promise<SuggestionListResult> {
    const response = await httpAuth.get<ApiResponse<components['schemas']['SuggestionList']>>(
      API_ENDPOINTS.DICTIONARY_SUGGESTIONS.MINE,
    );
    const payload = unwrapApiResponse(response);
    return {
      suggestions: (payload.suggestions ?? []).map(toSuggestion),
      pagination: toPagination(payload.pagination),
    };
  },
};
