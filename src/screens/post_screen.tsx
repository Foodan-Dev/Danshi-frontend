import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	View,
	StyleSheet,
	Pressable,
	Image,
	TextInput as RNTextInput,
	DimensionValue,
	useWindowDimensions,
	Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	Button,
	Chip,
	IconButton,
	Text,
	ActivityIndicator,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { useExtendedTheme } from '@/src/constants/md3_theme';
import { postsService } from '@/src/services/posts_service';
import { CANTEEN_OPTIONS } from '@/src/constants/selects';
import CanteenPicker from '@/src/components/overlays/center_picker';
import ImageUploadGrid from '@/src/components/image_upload_grid';
import ImageViewer from '@/src/components/image_viewer';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/src/context/auth_context';
import { formatCurrentDate } from '@/src/utils/time_format';
import { WEB_NO_OUTLINE } from '@/src/utils';
import { getSafeRemoteUrl } from '@/src/lib/security/url';
import type {
	Category,
	CommonCreateBase,
	Post,
	PostCreateInput,
	PostType,
	SharePostCreateInput,
	ShareType,
} from '@/src/models/Post';

const POST_DRAFT_KEY = '@post_draft';
const DRAFT_SAVE_DELAY = 3000; // 3秒防抖

type PostScreenProps = {
	editMode?: boolean;
	editPostId?: string;
	initialData?: Post | null;
	loading?: boolean;
	onUpdateSuccess?: () => void;
};

