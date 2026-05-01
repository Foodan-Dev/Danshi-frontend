import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  Image,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, IconButton, useTheme as usePaperTheme, ActivityIndicator } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { uploadService, type UploadSource } from '@/src/services/upload_service';
import * as ImagePicker from 'expo-image-picker';
import { isHttpOrHttpsUrl } from '@/src/lib/security/url';

interface ImageDropZoneProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  /** 是否允许拖拽上传 (仅 Web) */
  enableDragDrop?: boolean;
}

/**
 * 图片上传组件
 * - Web 端：由于 CORS 限制，暂不支持拖拽上传，仅支持粘贴图片链接
 * - 原生端：支持上传到 FDUHole 图片托管（需校园网）
 * - 支持粘贴图片链接
 */
export default function ImageDropZone({
  images,
  onImagesChange,
  maxImages = 9,
  enableDragDrop = true,
}: ImageDropZoneProps) {
  const theme = usePaperTheme();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imagesRef = useRef(images);
  const uploadLockRef = useRef(false);

  const isWeb = Platform.OS === 'web';
  const normalizedMaxImages = Number.isFinite(maxImages) ? Math.max(1, Math.floor(maxImages)) : 9;

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // 检查图片 URL 是否有效
  const isValidImageUrl = useCallback((url: string) => {
    return isHttpOrHttpsUrl(url);
  }, []);

  // 获取有效的图片列表
  const validImageItems = useMemo(
    () =>
      images
        .map((url, index) => ({ url, index }))
        .filter((item) => item.url && isValidImageUrl(item.url)),
    [images, isValidImageUrl]
  );
  const validImages = useMemo(() => validImageItems.map((item) => item.url), [validImageItems]);
  const occupiedSlotCount = useMemo(
    () => images.filter((url) => typeof url === 'string' && url.trim().length > 0).length,
    [images]
  );

  // 处理图片链接变更
  const handleChangeImage = useCallback(
    (index: number, value: string) => {
      const newImages = images.map((item, idx) => (idx === index ? value : item));
      onImagesChange(newImages);
    },
    [images, onImagesChange]
  );

  // 添加图片链接输入框
  const handleAddImageField = useCallback(() => {
    const currentImages = imagesRef.current;
    if (currentImages.length < normalizedMaxImages) {
      onImagesChange([...currentImages, '']);
    }
  }, [normalizedMaxImages, onImagesChange]);

  // 删除图片
  const handleRemoveImage = useCallback(
    (index: number) => {
      const currentImages = imagesRef.current;
      const newImages = currentImages.length === 1 ? [''] : currentImages.filter((_, idx) => idx !== index);
      onImagesChange(newImages);
    },
    [onImagesChange]
  );

  // 添加已上传的图片 URL
  const addUploadedImages = useCallback(
    (urls: string[]) => {
      const currentImages = imagesRef.current.slice(0, normalizedMaxImages);
      const nextImages = [...currentImages];

      urls.forEach((url) => {
        const emptyIndex = nextImages.findIndex((item) => !item || !item.trim());
        if (emptyIndex >= 0) {
          nextImages[emptyIndex] = url;
          return;
        }
        if (nextImages.length < normalizedMaxImages) {
          nextImages.push(url);
        }
      });

      if (nextImages.length < normalizedMaxImages && !nextImages.some((item) => !item || !item.trim())) {
        nextImages.push('');
      }
      onImagesChange(nextImages.slice(0, normalizedMaxImages));
    },
    [normalizedMaxImages, onImagesChange]
  );

  // 上传文件 (Web 端)
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (uploadLockRef.current) return;
      if (files.length === 0) return;

      const availableSlots = normalizedMaxImages - imagesRef.current.filter((url) => typeof url === 'string' && url.trim().length > 0).length;
      if (availableSlots <= 0) {
        setUploadError(`最多只能上传 ${normalizedMaxImages} 张图片`);
        return;
      }

      const filesToUpload = files.slice(0, availableSlots);
      setUploadError(null);
      uploadLockRef.current = true;
      setUploadingCount(filesToUpload.length);

      try {
        const sources: UploadSource[] = filesToUpload.map((file) => file as Blob);
        const results = await uploadService.uploadImages(sources);
        const urls = results.map((r) => r.url);
        addUploadedImages(urls);
      } catch (err) {
        const message = err instanceof Error ? err.message : '上传失败，请稍后重试';
        setUploadError(message);
      } finally {
        uploadLockRef.current = false;
        setUploadingCount(0);
      }
    },
    [normalizedMaxImages, addUploadedImages]
  );

  // 原生端：从图库选择图片
  const pickImageFromLibrary = useCallback(async () => {
    if (isWeb) return;
    if (uploadLockRef.current) return;

    const availableSlots = normalizedMaxImages - imagesRef.current.filter((url) => typeof url === 'string' && url.trim().length > 0).length;
    if (availableSlots <= 0) {
      setUploadError(`最多只能上传 ${normalizedMaxImages} 张图片`);
      return;
    }

    try {
      // 请求权限
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setUploadError('需要相册权限才能选择图片');
        return;
      }

      // 打开图库
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: availableSlots,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploadError(null);
      uploadLockRef.current = true;
      setUploadingCount(result.assets.length);

      // 上传选中的图片
      const sources: UploadSource[] = result.assets.map((asset: ImagePicker.ImagePickerAsset) => ({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `image_${Date.now()}.jpg`,
      }));

      const uploadResults = await uploadService.uploadImages(sources);
      const urls = uploadResults.map((r) => r.url);
      addUploadedImages(urls);
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传失败，请稍后重试';
      setUploadError(message);
    } finally {
      uploadLockRef.current = false;
      setUploadingCount(0);
    }
  }, [isWeb, normalizedMaxImages, addUploadedImages]);

  // Web 端拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!enableDragDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [enableDragDrop]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!enableDragDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, [enableDragDrop]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!enableDragDrop) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );

      if (files.length > 0) {
        uploadFiles(files);
      } else if (e.dataTransfer.files.length > 0) {
        setUploadError('请选择图片文件');
      }
    },
    [enableDragDrop, uploadFiles]
  );

  // 点击上传区域
  const handleClickUpload = useCallback(() => {
    if (isWeb) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e) => {
        const pickedFiles = Array.from((e.target as HTMLInputElement).files || []);
        const files = pickedFiles.filter((file) =>
          file.type.startsWith('image/')
        );
        if (files.length > 0) {
          uploadFiles(files);
        } else if (pickedFiles.length > 0) {
          setUploadError('请选择图片文件');
        }
      };
      input.click();
    }
  }, [isWeb, uploadFiles]);

  // Web 端渲染 - 支持拖拽上传和文件选择
  if (isWeb) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          图片 ({validImages.length}/{maxImages})
        </Text>

        {/* 错误提示 */}
        {uploadError && (
          <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
            <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{uploadError}</Text>
            <IconButton
              icon="close"
              size={14}
              iconColor={theme.colors.error}
              onPress={() => setUploadError(null)}
              style={styles.errorDismiss}
            />
          </View>
        )}

        {/* 图片网格 */}
        <View style={styles.imageGrid}>
          {/* 已有图片 */}
          {validImageItems.map(({ url, index }, idx) => (
            <View
              key={`img-${idx}`}
              style={[
                styles.imageGridItem,
                { borderColor: theme.colors.outlineVariant },
              ]}
            >
              <Image
                source={{ uri: url }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <IconButton
                icon="close-circle"
                size={20}
                iconColor={theme.colors.error}
                style={styles.imageRemoveBtn}
                onPress={() => handleRemoveImage(index)}
              />
            </View>
          ))}

          {/* 上传中指示器 */}
          {uploadingCount > 0 && (
            <View
              style={[
                styles.imageGridItem,
                styles.uploadingItem,
                { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.uploadingText, { color: theme.colors.primary }]}>
                {uploadingCount} 张上传中
              </Text>
            </View>
          )}

          {/* 添加按钮 - 支持拖拽 */}
          {(occupiedSlotCount < normalizedMaxImages || images.some((item) => !item || !item.trim())) && uploadingCount === 0 && (
            <Pressable
              style={[
                styles.imageGridItem,
                styles.addImageItem,
                { 
                  borderColor: theme.colors.primary,
                  backgroundColor: isDragOver ? theme.colors.primaryContainer : 'transparent',
                },
              ]}
              onPress={handleClickUpload}
              {...(enableDragDrop ? {
                // @ts-ignore - Web only props
                onDragOver: handleDragOver,
                // @ts-ignore - Web only props
                onDragLeave: handleDragLeave,
                // @ts-ignore - Web only props
                onDrop: handleDrop,
              } : {})}
            >
              <Ionicons
                name={enableDragDrop && isDragOver ? 'cloud-upload' : 'add'}
                size={28}
                color={theme.colors.primary}
              />
              <Text style={[styles.addImageText, { color: theme.colors.primary }]}>
                {enableDragDrop ? (isDragOver ? '松开上传' : '点击或拖拽') : '点击上传'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* 提示文字 */}
        <Text style={[styles.hintText, { color: theme.colors.outline }]}>
          {enableDragDrop ? '点击选择文件或拖拽图片上传' : '点击选择文件上传'}
        </Text>
      </View>
    );
  }

  // 非 Web 端或禁用拖拽时的渲染 (原有逻辑)
  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
        图片 ({validImages.length}/{maxImages})
      </Text>

      {/* 错误提示 */}
      {uploadError && (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
          <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{uploadError}</Text>
          <IconButton
            icon="close"
            size={14}
            iconColor={theme.colors.error}
            onPress={() => setUploadError(null)}
            style={styles.errorDismiss}
          />
        </View>
      )}

      <View style={styles.imageGrid}>
        {images.map((url, idx) => (
          <View
            key={`img-${idx}`}
            style={[
              styles.imageGridItem,
              { borderColor: theme.colors.outlineVariant },
            ]}
          >
            {url && isValidImageUrl(url) ? (
              <>
                <Image
                  source={{ uri: url }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <IconButton
                  icon="close-circle"
                  size={20}
                  iconColor={theme.colors.error}
                  style={styles.imageRemoveBtn}
                  onPress={() => handleRemoveImage(idx)}
                />
              </>
            ) : (
              <RNTextInput
                value={url}
                onChangeText={(value) => handleChangeImage(idx, value)}
                placeholder="粘贴链接"
                placeholderTextColor={theme.colors.outline}
                style={[styles.imageLinkInput, { color: theme.colors.onSurface }]}
              />
            )}
          </View>
        ))}

        {/* 上传中指示器 */}
        {uploadingCount > 0 && (
          <View
            style={[
              styles.imageGridItem,
              styles.uploadingItem,
              { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.uploadingText, { color: theme.colors.primary }]}>
              上传中...
            </Text>
          </View>
        )}

        {/* 从图库选择按钮 */}
        {(occupiedSlotCount < normalizedMaxImages || images.some((item) => !item || !item.trim())) && uploadingCount === 0 && (
          <Pressable
            style={[
              styles.imageGridItem,
              styles.uploadImageItem,
              { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer },
            ]}
            onPress={pickImageFromLibrary}
          >
            <Ionicons name="images-outline" size={24} color={theme.colors.primary} />
            <Text style={[styles.uploadImageText, { color: theme.colors.primary }]}>
              从图库选择
            </Text>
          </Pressable>
        )}

        {/* 添加链接按钮 */}
        {images.length < normalizedMaxImages && uploadingCount === 0 && (
          <Pressable
            style={[
              styles.imageGridItem,
              styles.addImageItem,
              { borderColor: theme.colors.outlineVariant },
            ]}
            onPress={handleAddImageField}
          >
            <Ionicons name="link-outline" size={24} color={theme.colors.outline} />
            <Text style={[styles.addImageText, { color: theme.colors.outline }]}>
              粘贴链接
            </Text>
          </Pressable>
        )}
      </View>

      {/* 提示文字 */}
      <Text style={[styles.hintText, { color: theme.colors.outline }]}>
        点击“从图库选择”上传本地图片，或粘贴图片链接
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  errorDismiss: {
    margin: 0,
    width: 24,
    height: 24,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imageGridItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    margin: 0,
  },
  imageLinkInput: {
    fontSize: 11,
    backgroundColor: 'transparent',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  addImageItem: {
    borderStyle: 'dashed',
  },
  addImageText: {
    fontSize: 11,
    marginTop: 4,
  },
  uploadImageItem: {
    borderStyle: 'solid',
  },
  uploadImageText: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  uploadingItem: {
    borderStyle: 'solid',
  },
  uploadingText: {
    fontSize: 11,
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    marginTop: 8,
  },
});