export default function PostScreen({
	editMode = false,
	editPostId,
	initialData,
	loading: initialLoading = false,
	onUpdateSuccess,
}: PostScreenProps = {}) {
	const bp = useBreakpoint();
	const router = useRouter();
	const { width: windowWidth } = useWindowDimensions();
	const maxWidth = pickByBreakpoint<DimensionValue>(bp, { base: '100%', sm: 540, md: 580, lg: 620, xl: 660 });
	const horizontalPadding = pickByBreakpoint(bp, { base: 24, sm: 28, md: 32, lg: 36, xl: 40 });
	const insets = useSafeAreaInsets();
	const theme = useExtendedTheme();
	// 发帖页面隐藏了 Tab Bar，底部只需安全区域间距
	const bottomContentPadding = useMemo(() => Math.max(insets.bottom, 16) + 16, [insets.bottom]);
	const { user: currentUser } = useAuth();
	const safeCurrentUserAvatarUrl = useMemo(() => getSafeRemoteUrl(currentUser?.avatar_url), [currentUser?.avatar_url]);

	// 宽屏模式判断（宽度 >= xl 断点时显示左右分栏，隐藏返回按钮）
	// iPad 等中等宽度设备使用窄屏模式，通过预览按钮切换
	const isWideScreen = windowWidth >= 1280;

	// 预览模式状态（仅在窄屏时使用）
	const [isPreviewMode, setIsPreviewMode] = useState(false);

	// 表单状态
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [post_type, setPostType] = useState<PostType>('share');
	const [share_type, setShareType] = useState<ShareType>('recommend');
	const [category, setCategory] = useState<Category>('food');
	const [canteen, setCanteen] = useState('');
	const [cuisine, setCuisine] = useState('');
	const [flavors, setFlavors] = useState<string[]>([]); // 口味标签数组
	const [currentFlavorInput, setCurrentFlavorInput] = useState(''); // 当前正在输入的口味
	const [tags, setTags] = useState<string[]>([]); // 直接存储标签数组
	const [currentTagInput, setCurrentTagInput] = useState(''); // 当前正在输入的话题
	const [price, setPrice] = useState('');
	const [images, setImages] = useState<string[]>([]);
	const [budgetMin, setBudgetMin] = useState('');
	const [budgetMax, setBudgetMax] = useState('');
	const [preferFlavors, setPreferFlavors] = useState<string[]>([]); // 喜欢的口味数组
	const [currentPreferFlavorInput, setCurrentPreferFlavorInput] = useState('');
	const [avoidFlavors, setAvoidFlavors] = useState<string[]>([]); // 不喜欢的口味数组
	const [currentAvoidFlavorInput, setCurrentAvoidFlavorInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [isPendingReview, setIsPendingReview] = useState(false); // 是否处于待审核状态
	const [publishedPostId, setPublishedPostId] = useState<string | null>(null); // 发布成功后的帖子 ID（仅 approved 状态）
	const [canteenPickerOpen, setCanteenPickerOpen] = useState(false);
	const [showTagInput, setShowTagInput] = useState(false);
	const [imageViewer, setImageViewer] = useState<{ visible: boolean; index: number }>({ visible: false, index: 0 });

	// 输入框聚焦状态
	const [titleFocused, setTitleFocused] = useState(false);
	const [contentFocused, setContentFocused] = useState(false);
	const [focusedField, setFocusedField] = useState<string | null>(null);

	// 标记草稿是否已恢复，避免恢复过程触发自动保存
	const draftRestoredRef = useRef(false);
	const normalizedEditPostId = editPostId?.trim() ?? '';
	const editFallbackMessage = editMode
		? !normalizedEditPostId
			? '帖子ID缺失，无法进入编辑状态'
			: !initialLoading && !initialData
				? '帖子内容加载失败或你无权编辑该帖子'
				: ''
		: '';

	// 进入页面时清除上一次的成功提示，并尝试恢复草稿
	useEffect(() => {
		draftRestoredRef.current = false;
		setSuccess('');
		setIsPendingReview(false);
		setPublishedPostId(null);

		// 编辑模式不恢复草稿
		if (editMode) return;

		AsyncStorage.getItem(POST_DRAFT_KEY).then(raw => {
			if (!raw) {
				draftRestoredRef.current = true;
				return;
			}
			try {
				const draft = JSON.parse(raw);
				// 判断草稿是否有实质内容
				const hasContent = draft.title?.trim() || draft.content?.trim() || (draft.images?.length > 0);
				if (!hasContent) {
					AsyncStorage.removeItem(POST_DRAFT_KEY);
					draftRestoredRef.current = true;
					return;
				}
				const doRestore = () => {
					setTitle(draft.title || '');
					setContent(draft.content || '');
					setPostType(draft.post_type || 'share');
					setShareType(draft.share_type || 'recommend');
					setCategory(draft.category || 'food');
					setCanteen(draft.canteen || '');
					setCuisine(draft.cuisine || '');
					setFlavors(draft.flavors || []);
					setTags(draft.tags || []);
					setPrice(draft.price || '');
					setImages(draft.images || []);
					setBudgetMin(draft.budgetMin || '');
					setBudgetMax(draft.budgetMax || '');
					setPreferFlavors(draft.preferFlavors || []);
					setAvoidFlavors(draft.avoidFlavors || []);
					draftRestoredRef.current = true;
				};
				if (Platform.OS === 'web') {
					// Web 端 Alert.alert 不可用，直接恢复
					doRestore();
				} else {
					Alert.alert('发现未完成的草稿', '是否恢复上次编辑的内容？', [
						{ text: '丢弃', style: 'cancel', onPress: () => {
							AsyncStorage.removeItem(POST_DRAFT_KEY);
							draftRestoredRef.current = true;
						}},
						{ text: '恢复', onPress: doRestore },
					]);
				}
			} catch {
				AsyncStorage.removeItem(POST_DRAFT_KEY);
				draftRestoredRef.current = true;
			}
		}).catch(() => {
			draftRestoredRef.current = true;
		});
	}, [editMode]);

	// 自动保存草稿（防抖 3 秒，仅新建模式）
	useEffect(() => {
		if (editMode || !draftRestoredRef.current) return;

		const hasContent = title.trim() || content.trim() || images.length > 0;
		if (!hasContent) {
			AsyncStorage.removeItem(POST_DRAFT_KEY).catch(() => {});
			return;
		}

		const timer = setTimeout(() => {
			const draft = {
				title, content, post_type, share_type, category, canteen,
				cuisine, flavors, tags, price, images,
				budgetMin, budgetMax, preferFlavors, avoidFlavors,
			};
			AsyncStorage.setItem(POST_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
		}, DRAFT_SAVE_DELAY);

		return () => clearTimeout(timer);
	}, [
		editMode, title, content, post_type, share_type, category, canteen,
		cuisine, flavors, tags, price, images,
		budgetMin, budgetMax, preferFlavors, avoidFlavors,
	]);

	// 编辑模式：从 initialData 初始化表单
	useEffect(() => {
		if (editMode && initialData && !initialLoading) {
			setTitle(initialData.title || '');
			setContent(initialData.content || '');
			setPostType(initialData.post_type || 'share');
			setShareType(initialData.post_type === 'share' ? initialData.share_type || 'recommend' : 'recommend');
			setCuisine(initialData.post_type === 'share' ? initialData.cuisine || '' : '');
			setFlavors(initialData.post_type === 'share' ? initialData.flavors || [] : []);
			setPrice(initialData.post_type === 'share' ? initialData.price?.toString() || '' : '');
			setCategory(initialData.category || 'food');
			setCanteen(initialData.canteen || '');
			setTags(initialData.tags || []);
			setImages(initialData.images?.length ? initialData.images : []);
			setBudgetMin(initialData.post_type === 'seeking' ? initialData.budget_range?.min?.toString() || '' : '');
			setBudgetMax(initialData.post_type === 'seeking' ? initialData.budget_range?.max?.toString() || '' : '');
			setPreferFlavors(initialData.post_type === 'seeking' ? initialData.preferences?.prefer_flavors || [] : []);
			setAvoidFlavors(initialData.post_type === 'seeking' ? initialData.preferences?.avoid_flavors || [] : []);
			setCurrentFlavorInput('');
			setCurrentTagInput('');
			setCurrentPreferFlavorInput('');
			setCurrentAvoidFlavorInput('');
		}
	}, [editMode, initialData, initialLoading]);

	// 话题数组（去重，最多10个）
	const parsedTags = useMemo(() => {
		return Array.from(new Set(tags)).slice(0, 10);
	}, [tags]);

	// 添加话题的处理函数
	const handleAddTag = useCallback((text: string) => {
		const trimmed = text.trim().replace(/^#/, ''); // 去除开头的 # 符号
		if (!trimmed) return;
		if (tags.length >= 10) return; // 最多10个
		if (tags.includes(trimmed)) return; // 去重
		setTags((prev) => [...prev, trimmed]);
		setCurrentTagInput('');
	}, [tags]);

	// 处理话题输入变化（检测空格/回车）
	const handleTagInputChange = useCallback((text: string) => {
		// 检测空格或换行符，触发添加标签
		if (text.endsWith(' ') || text.endsWith('\n')) {
			const tagText = text.slice(0, -1);
			if (tagText.trim()) {
				handleAddTag(tagText);
			}
		} else {
			setCurrentTagInput(text);
		}
	}, [handleAddTag]);

	// 处理话题输入提交（回车键）
	const handleTagInputSubmit = useCallback(() => {
		if (currentTagInput.trim()) {
			handleAddTag(currentTagInput);
		}
	}, [currentTagInput, handleAddTag]);

	// 删除话题
	const handleRemoveTag = useCallback((index: number) => {
		setTags((prev) => prev.filter((_, i) => i !== index));
	}, []);

	// ==================== 口味标签处理函数 ====================
	// 添加口味标签
	const handleAddFlavor = useCallback((text: string) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		if (flavors.length >= 10) return;
		if (flavors.includes(trimmed)) return;
		setFlavors((prev) => [...prev, trimmed]);
		setCurrentFlavorInput('');
	}, [flavors]);

	// 处理口味输入变化（检测空格/回车）
	const handleFlavorInputChange = useCallback((text: string) => {
		if (text.endsWith(' ') || text.endsWith('\n') || text.endsWith(',') || text.endsWith('，')) {
			const flavorText = text.slice(0, -1);
			if (flavorText.trim()) {
				handleAddFlavor(flavorText);
			}
		} else {
			setCurrentFlavorInput(text);
		}
	}, [handleAddFlavor]);

	// 处理口味输入提交（回车键）
	const handleFlavorInputSubmit = useCallback(() => {
		if (currentFlavorInput.trim()) {
			handleAddFlavor(currentFlavorInput);
		}
	}, [currentFlavorInput, handleAddFlavor]);

	// 删除口味标签
	const handleRemoveFlavor = useCallback((index: number) => {
		setFlavors((prev) => prev.filter((_, i) => i !== index));
	}, []);

	// ==================== 喜欢口味处理函数 ====================
	const handleAddPreferFlavor = useCallback((text: string) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		if (preferFlavors.length >= 10) return;
		if (preferFlavors.includes(trimmed)) return;
		setPreferFlavors((prev) => [...prev, trimmed]);
		setCurrentPreferFlavorInput('');
	}, [preferFlavors]);

	const handlePreferFlavorInputChange = useCallback((text: string) => {
		if (text.endsWith(' ') || text.endsWith('\n') || text.endsWith(',') || text.endsWith('，')) {
			const flavorText = text.slice(0, -1);
			if (flavorText.trim()) {
				handleAddPreferFlavor(flavorText);
			}
		} else {
			setCurrentPreferFlavorInput(text);
		}
	}, [handleAddPreferFlavor]);

	const handlePreferFlavorInputSubmit = useCallback(() => {
		if (currentPreferFlavorInput.trim()) {
			handleAddPreferFlavor(currentPreferFlavorInput);
		}
	}, [currentPreferFlavorInput, handleAddPreferFlavor]);

	const handleRemovePreferFlavor = useCallback((index: number) => {
		setPreferFlavors((prev) => prev.filter((_, i) => i !== index));
	}, []);

	// ==================== 不喜欢口味处理函数 ====================
	const handleAddAvoidFlavor = useCallback((text: string) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		if (avoidFlavors.length >= 10) return;
		if (avoidFlavors.includes(trimmed)) return;
		setAvoidFlavors((prev) => [...prev, trimmed]);
		setCurrentAvoidFlavorInput('');
	}, [avoidFlavors]);

	const handleAvoidFlavorInputChange = useCallback((text: string) => {
		if (text.endsWith(' ') || text.endsWith('\n') || text.endsWith(',') || text.endsWith('，')) {
			const flavorText = text.slice(0, -1);
			if (flavorText.trim()) {
				handleAddAvoidFlavor(flavorText);
			}
		} else {
			setCurrentAvoidFlavorInput(text);
		}
	}, [handleAddAvoidFlavor]);

	const handleAvoidFlavorInputSubmit = useCallback(() => {
		if (currentAvoidFlavorInput.trim()) {
			handleAddAvoidFlavor(currentAvoidFlavorInput);
		}
	}, [currentAvoidFlavorInput, handleAddAvoidFlavor]);

	const handleRemoveAvoidFlavor = useCallback((index: number) => {
		setAvoidFlavors((prev) => prev.filter((_, i) => i !== index));
	}, []);
	const filtered_images = useMemo(
		() => images.filter((url) => url && /^https?:\/\//i.test(url.trim())),
		[images]
	);

	const handleBack = useCallback(() => {
		if (router.canGoBack()) {
			router.back();
		} else {
			router.replace('/');
		}
	}, [router]);

	const togglePreviewMode = useCallback(() => {
		setIsPreviewMode((prev) => !prev);
	}, []);

	const handleOpenImageViewer = useCallback((index: number) => {
		setImageViewer({ visible: true, index });
	}, []);

	const handleCloseImageViewer = useCallback(() => {
		setImageViewer((prev) => ({ ...prev, visible: false }));
	}, []);

	const resetForm = () => {
		setTitle('');
		setContent('');
		setPostType('share');
		setShareType('recommend');
		setCategory('food');
		setCanteen('');
		setCuisine('');
		setFlavors([]);
		setCurrentFlavorInput('');
		setTags([]);
		setCurrentTagInput('');
		setPrice('');
		setImages([]);
		setBudgetMin('');
		setBudgetMax('');
		setPreferFlavors([]);
		setCurrentPreferFlavorInput('');
		setAvoidFlavors([]);
		setCurrentAvoidFlavorInput('');
		AsyncStorage.removeItem(POST_DRAFT_KEY).catch(() => {});
	};

	const validate = (): string => {
		if (!title.trim()) return '请输入标题';
		if (title.trim().length < 2) return '标题至少 2 个字';
		if (!content.trim()) return '请输入正文内容';
		if (content.trim().length < 5) return '正文至少 5 个字';
		if (post_type === 'share') {
			if (!filtered_images.length) return '请至少上传 1 张图片';
			if (price && Number(price) < 0) return '价格需是正数';
		}
		if (post_type === 'seeking') {
			if ((budgetMin && Number(budgetMin) < 0) || (budgetMax && Number(budgetMax) < 0)) {
				return '预算不能为负数';
			}
			if (budgetMin && budgetMax && Number(budgetMax) < Number(budgetMin)) {
				return '预算上限需大于等于下限';
			}
		}
		return '';
	};

	const onSubmit = async () => {
		setError('');
		setSuccess('');
		if (!currentUser) {
			setError(editMode ? '请先登录后再编辑帖子' : '请先登录后再发布帖子');
			if (!isWideScreen) {
				setIsPreviewMode(true);
			}
			return;
		}
		if (editMode && !normalizedEditPostId) {
			setError('帖子ID缺失，无法保存修改');
			return;
		}
		if (editMode && !initialLoading && !initialData) {
			setError('帖子内容未加载完成，暂时无法保存修改');
			return;
		}
		const errorMessage = validate();
		if (errorMessage) {
			setError(errorMessage);
			return;
		}
		setLoading(true);
		try {
			const common_fields: Omit<CommonCreateBase, 'post_type'> = {
				title: title.trim(),
				content: content.trim(),
				category,
				canteen: canteen.trim() || undefined,
				tags: parsedTags.length ? parsedTags : undefined,
				images: filtered_images.length ? filtered_images.slice(0, 9) : undefined,
			};
			let payload: PostCreateInput;
			if (post_type === 'share') {
				const sharePayload: SharePostCreateInput = {
					post_type: 'share',
					...common_fields,
					share_type: share_type,
					cuisine: cuisine.trim() || undefined,
					flavors: flavors.length ? flavors : undefined,
					price: price ? Number(price) : undefined,
					images: filtered_images.slice(0, 9),
				};
				payload = sharePayload;
			} else {
				const toNumber = (value: string) => {
					const parsed = Number.parseFloat(value);
					return Number.isFinite(parsed) ? parsed : undefined;
				};
				const minBudget = toNumber(budgetMin);
				const maxBudget = toNumber(budgetMax);
				payload = {
					post_type: 'seeking',
					...common_fields,
					budget_range:
						typeof minBudget !== 'undefined' || typeof maxBudget !== 'undefined'
							? {
									min: typeof minBudget !== 'undefined' ? minBudget : 0,
									max:
										typeof maxBudget !== 'undefined'
											? maxBudget
											: typeof minBudget !== 'undefined'
												? minBudget
												: 0,
								}
							: undefined,
					preferences:
						preferFlavors.length || avoidFlavors.length
							? {
									prefer_flavors: preferFlavors,
									avoid_flavors: avoidFlavors,
								}
							: undefined,
				};
			}

			if (editMode && normalizedEditPostId) {
				await postsService.update(normalizedEditPostId, payload);
				setIsPendingReview(true);
				setSuccess('更新成功！帖子已提交管理员审核，审核通过后将公开显示。');
				onUpdateSuccess?.();
			} else {
				await postsService.create(payload);
				// 发布成功后清除草稿并跳转到探索界面
				await AsyncStorage.removeItem(POST_DRAFT_KEY).catch(() => {});
				resetForm();
				// 使用 replace 替换当前页面，避免用户返回到发布页面
				router.replace('/(tabs)/explore');
			}
		} catch (err) {
			setError((err as Error)?.message ?? '发布失败，请稍后重试');
			// 切换到预览模式显示错误（仅窄屏时）
			if (!isWideScreen) {
				setIsPreviewMode(true);
			}
		} finally {
			setLoading(false);
		}
	};

	const content_count = content.trim().length;

	// 编辑模式加载中状态
	if (editMode && initialLoading) {
		return (
			<View style={[styles.container, { backgroundColor: theme.colors.background }]}>
				<View style={styles.loadingWrapper}>
					<ActivityIndicator size="large" color={theme.colors.primary} />
					<Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
						正在加载...
					</Text>
				</View>
			</View>
		);
	}

	if (editFallbackMessage) {
		return (
			<View style={[styles.container, { backgroundColor: theme.colors.background }]}>
				<View style={styles.loadingWrapper}>
					<Text style={{ color: theme.colors.onSurface, marginBottom: 12 }}>
						{editFallbackMessage}
					</Text>
					<Button mode="contained-tonal" onPress={handleBack}>
						返回
					</Button>
				</View>
			</View>
		);
	}

	// ==================== 预览模式渲染 ====================
	const renderPreviewMode = () => (
		<ScrollView
			style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
			contentContainerStyle={[
				styles.scrollContent,
				{ paddingHorizontal: horizontalPadding, paddingBottom: bottomContentPadding },
			]}
			showsVerticalScrollIndicator={false}
		>
			<View style={[styles.contentWrapper, { maxWidth }]}>
				{/* 错误/成功提示 - 在预览模式显示 */}
				{!!error && (
					<View
						style={[styles.messageCard, { backgroundColor: theme.colors.errorContainer }]}
					>
						<Ionicons name="alert-circle" size={18} color={theme.colors.error} />
						<Text style={{ color: theme.colors.error, flex: 1, fontSize: 14 }}>
							{error}
						</Text>
						<IconButton
							icon="close"
							size={16}
							iconColor={theme.colors.error}
							onPress={() => setError('')}
							style={styles.messageDismiss}
						/>
					</View>
				)}
				{!!success && (
					<View
						style={[styles.messageCard, { backgroundColor: theme.colors.primaryContainer }]}
					>
						<Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
						<Text style={{ color: theme.colors.primary, flex: 1, fontSize: 14 }}>
							{success}
						</Text>
						<IconButton
							icon="close"
							size={16}
							iconColor={theme.colors.primary}
							onPress={() => setSuccess('')}
							style={styles.messageDismiss}
						/>
					</View>
				)}
				{/* 预览：图片画廊 */}
				{filtered_images.length > 0 && (
					<View style={styles.narrowPreviewImageGrid}>
						{filtered_images.slice(0, 9).map((url, idx) => (
							<Pressable key={idx} style={styles.narrowPreviewImageItem} onPress={() => handleOpenImageViewer(idx)}>
								<Image
									source={{ uri: url }}
									style={styles.narrowPreviewImage}
									resizeMode="cover"
								/>
							</Pressable>
						))}
					</View>
				)}

				{/* 预览：标题 */}
				<Text
					variant="headlineSmall"
					style={[
						styles.narrowPreviewTitle,
						{ color: title ? theme.colors.onSurface : theme.colors.outline },
					]}
				>
					{title || '标题预览'}
				</Text>

				{/* 预览：元信息标签 */}
				<View style={styles.narrowPreviewMetaRow}>
					{post_type === 'share' && (
						<View
							style={[
								styles.narrowPreviewBadge,
								{
									backgroundColor:
										share_type === 'recommend'
											? theme.colors.tertiaryContainer
											: theme.colors.errorContainer,
								},
							]}
						>
							<Text
								style={{
									color:
										share_type === 'recommend'
											? theme.colors.tertiary
											: theme.colors.error,
									fontSize: 12,
									fontWeight: '600',
								}}
							>
								{share_type === 'recommend' ? '推荐' : '避雷'}
							</Text>
						</View>
					)}
					{canteen && (
						<View style={styles.narrowPreviewLocationBadge}>
							<Ionicons
								name="location"
								size={12}
								color={theme.colors.onSurfaceVariant}
							/>
							<Text
								style={{
									color: theme.colors.onSurfaceVariant,
									fontSize: 12,
									marginLeft: 2,
								}}
							>
								{canteen}
							</Text>
						</View>
					)}
				</View>

				{/* 预览：正文 */}
				<Text
					style={[
						styles.narrowPreviewContent,
						{ color: content ? theme.colors.onSurface : theme.colors.outline },
					]}
				>
					{content || '正文内容预览...'}
				</Text>

				{/* 预览：话题标签 */}
				{parsedTags.length > 0 && (
					<View style={styles.narrowPreviewTagsRow}>
						{parsedTags.map((tag, idx) => (
							<Text
								key={idx}
								style={[styles.narrowPreviewTag, { color: theme.colors.primary }]}
							>
								#{tag}
							</Text>
						))}
					</View>
				)}
			</View>
		</ScrollView>
	);

	// ==================== 编辑模式渲染 ====================
	const renderEditMode = () => (
		<ScrollView
			style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
			contentContainerStyle={[
				styles.scrollContent,
				{ paddingHorizontal: horizontalPadding, paddingBottom: bottomContentPadding },
			]}
			keyboardShouldPersistTaps="handled"
			showsVerticalScrollIndicator={false}
		>
			<View style={[styles.contentWrapper, { maxWidth }]}>
				{/* 错误/成功提示 */}
				{!!error && (
					<View
						style={[styles.messageCard, { backgroundColor: theme.colors.errorContainer }]}
					>
						<Ionicons name="alert-circle" size={18} color={theme.colors.error} />
						<Text style={{ color: theme.colors.error, flex: 1, fontSize: 14 }}>
							{error}
						</Text>
						<IconButton
							icon="close"
							size={16}
							iconColor={theme.colors.error}
							onPress={() => setError('')}
							style={styles.messageDismiss}
						/>
					</View>
				)}
				{!!success && (
					<View
						style={[
							styles.messageCard,
							{
								backgroundColor: isPendingReview
									? theme.colors.secondaryContainer
									: theme.colors.tertiaryContainer,
								borderWidth: isPendingReview ? 1 : 0,
								borderColor: isPendingReview ? theme.colors.secondary : undefined,
							},
						]}
					>
						<Ionicons
							name={isPendingReview ? 'time-outline' : 'checkmark-circle'}
							size={isPendingReview ? 22 : 18}
							color={isPendingReview ? theme.colors.secondary : theme.colors.tertiary}
						/>
						<View style={{ flex: 1 }}>
							<Text
								style={{
									color: isPendingReview ? theme.colors.secondary : theme.colors.tertiary,
									flex: 1,
									fontSize: isPendingReview ? 15 : 14,
									fontWeight: isPendingReview ? '600' : 'normal',
								}}
							>
								{success}
							</Text>
							{isPendingReview && (
								<Text
									style={{
										color: theme.colors.onSecondaryContainer,
										fontSize: 12,
										marginTop: 4,
										opacity: 0.8,
									}}
								>
									您可以在「我的 - 我的帖子」中查看审核状态
								</Text>
							)}
							{/* 已审核通过：显示查看帖子按钮 */}
							{publishedPostId && !isPendingReview && (
								<Pressable
									style={[
										styles.viewPostBtn,
										{ backgroundColor: theme.colors.tertiary },
									]}
									onPress={() => {
										setSuccess('');
										setPublishedPostId(null);
										router.push(`/post/${publishedPostId}`);
									}}
								>
									<Ionicons name="eye-outline" size={16} color={theme.colors.onTertiary} />
									<Text style={{ color: theme.colors.onTertiary, fontSize: 13, fontWeight: '600' }}>
										查看帖子
									</Text>
								</Pressable>
							)}
						</View>
						<IconButton
							icon="close"
							size={16}
							iconColor={isPendingReview ? theme.colors.secondary : theme.colors.tertiary}
							onPress={() => {
								setSuccess('');
								setIsPendingReview(false);
								setPublishedPostId(null);
							}}
							style={styles.messageDismiss}
						/>
					</View>
				)}

				{/* ==================== 沉浸式输入区 ==================== */}

				{/* 标题输入 - 聚焦时显示淡色背景 */}
				<RNTextInput
					value={title}
					onChangeText={setTitle}
					placeholder="填写标题"
					placeholderTextColor={theme.colors.outline}
					maxLength={80}
					onFocus={() => setTitleFocused(true)}
					onBlur={() => setTitleFocused(false)}
					style={[
						styles.titleInput,
						{
							color: theme.colors.onSurface,
							backgroundColor: titleFocused ? theme.colors.surfaceVariant : 'transparent',
							borderRadius: 8,
							padding: titleFocused ? 12 : 0,
						},
						WEB_NO_OUTLINE,
					]}
				/>

				{/* 正文输入 - 聚焦时显示淡色背景 */}
				<RNTextInput
					value={content}
					onChangeText={setContent}
					placeholder="分享你的美食体验，让更多人发现美味..."
					placeholderTextColor={theme.colors.outline}
					multiline
					textAlignVertical="top"
					onFocus={() => setContentFocused(true)}
					onBlur={() => setContentFocused(false)}
					style={[
						styles.contentInput, 
						{ 
							color: theme.colors.onSurface,
							backgroundColor: contentFocused ? theme.colors.surfaceVariant : 'transparent',
							borderRadius: 8,
							padding: contentFocused ? 12 : 0,
						},
						WEB_NO_OUTLINE,
					]}
				/>
				<Text style={[styles.charCount, { color: theme.colors.outline }]}>
					{content_count} 字
				</Text>

				{/* ==================== 工具栏 (地点 + 话题) ==================== */}
				<View style={styles.toolbarRow}>
					{/* 地点按钮 - 选中态使用15%透明度主题色 */}
					<Pressable
						style={[
							styles.toolbarBtn,
							{ 
								borderColor: canteen ? 'transparent' : theme.colors.outlineVariant,
								backgroundColor: canteen ? `${theme.colors.primary}15` : 'transparent',
							},
						]}
						onPress={() => setCanteenPickerOpen(true)}
					>
						<Ionicons
							name={canteen ? 'location' : 'location-outline'}
							size={16}
							color={canteen ? theme.colors.primary : theme.colors.onSurfaceVariant}
						/>
						<Text
							style={[
								styles.toolbarBtnText,
								{
									color: canteen
										? theme.colors.primary
										: theme.colors.onSurfaceVariant,
								},
							]}
							numberOfLines={1}
						>
							{canteen || '添加地点'}
						</Text>
						{canteen && (
							<Pressable
								onPress={(e) => {
									e.stopPropagation();
									setCanteen('');
								}}
								hitSlop={8}
							>
								<Ionicons
									name="close-circle"
									size={14}
									color={theme.colors.primary}
								/>
							</Pressable>
						)}
					</Pressable>

					{/* 话题按钮 - 选中态使用15%透明度主题色 */}
					<Pressable
						style={[
							styles.toolbarBtn,
							{ 
								borderColor: parsedTags.length > 0 ? 'transparent' : theme.colors.outlineVariant,
								backgroundColor: parsedTags.length > 0 ? `${theme.colors.primary}15` : 'transparent',
							},
						]}
						onPress={() => setShowTagInput(true)}
					>
						<Ionicons
							name={parsedTags.length > 0 ? 'pricetag' : 'pricetag-outline'}
							size={16}
							color={
								parsedTags.length > 0
									? theme.colors.primary
									: theme.colors.onSurfaceVariant
							}
						/>
						<Text
							style={[
								styles.toolbarBtnText,
								{
									color:
										parsedTags.length > 0
											? theme.colors.primary
											: theme.colors.onSurfaceVariant,
								},
							]}
						>
							{parsedTags.length > 0 ? `${parsedTags.length} 个话题` : '添加话题'}
						</Text>
					</Pressable>
				</View>

				{/* 话题输入区 - 现代标签输入交互 */}
				{showTagInput && (
					<View
						style={[
							styles.tagInputSection,
							{ 
								backgroundColor: theme.colors.surfaceVariant,
							},
						]}
					>
						{/* 已添加的话题标签（显示在输入框内）- 15%透明度主题色 */}
						{parsedTags.length > 0 && (
							<View style={styles.tagInputTags}>
								{parsedTags.map((tag, idx) => (
									<View
										key={idx}
										style={[
											styles.tagInputChip,
											{ backgroundColor: `${theme.colors.primary}15` },
										]}
									>
										<Text style={{ color: theme.colors.primary, fontSize: 13 }}>#{tag}</Text>
										<Pressable
											onPress={() => handleRemoveTag(idx)}
											hitSlop={4}
											style={styles.tagInputChipClose}
										>
											<Ionicons name="close" size={14} color={theme.colors.primary} />
										</Pressable>
									</View>
								))}
							</View>
						)}
						<View style={styles.tagInputRow}>
							<RNTextInput
								value={currentTagInput}
								onChangeText={handleTagInputChange}
								onSubmitEditing={handleTagInputSubmit}
								placeholder={parsedTags.length >= 10 ? '已达上限' : '输入话题，按空格添加'}
								placeholderTextColor={theme.colors.outline}
								editable={parsedTags.length < 10}
								returnKeyType="done"
								blurOnSubmit={false}
								style={[
									styles.tagTextInput, 
									{ color: theme.colors.onSurface },
									WEB_NO_OUTLINE,
								]}
								autoFocus
							/>
							{/* 完成按钮 - 纯文字样式，不抢戏 */}
							<Pressable
								style={styles.tagInputDone}
								onPress={() => {
									// 先添加当前输入的话题（如果有）
									if (currentTagInput.trim()) {
										handleAddTag(currentTagInput);
									}
									setShowTagInput(false);
								}}
							>
								<Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>完成</Text>
							</Pressable>
						</View>
						{parsedTags.length > 0 && (
							<Text style={[styles.tagCountHint, { color: theme.colors.outline }]}>
								{parsedTags.length}/10 个话题
							</Text>
						)}
					</View>
				)}

				{/* 已添加的话题展示（输入框关闭时显示）- 15%透明度主题色 */}
				{!showTagInput && parsedTags.length > 0 && (
					<View style={styles.tagsDisplay}>
						{parsedTags.map((tag, idx) => (
							<Chip
								key={idx}
								compact
								mode="flat"
								closeIcon="close"
								onClose={() => handleRemoveTag(idx)}
								style={[
									styles.tagChip,
									{ backgroundColor: `${theme.colors.primary}15` },
								]}
								textStyle={{ color: theme.colors.primary, fontSize: 13 }}
							>
								#{tag}
							</Chip>
						))}
					</View>
				)}

				{/* ==================== 图片上传区 ==================== */}
				<ImageUploadGrid
					images={images}
					onImagesChange={setImages}
					maxImages={9}
					onImagePress={handleOpenImageViewer}
				/>

				{/* ==================== 分享类型扩展信息 ==================== */}
				{post_type === 'share' && (
					<View style={styles.extraSection}>
						<Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
							更多信息（可选）
						</Text>
						<View style={styles.extraGrid}>
							<View style={styles.extraItem}>
								<Text style={[styles.extraLabel, { color: theme.colors.outline }]}>
									菜系
								</Text>
								<RNTextInput
									value={cuisine}
									onChangeText={setCuisine}
									placeholder="如：川菜、粤菜"
									placeholderTextColor={theme.colors.outline}
									onFocus={() => setFocusedField('cuisine')}
									onBlur={() => setFocusedField(null)}
									style={[
										styles.extraInput,
										{
											color: theme.colors.onSurface,
											borderBottomColor: focusedField === 'cuisine' ? theme.colors.primary : theme.colors.outlineVariant,
											borderBottomWidth: focusedField === 'cuisine' ? 2 : 1,
										},
										WEB_NO_OUTLINE,
									]}
								/>
							</View>
							<View style={styles.extraItem}>
								<Text style={[styles.extraLabel, { color: theme.colors.outline }]}>
									价格
								</Text>
								<View style={styles.priceInputRow}>
									<Text style={{ color: theme.colors.outline }}>¥</Text>
									<RNTextInput
										value={price}
										onChangeText={setPrice}
										placeholder="0"
										placeholderTextColor={theme.colors.outline}
										keyboardType="decimal-pad"
										onFocus={() => setFocusedField('price')}
										onBlur={() => setFocusedField(null)}
										style={[
											styles.extraInput,
											styles.priceInput,
											{
												color: theme.colors.onSurface,
												borderBottomColor: focusedField === 'price' ? theme.colors.primary : theme.colors.outlineVariant,
												borderBottomWidth: focusedField === 'price' ? 2 : 1,
											},
											WEB_NO_OUTLINE,
										]}
									/>
								</View>
							</View>
						</View>

						{/* 口味标签 */}
						<View style={styles.flavorSection}>
							<Text style={[styles.extraLabel, { color: theme.colors.outline }]}>
								口味标签
							</Text>
							{flavors.length > 0 && (
								<View style={styles.flavorsDisplay}>
									{flavors.map((flavor, idx) => (
										<View
											key={idx}
											style={[
												styles.tagInputChip,
												{ backgroundColor: `${theme.colors.primary}15` },
											]}
										>
											<Text style={{ color: theme.colors.primary, fontSize: 13 }}>{flavor}</Text>
											<Pressable
												onPress={() => handleRemoveFlavor(idx)}
												hitSlop={4}
												style={styles.tagInputChipClose}
											>
												<Ionicons name="close" size={14} color={theme.colors.primary} />
											</Pressable>
										</View>
									))}
								</View>
							)}
							<RNTextInput
								value={currentFlavorInput}
								onChangeText={handleFlavorInputChange}
								onSubmitEditing={handleFlavorInputSubmit}
								placeholder={flavors.length >= 10 ? '已达上限' : '输入口味，按空格添加'}
								placeholderTextColor={theme.colors.outline}
								editable={flavors.length < 10}
								returnKeyType="done"
								blurOnSubmit={false}
								onFocus={() => setFocusedField('flavors')}
								onBlur={() => setFocusedField(null)}
								style={[
									styles.extraInput,
									{
										color: theme.colors.onSurface,
										borderBottomColor: focusedField === 'flavors' ? theme.colors.primary : theme.colors.outlineVariant,
										borderBottomWidth: focusedField === 'flavors' ? 2 : 1,
									},
									WEB_NO_OUTLINE,
								]}
							/>
						</View>
					</View>
				)}

				{/* ==================== 求推荐扩展信息 ==================== */}
				{post_type === 'seeking' && (
					<View style={styles.extraSection}>
						<Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
							更多信息（可选）
						</Text>

						{/* 预算范围 */}
						<Text
							style={[
								styles.extraLabel,
								{ color: theme.colors.outline, marginBottom: 8 },
							]}
						>
							预算范围
						</Text>
						<View style={styles.budgetRow}>
							<View style={styles.budgetInputWrap}>
								<Text style={{ color: theme.colors.outline }}>¥</Text>
								<RNTextInput
									value={budgetMin}
									onChangeText={setBudgetMin}
									placeholder="最低"
									placeholderTextColor={theme.colors.outline}
									keyboardType="numeric"
									onFocus={() => setFocusedField('budgetMin')}
									onBlur={() => setFocusedField(null)}
									style={[
										styles.budgetInput,
										{
											color: theme.colors.onSurface,
											borderBottomColor: focusedField === 'budgetMin' ? theme.colors.primary : theme.colors.outlineVariant,
											borderBottomWidth: focusedField === 'budgetMin' ? 2 : 1,
										},
										WEB_NO_OUTLINE,
									]}
								/>
							</View>
							<Text style={{ color: theme.colors.outline }}>—</Text>
							<View style={styles.budgetInputWrap}>
								<Text style={{ color: theme.colors.outline }}>¥</Text>
								<RNTextInput
									value={budgetMax}
									onChangeText={setBudgetMax}
									placeholder="最高"
									placeholderTextColor={theme.colors.outline}
									keyboardType="numeric"
									onFocus={() => setFocusedField('budgetMax')}
									onBlur={() => setFocusedField(null)}
									style={[
										styles.budgetInput,
										{
											color: theme.colors.onSurface,
											borderBottomColor: focusedField === 'budgetMax' ? theme.colors.primary : theme.colors.outlineVariant,
											borderBottomWidth: focusedField === 'budgetMax' ? 2 : 1,
										},
										WEB_NO_OUTLINE,
									]}
								/>
							</View>
						</View>

						{/* 口味偏好 */}
						<View style={[styles.flavorSection, { marginTop: 20 }]}>
							<Text style={[styles.extraLabel, { color: theme.colors.tertiary }]}>
								喜欢的口味
							</Text>
							{preferFlavors.length > 0 && (
								<View style={styles.flavorsDisplay}>
									{preferFlavors.map((flavor, idx) => (
										<View
											key={idx}
											style={[
												styles.tagInputChip,
												{ backgroundColor: `${theme.colors.tertiary}15` },
											]}
										>
											<Text style={{ color: theme.colors.tertiary, fontSize: 13 }}>{flavor}</Text>
											<Pressable
												onPress={() => handleRemovePreferFlavor(idx)}
												hitSlop={4}
												style={styles.tagInputChipClose}
											>
												<Ionicons name="close" size={14} color={theme.colors.tertiary} />
											</Pressable>
										</View>
									))}
								</View>
							)}
							<RNTextInput
								value={currentPreferFlavorInput}
								onChangeText={handlePreferFlavorInputChange}
								onSubmitEditing={handlePreferFlavorInputSubmit}
								placeholder={preferFlavors.length >= 10 ? '已达上限' : '输入口味，按空格添加'}
								placeholderTextColor={theme.colors.outline}
								editable={preferFlavors.length < 10}
								returnKeyType="done"
								blurOnSubmit={false}
								onFocus={() => setFocusedField('preferFlavors')}
								onBlur={() => setFocusedField(null)}
								style={[
									styles.extraInput,
									{
										color: theme.colors.onSurface,
										borderBottomColor: focusedField === 'preferFlavors' ? theme.colors.tertiary : theme.colors.outlineVariant,
										borderBottomWidth: focusedField === 'preferFlavors' ? 2 : 1,
									},
									WEB_NO_OUTLINE,
								]}
							/>
						</View>

						<View style={[styles.flavorSection, { marginTop: 16 }]}>
							<Text style={[styles.extraLabel, { color: theme.colors.error }]}>
								不喜欢的口味
							</Text>
							{avoidFlavors.length > 0 && (
								<View style={styles.flavorsDisplay}>
									{avoidFlavors.map((flavor, idx) => (
										<View
											key={idx}
											style={[
												styles.tagInputChip,
												{ backgroundColor: `${theme.colors.error}15` },
											]}
										>
											<Text style={{ color: theme.colors.error, fontSize: 13 }}>{flavor}</Text>
											<Pressable
												onPress={() => handleRemoveAvoidFlavor(idx)}
												hitSlop={4}
												style={styles.tagInputChipClose}
											>
												<Ionicons name="close" size={14} color={theme.colors.error} />
											</Pressable>
										</View>
									))}
								</View>
							)}
							<RNTextInput
								value={currentAvoidFlavorInput}
								onChangeText={handleAvoidFlavorInputChange}
								onSubmitEditing={handleAvoidFlavorInputSubmit}
								placeholder={avoidFlavors.length >= 10 ? '已达上限' : '输入口味，按空格添加'}
								placeholderTextColor={theme.colors.outline}
								editable={avoidFlavors.length < 10}
								returnKeyType="done"
								blurOnSubmit={false}
								onFocus={() => setFocusedField('avoidFlavors')}
								onBlur={() => setFocusedField(null)}
								style={[
									styles.extraInput,
									{
										color: theme.colors.onSurface,
										borderBottomColor: focusedField === 'avoidFlavors' ? theme.colors.error : theme.colors.outlineVariant,
										borderBottomWidth: focusedField === 'avoidFlavors' ? 2 : 1,
									},
									WEB_NO_OUTLINE,
								]}
							/>
						</View>
					</View>
				)}

			</View>
		</ScrollView>
	);

	// ==================== 宽屏预览面板（与帖子详情页一致）====================
	const renderPreviewPanel = () => {
		// 获取渐变颜色（使用主题语义颜色）
		const colors = theme.colors;
		const gradientColors = post_type === 'seeking' 
			? { primary: colors.seeking, secondary: colors.seekingContainer, accent: colors.onSeekingContainer }
			: share_type === 'warning' 
				? { primary: colors.warning, secondary: colors.warningContainer, accent: colors.onWarningContainer }
				: { primary: theme.colors.primary, secondary: theme.colors.primaryContainer, accent: theme.colors.onPrimaryContainer };

		const hasImages = filtered_images.length > 0;

		return (
			<View style={styles.previewPanelContainer}>
				<ScrollView
					style={styles.previewPanelScroll}
					contentContainerStyle={styles.previewPanelScrollContent}
					showsVerticalScrollIndicator={false}
				>
					{/* 图片区域 / Fallback Cover */}
					{hasImages ? (
						<Pressable style={styles.previewImageSection} onPress={() => handleOpenImageViewer(0)}>
							<Image
								source={{ uri: filtered_images[0] }}
								style={styles.previewHeroImage}
								resizeMode="cover"
							/>
							{filtered_images.length > 1 && (
								<View style={styles.previewImageIndicator}>
									<Text style={styles.previewImageIndicatorText}>
										1/{filtered_images.length}
									</Text>
								</View>
							)}
						</Pressable>
					) : (
						<View style={[styles.previewFallbackCover, { backgroundColor: gradientColors.primary }]}>
							<View style={[styles.previewFallbackMesh1, { backgroundColor: gradientColors.secondary }]} />
							<View style={[styles.previewFallbackMesh2, { backgroundColor: gradientColors.accent }]} />
							<View style={styles.previewFallbackDecorations}>
								<View style={[styles.previewFallbackCircle1, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
								<View style={[styles.previewFallbackCircle2, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
							</View>
							<View style={styles.previewFallbackContent}>
								<View style={styles.previewFallbackIconContainer}>
									<Ionicons
										name={post_type === 'seeking' ? 'help-circle' : share_type === 'warning' ? 'alert-circle' : 'heart'}
										size={48}
										color="rgba(255,255,255,0.85)"
									/>
								</View>
								<View style={styles.previewFallbackTypeBadge}>
									<Text style={styles.previewFallbackTypeBadgeText}>
										{post_type === 'share' ? (share_type === 'recommend' ? '推荐' : '避雷') : '求助'}
									</Text>
								</View>
							</View>
						</View>
					)}

					{/* 作者栏 */}
					<View style={[styles.previewAuthorBar, { backgroundColor: theme.colors.surface }]}>
						<View style={styles.previewAuthorInfo}>
							{safeCurrentUserAvatarUrl ? (
								<Image source={{ uri: safeCurrentUserAvatarUrl }} style={styles.previewAuthorAvatar} />
							) : (
								<View style={[styles.previewAuthorAvatarPlaceholder, { backgroundColor: theme.colors.primaryContainer }]}>
									<Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '600' }}>
										{currentUser?.name?.[0] || '我'}
									</Text>
								</View>
							)}
							<View style={styles.previewAuthorTextWrap}>
								<Text style={[styles.previewAuthorName, { color: theme.colors.onSurface }]} numberOfLines={1}>
									{currentUser?.name || '我'}
								</Text>
								<Text style={[styles.previewAuthorMeta, { color: theme.colors.onSurfaceVariant }]}>
									{formatCurrentDate()}
								</Text>
							</View>
						</View>
						<View style={[styles.previewFollowBtn, { backgroundColor: theme.colors.primary }]}>
							<Text style={[styles.previewFollowBtnText, { color: theme.colors.onPrimary }]}>+ 关注</Text>
						</View>
					</View>

					{/* 内容区域 */}
					<View style={[styles.previewContentSection, { backgroundColor: theme.colors.surface }]}>
						{/* 标题 */}
						<Text style={[styles.previewTitle, { color: title ? theme.colors.onSurface : theme.colors.outline }]}>
							{title || '标题预览'}
						</Text>

						{/* 正文 */}
						<Text style={[styles.previewContentText, { color: content ? theme.colors.onSurface : theme.colors.outline }]}>
							{content || '正文内容将在这里显示...'}
						</Text>

						{/* 结构化信息卡片 - 分享类型 */}
						{post_type === 'share' && (cuisine || price || flavors.length > 0) && (
							<View style={[styles.previewInfoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
								<View style={styles.previewInfoCardRow}>
									{cuisine && (
										<View style={styles.previewInfoCardItem}>
											<Ionicons name="restaurant-outline" size={16} color={theme.colors.primary} />
											<Text style={[styles.previewInfoCardLabel, { color: theme.colors.onSurfaceVariant }]}>菜系</Text>
											<Text style={[styles.previewInfoCardValue, { color: theme.colors.onSurface }]}>{cuisine}</Text>
										</View>
									)}
									{price && (
										<View style={styles.previewInfoCardItem}>
											<Ionicons name="cash-outline" size={16} color={theme.colors.primary} />
											<Text style={[styles.previewInfoCardLabel, { color: theme.colors.onSurfaceVariant }]}>人均</Text>
											<Text style={[styles.previewInfoCardValue, { color: theme.colors.onSurface }]}>¥{price}</Text>
										</View>
									)}
								</View>
								{flavors.length > 0 && (
									<View style={styles.previewInfoCardFlavors}>
										{flavors.map((flavor, idx) => (
											<View key={idx} style={[styles.previewFlavorBadge, { backgroundColor: theme.colors.secondaryContainer }]}>
												<Text style={[styles.previewFlavorBadgeText, { color: theme.colors.onSecondaryContainer }]}>{flavor}</Text>
											</View>
										))}
									</View>
								)}
							</View>
						)}

						{/* 结构化信息卡片 - 求助类型 */}
						{post_type === 'seeking' && (budgetMin || budgetMax || preferFlavors.length > 0 || avoidFlavors.length > 0) && (
							<View style={[styles.previewInfoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
								{(budgetMin || budgetMax) && (
									<View style={styles.previewInfoCardRow}>
										<View style={styles.previewInfoCardItem}>
											<Ionicons name="wallet-outline" size={16} color={theme.colors.primary} />
											<Text style={[styles.previewInfoCardLabel, { color: theme.colors.onSurfaceVariant }]}>预算</Text>
											<Text style={[styles.previewInfoCardValue, { color: theme.colors.onSurface }]}>
												¥{budgetMin || '0'}-{budgetMax || '∞'}
											</Text>
										</View>
									</View>
								)}
								{preferFlavors.length > 0 && (
									<View style={styles.previewInfoCardFlavors}>
										<Text style={[styles.previewPreferenceLabel, { color: theme.colors.tertiary }]}>喜欢：</Text>
										{preferFlavors.map((f, idx) => (
											<View key={idx} style={[styles.previewFlavorBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
												<Text style={[styles.previewFlavorBadgeText, { color: theme.colors.onTertiaryContainer }]}>{f}</Text>
											</View>
										))}
									</View>
								)}
								{avoidFlavors.length > 0 && (
									<View style={styles.previewInfoCardFlavors}>
										<Text style={[styles.previewPreferenceLabel, { color: theme.colors.error }]}>忌口：</Text>
										{avoidFlavors.map((f, idx) => (
											<View key={idx} style={[styles.previewFlavorBadge, { backgroundColor: theme.colors.errorContainer }]}>
												<Text style={[styles.previewFlavorBadgeText, { color: theme.colors.onErrorContainer }]}>{f}</Text>
											</View>
										))}
									</View>
								)}
							</View>
						)}

						{/* 标签栏 */}
						<View style={styles.previewTagsRow}>
							{canteen && (
								<View style={[styles.previewTagBadge, styles.previewLocationBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
									<Ionicons name="location" size={12} color={theme.colors.onSurfaceVariant} />
									<Text style={[styles.previewTagBadgeText, { color: theme.colors.onSurfaceVariant }]}>{canteen}</Text>
								</View>
							)}
							{post_type === 'share' && (
								<View style={[
									styles.previewTagBadge,
									{ backgroundColor: share_type === 'warning' ? colors.warningContainer : colors.recommendContainer }
								]}>
									<Text style={[
										styles.previewTagBadgeText,
										{ color: share_type === 'warning' ? colors.warning : colors.recommend }
									]}>
										{share_type === 'recommend' ? '推荐' : '避雷'}
									</Text>
								</View>
							)}
							{post_type === 'seeking' && (
								<View style={[styles.previewTagBadge, { backgroundColor: colors.seekingContainer }]}>
									<Text style={[styles.previewTagBadgeText, { color: colors.seeking }]}>求助</Text>
								</View>
							)}
							{parsedTags.map((tag, idx) => (
								<Text key={idx} style={[styles.previewTopicTag, { color: theme.colors.primary }]}>
									#{tag}
								</Text>
							))}
						</View>

						{/* 浏览量和时间 */}
						<View style={styles.previewMetaRow}>
							<Text style={[styles.previewMetaText, { color: theme.colors.outline }]}>0 浏览</Text>
							<Text style={[styles.previewMetaText, { color: theme.colors.outline }]}>发布于 {formatCurrentDate()}</Text>
						</View>
					</View>

					{/* 更多图片 */}
					{filtered_images.length > 1 && (
						<View style={[styles.previewMoreImagesSection, { backgroundColor: theme.colors.surface }]}>
							<Text style={[styles.previewMoreImagesTitle, { color: theme.colors.onSurfaceVariant }]}>
								全部图片 ({filtered_images.length})
							</Text>
							<View style={styles.previewImagesGrid}>
								{filtered_images.map((url, idx) => (
									<Pressable key={idx} onPress={() => handleOpenImageViewer(idx)}>
										<Image
											source={{ uri: url }}
											style={styles.previewGridImageItem}
											resizeMode="cover"
										/>
									</Pressable>
								))}
							</View>
						</View>
					)}
				</ScrollView>

				{/* 底部操作栏预览 */}
				<View style={[styles.previewBottomBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
					<View style={[styles.previewCommentInput, { backgroundColor: theme.colors.surfaceVariant }]}>
						<Ionicons name="chatbubble-outline" size={16} color={theme.colors.outline} />
						<Text style={[styles.previewCommentInputText, { color: theme.colors.outline }]}>说点什么...</Text>
					</View>
					<View style={styles.previewBottomActions}>
						<View style={styles.previewActionBtn}>
							<Ionicons name="heart-outline" size={20} color={theme.colors.onSurfaceVariant} />
							<Text style={[styles.previewActionCount, { color: theme.colors.onSurfaceVariant }]}>0</Text>
						</View>
						<View style={styles.previewActionBtn}>
							<Ionicons name="bookmark-outline" size={20} color={theme.colors.onSurfaceVariant} />
							<Text style={[styles.previewActionCount, { color: theme.colors.onSurfaceVariant }]}>0</Text>
						</View>
						<View style={styles.previewActionBtn}>
							<Ionicons name="chatbubble-outline" size={20} color={theme.colors.onSurfaceVariant} />
							<Text style={[styles.previewActionCount, { color: theme.colors.onSurfaceVariant }]}>0</Text>
						</View>
					</View>
				</View>
			</View>
		);
	};

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.select({ ios: 'padding', android: undefined })}
		>
			<View style={[styles.container, { backgroundColor: theme.colors.background }]}>
				{/* ==================== 顶部导航栏 ==================== */}
				<View
					style={[
						styles.topBar,
						{
							paddingTop: insets.top,
							backgroundColor: theme.colors.background,
						},
					]}
				>
					{/* 第一行：返回/编辑 + 分段控制器 + 预览/发布 */}
					<View style={styles.topBarContent}>
						{/* 左侧：返回（编辑模式）/ 编辑（预览模式）- 宽屏不显示返回 */}
						{!isWideScreen ? (
							<Pressable 
								style={styles.topBarLeft} 
								onPress={isPreviewMode ? togglePreviewMode : handleBack}
							>
								<Ionicons
									name="chevron-back"
									size={20}
									color={theme.colors.onSurfaceVariant}
								/>
								<Text
									style={[
										styles.topBarLeftText,
										{ color: theme.colors.onSurfaceVariant },
									]}
								>
									{isPreviewMode ? '编辑' : '返回'}
								</Text>
							</Pressable>
						) : (
							<Pressable style={styles.topBarLeft} onPress={handleBack}>
								<Ionicons
									name="chevron-back"
									size={20}
									color={theme.colors.onSurfaceVariant}
								/>
								<Text
									style={[
										styles.topBarLeftText,
										{ color: theme.colors.onSurfaceVariant },
									]}
								>
									返回
								</Text>
							</Pressable>
						)}

						{/* 中间：分段控制器（仅编辑模式显示）*/}
						{(isWideScreen || !isPreviewMode) && (
							<View
								style={[
									styles.segmentedControl,
									{ backgroundColor: theme.colors.surfaceVariant },
								]}
							>
								<Pressable
									style={[
										styles.segmentBtn,
										post_type === 'share' && {
											backgroundColor: theme.colors.surface,
										},
									]}
									onPress={() => setPostType('share')}
								>
									<Text
										style={[
											styles.segmentText,
											{
												color:
													post_type === 'share'
														? theme.colors.primary
														: theme.colors.onSurfaceVariant,
												fontWeight: post_type === 'share' ? '600' : '400',
											},
										]}
									>
										分享美食
									</Text>
								</Pressable>
								<Pressable
									style={[
										styles.segmentBtn,
										post_type === 'seeking' && {
											backgroundColor: theme.colors.surface,
										},
									]}
									onPress={() => setPostType('seeking')}
								>
									<Text
										style={[
											styles.segmentText,
											{
												color:
													post_type === 'seeking'
														? theme.colors.primary
														: theme.colors.onSurfaceVariant,
												fontWeight: post_type === 'seeking' ? '600' : '400',
											},
										]}
									>
										求推荐
									</Text>
								</Pressable>
							</View>
						)}

						{/* 预览模式中间：标题 */}
						{!isWideScreen && isPreviewMode && (
							<Text style={[styles.topBarTitle, { color: theme.colors.onSurface }]}>
								预览
							</Text>
						)}

						{/* 右侧：预览（编辑模式）/ 发布（预览模式）*/}
						{!isWideScreen && !isPreviewMode ? (
							<Pressable
								style={[styles.previewBtn, { backgroundColor: theme.colors.primary }]}
								onPress={togglePreviewMode}
							>
								<Text style={[styles.publishBtnText, { color: theme.colors.onPrimary }]}>
									预览
								</Text>
							</Pressable>
						) : (
							<Pressable
								style={[
									styles.publishBtn,
									{ backgroundColor: theme.colors.primary },
									loading && styles.publishBtnDisabled,
								]}
								onPress={onSubmit}
								disabled={loading}
							>
								{loading ? (
									<ActivityIndicator size={14} color={theme.colors.onPrimary} />
								) : (
									<Text style={[styles.publishBtnText, { color: theme.colors.onPrimary }]}>
										{editMode ? '保存' : '发布'}
									</Text>
								)}
							</Pressable>
						)}
					</View>

					{/* 第二行：推荐/避雷子选项 */}
					{post_type === 'share' && (isWideScreen || !isPreviewMode) && (
						<View style={styles.subTypeRow}>
							<Pressable
								style={[
									styles.subTypeBtn,
									share_type === 'recommend' && {
										backgroundColor: theme.colors.recommendContainer,
										borderColor: theme.colors.recommend,
									},
									share_type !== 'recommend' && {
										borderColor: theme.colors.outlineVariant,
									},
								]}
								onPress={() => setShareType('recommend')}
							>
								<Text
									style={{
										color: share_type === 'recommend' ? theme.colors.recommend : theme.colors.onSurfaceVariant,
										fontSize: 13,
										fontWeight: share_type === 'recommend' ? '600' : '400',
									}}
								>
									推荐
								</Text>
							</Pressable>
							<Pressable
								style={[
									styles.subTypeBtn,
									share_type === 'warning' && {
										backgroundColor: theme.colors.warningContainer,
										borderColor: theme.colors.warning,
									},
									share_type !== 'warning' && {
										borderColor: theme.colors.outlineVariant,
									},
								]}
								onPress={() => setShareType('warning')}
							>
								<Text
									style={{
										color: share_type === 'warning' ? theme.colors.warning : theme.colors.onSurfaceVariant,
										fontSize: 13,
										fontWeight: share_type === 'warning' ? '600' : '400',
									}}
								>
									避雷
								</Text>
							</Pressable>
						</View>
					)}
				</View>

				{/* ==================== 内容区域 ==================== */}
				{isWideScreen ? (
					// 宽屏：左右分栏布局
					<View style={styles.wideScreenContainer}>
						<View style={styles.wideScreenLeft}>
							{renderEditMode()}
						</View>
						<View style={styles.wideScreenRight}>
							{renderPreviewPanel()}
						</View>
					</View>
				) : (
					// 窄屏：切换模式
					isPreviewMode ? renderPreviewMode() : renderEditMode()
				)}
			</View>

			{/* 位置选择器 */}
			<CanteenPicker
				visible={canteenPickerOpen}
				onClose={() => setCanteenPickerOpen(false)}
				title="选择位置"
				options={CANTEEN_OPTIONS}
				selectedValue={canteen}
				onSelect={(value) => setCanteen(value)}
			/>

			{/* 图片查看器 */}
			<ImageViewer
				visible={imageViewer.visible}
				images={filtered_images}
				initialIndex={imageViewer.index}
				onClose={handleCloseImageViewer}
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingWrapper: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},

	// ==================== Top Bar ====================
	topBar: {
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	topBarContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		minHeight: 48,
	},
	topBarLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		paddingRight: 8,
		gap: 2,
	},
	topBarLeftText: {
		fontSize: 15,
		fontWeight: '500',
	},
	segmentedControl: {
		flexDirection: 'row',
		borderRadius: 20,
		padding: 3,
	},
	segmentBtn: {
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 17,
	},
	segmentText: {
		fontSize: 14,
	},
	subTypeRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 12,
		marginTop: 10,
	},
	subTypeBtn: {
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: 'transparent',
	},
	previewBtnText: {
		fontSize: 14,
		fontWeight: '500',
	},
	previewBtn: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 16,
		minWidth: 52,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 4,
	},
	topBarTitle: {
		fontSize: 16,
		fontWeight: '600',
	},
	publishBtn: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 16,
		minWidth: 52,
		alignItems: 'center',
		justifyContent: 'center',
	},
	publishBtnDisabled: {
		opacity: 0.6,
	},
	publishBtnText: {
		fontSize: 14,
		fontWeight: '600',
	},

	// ==================== Scroll Content ====================
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingTop: 16,
		alignItems: 'center',
	},
	contentWrapper: {
		width: '100%',
	},

	// ==================== Message Card ====================
	messageCard: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderRadius: 12,
		marginBottom: 16,
	},
	messageDismiss: {
		margin: 0,
	},
	viewPostBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		alignSelf: 'flex-start',
		marginTop: 10,
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 16,
	},

	// ==================== 沉浸式输入区 ====================
	titleInput: {
		fontSize: 24,
		fontWeight: '700',
		paddingVertical: 8,
		paddingHorizontal: 0,
		backgroundColor: 'transparent',
		marginBottom: 16,
	},
	contentInput: {
		fontSize: 16,
		lineHeight: 26,
		minHeight: 120,
		paddingVertical: 0,
		paddingHorizontal: 0,
		backgroundColor: 'transparent',
	},
	charCount: {
		alignSelf: 'flex-end',
		fontSize: 12,
		marginTop: 8,
		marginBottom: 16,
	},

	// ==================== Toolbar ====================
	toolbarRow: {
		flexDirection: 'row',
		gap: 10,
		marginBottom: 12,
	},
	toolbarBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: 'transparent',
	},
	toolbarBtnText: {
		fontSize: 13,
		maxWidth: 100,
	},

	// ==================== Tag Input ====================
	tagInputSection: {
		padding: 12,
		borderRadius: 12,
		marginBottom: 12,
		gap: 10,
	},
	tagInputTags: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	tagInputChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingLeft: 10,
		paddingRight: 6,
		paddingVertical: 6,
		borderRadius: 14,
	},
	tagInputChipClose: {
		padding: 2,
	},
	tagInputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	tagTextInput: {
		flex: 1,
		fontSize: 14,
		paddingVertical: 8,
		backgroundColor: 'transparent',
	},
	tagInputDone: {
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	tagCountHint: {
		fontSize: 11,
		textAlign: 'right',
	},
	tagsDisplay: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 16,
	},
	tagChip: {
		borderRadius: 16,
	},

	// ==================== Extra Section ====================
	extraSection: {
		marginTop: 24,
		paddingTop: 20,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: '500',
		marginBottom: 16,
	},
	extraGrid: {
		flexDirection: 'row',
		gap: 20,
	},
	extraItem: {
		flex: 1,
	},
	extraLabel: {
		fontSize: 12,
		marginBottom: 4,
	},
	extraInput: {
		fontSize: 15,
		paddingVertical: 8,
		paddingHorizontal: 0,
		backgroundColor: 'transparent',
		borderBottomWidth: 1,
	},
	priceInputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	priceInput: {
		flex: 1,
	},
	flavorSection: {
		marginTop: 16,
	},
	flavorsDisplay: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginTop: 8,
	},
	flavorBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
	},

	// ==================== Budget ====================
	budgetRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	budgetInputWrap: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	budgetInput: {
		flex: 1,
		fontSize: 15,
		paddingVertical: 8,
		paddingHorizontal: 0,
		backgroundColor: 'transparent',
		borderBottomWidth: 1,
		borderBottomColor: 'transparent',
	},


	// ==================== Preview Mode (窄屏切换预览) ====================
	narrowPreviewImageGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 20,
	},
	narrowPreviewImageItem: {
		width: '31%',
		aspectRatio: 1,
		borderRadius: 12,
		overflow: 'hidden',
	},
	narrowPreviewImage: {
		width: '100%',
		height: '100%',
	},
	narrowPreviewTitle: {
		fontWeight: '700',
		marginBottom: 12,
	},
	narrowPreviewMetaRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 16,
	},
	narrowPreviewBadge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
	},
	narrowPreviewLocationBadge: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	narrowPreviewContent: {
		fontSize: 16,
		lineHeight: 26,
		marginBottom: 16,
	},
	narrowPreviewTagsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	narrowPreviewTag: {
		fontSize: 14,
		fontWeight: '500',
	},

	// ==================== Wide Screen Layout ====================
	wideScreenContainer: {
		flex: 1,
		flexDirection: 'row',
	},
	wideScreenLeft: {
		flex: 1,
		minWidth: 400,
	},
	wideScreenRight: {
		flex: 1,
		borderLeftWidth: 1,
		borderLeftColor: 'rgba(0,0,0,0.08)',
	},

	// ==================== Preview Panel (宽屏右侧预览 - 与详情页一致) ====================
	previewPanelContainer: {
		flex: 1,
	},
	previewPanelScroll: {
		flex: 1,
	},
	previewPanelScrollContent: {
		paddingBottom: 16,
	},

	// 图片区域
	previewImageSection: {
		position: 'relative',
		width: '100%',
	},
	previewHeroImage: {
		width: '100%',
		aspectRatio: 4 / 3,
	},
	previewImageIndicator: {
		position: 'absolute',
		bottom: 12,
		right: 12,
		backgroundColor: 'rgba(0,0,0,0.6)',
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
	},
	previewImageIndicatorText: {
		color: 'rgba(255,255,255,0.95)',
		fontSize: 12,
		fontWeight: '500',
	},

	// Fallback Cover
	previewFallbackCover: {
		width: '100%',
		aspectRatio: 4 / 3,
		position: 'relative',
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	previewFallbackMesh1: {
		position: 'absolute',
		width: '120%',
		height: '120%',
		top: '-30%',
		right: '-30%',
		borderRadius: 999,
		opacity: 0.6,
	},
	previewFallbackMesh2: {
		position: 'absolute',
		width: '100%',
		height: '100%',
		bottom: '-40%',
		left: '-20%',
		borderRadius: 999,
		opacity: 0.4,
	},
	previewFallbackDecorations: {
		...StyleSheet.absoluteFillObject,
	},
	previewFallbackCircle1: {
		position: 'absolute',
		width: 120,
		height: 120,
		borderRadius: 60,
		top: '10%',
		left: '10%',
	},
	previewFallbackCircle2: {
		position: 'absolute',
		width: 80,
		height: 80,
		borderRadius: 40,
		bottom: '20%',
		right: '15%',
	},
	previewFallbackContent: {
		alignItems: 'center',
		zIndex: 1,
	},
	previewFallbackIconContainer: {
		marginBottom: 12,
	},
	previewFallbackTypeBadge: {
		backgroundColor: 'rgba(255,255,255,0.25)',
		paddingHorizontal: 16,
		paddingVertical: 6,
		borderRadius: 16,
	},
	previewFallbackTypeBadgeText: {
		color: 'rgba(255,255,255,0.95)',
		fontSize: 14,
		fontWeight: '600',
	},

	// 作者栏
	previewAuthorBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	previewAuthorInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	previewAuthorAvatar: {
		width: 44,
		height: 44,
		borderRadius: 22,
	},
	previewAuthorAvatarPlaceholder: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center',
	},
	previewAuthorTextWrap: {
		marginLeft: 12,
		flex: 1,
	},
	previewAuthorName: {
		fontSize: 15,
		fontWeight: '600',
	},
	previewAuthorMeta: {
		fontSize: 12,
		marginTop: 2,
	},
	previewFollowBtn: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20,
	},
	previewFollowBtnText: {
		fontSize: 13,
		fontWeight: '600',
	},

	// 内容区域
	previewContentSection: {
		paddingHorizontal: 16,
		paddingVertical: 16,
	},
	previewTitle: {
		fontSize: 20,
		fontWeight: '700',
		lineHeight: 28,
		marginBottom: 12,
	},
	previewContentText: {
		fontSize: 15,
		lineHeight: 24,
		marginBottom: 16,
	},

	// 信息卡片
	previewInfoCard: {
		borderRadius: 12,
		padding: 14,
		marginBottom: 16,
	},
	previewInfoCardRow: {
		flexDirection: 'row',
		gap: 24,
	},
	previewInfoCardItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	previewInfoCardLabel: {
		fontSize: 12,
	},
	previewInfoCardValue: {
		fontSize: 14,
		fontWeight: '600',
	},
	previewInfoCardFlavors: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		gap: 8,
		marginTop: 10,
	},
	previewFlavorBadge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
	},
	previewFlavorBadgeText: {
		fontSize: 12,
		fontWeight: '500',
	},
	previewPreferenceLabel: {
		fontSize: 12,
		fontWeight: '500',
	},

	// 标签栏
	previewTagsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		gap: 8,
		marginBottom: 12,
	},
	previewTagBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 14,
		gap: 4,
	},
	previewTagBadgeText: {
		fontSize: 12,
		fontWeight: '500',
	},
	previewLocationBadge: {
		// backgroundColor is set dynamically
	},
	// 预览徽章颜色已改为动态使用主题语义颜色 (recommend/warning/seeking)
	previewTopicTag: {
		fontSize: 13,
		fontWeight: '500',
	},

	// Meta 信息
	previewMetaRow: {
		flexDirection: 'row',
		gap: 16,
	},
	previewMetaText: {
		fontSize: 12,
	},

	// 更多图片
	previewMoreImagesSection: {
		paddingHorizontal: 16,
		paddingVertical: 16,
		marginTop: 8,
	},
	previewMoreImagesTitle: {
		fontSize: 14,
		fontWeight: '600',
		marginBottom: 12,
	},
	previewImagesGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	previewGridImageItem: {
		width: 100,
		height: 100,
		borderRadius: 8,
	},

	// 底部操作栏
	previewBottomBar: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderTopWidth: 1,
	},
	previewCommentInput: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 20,
		gap: 8,
	},
	previewCommentInputText: {
		fontSize: 14,
	},
	previewBottomActions: {
		flexDirection: 'row',
		gap: 16,
		marginLeft: 12,
	},
	previewActionBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	previewActionCount: {
		fontSize: 13,
	},

	// ==================== Preview Detail Card (旧的，保留兼容) ====================
	previewDetailCard: {
		borderRadius: 12,
		padding: 16,
	},
	previewDetailLabel: {
		fontSize: 12,
		fontWeight: '500',
		marginBottom: 8,
	},
	previewDetailContent: {
		fontSize: 14,
		lineHeight: 22,
	},
	previewMoreImages: {
		marginTop: 16,
	},
	previewCardImageGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
	},
	previewGridImage: {
		width: 80,
		height: 80,
		borderRadius: 8,
	},
});
