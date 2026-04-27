import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Text, IconButton, useTheme as usePaperTheme, ActivityIndicator } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { uploadService, type UploadSource } from '@/src/services/upload_service';
import * as ImagePicker from 'expo-image-picker';
import { isHttpOrHttpsUrl } from '@/src/lib/security/url';

interface ImageUploadGridProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  onImagePress?: (index: number) => void;
}

/**
 * 现代化图片上传网格组件
 * - 3 列网格布局
 * - 虚线边框添加按钮
 * - 圆角图片预览
 * - 右上角删除按钮
 * - Web 端支持拖拽上传和点击选择文件
 */
export default function ImageUploadGrid({
  images,
  onImagesChange,
  maxImages = 9,
  onImagePress,
}: ImageUploadGridProps) {
  const theme = usePaperTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isWeb = Platform.OS === 'web';

  // 检查图片 URL 是否有效
  const isValidImageUrl = useCallback((url: string) => {
    return isHttpOrHttpsUrl(url);
  }, []);

  // 获取有效的图片列表
  const validImages = images.filter((url) => url && isValidImageUrl(url));

  // 计算网格项尺寸 (3 列，间距 10px)
  const containerPadding = 0;
  const gap = 10;
  const columns = 3;
  const availableWidth = Math.min(screenWidth - 48, 600) - containerPadding * 2;
  const itemSize = (availableWidth - gap * (columns - 1)) / columns;

  // 删除图片
  const handleRemoveImage = useCallback(
    (index: number) => {
      const validList = images.filter((url) => url && isValidImageUrl(url));
      const newList = validList.filter((_, idx) => idx !== index);
      onImagesChange(newList.length > 0 ? newList : []);
    },
    [images, onImagesChange, isValidImageUrl]
  );

  // 添加已上传的图片 URL
  const addUploadedImages = useCallback(
    (urls: string[]) => {
      const existingValid = images.filter((url) => url && isValidImageUrl(url));
      const newImages = [...existingValid, ...urls].slice(0, maxImages);
      onImagesChange(newImages);
    },
    [images, maxImages, onImagesChange, isValidImageUrl]
  );

  // Web 端：处理文件上传
  const handleWebFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setUploadError('请选择图片文件');
      return;
    }

    const availableSlots = maxImages - validImages.length;
    if (availableSlots <= 0) {
      setUploadError(`最多只能上传 ${maxImages} 张图片`);
      return;
    }

    const filesToUpload = imageFiles.slice(0, availableSlots);
    
    // 检查文件大小
    const oversizedFile = filesToUpload.find(f => f.size > 5 * 1024 * 1024);
    if (oversizedFile) {
      setUploadError('图片大小不能超过 5MB');
      return;
    }

    setUploadError(null);
    setUploadingCount(filesToUpload.length);

    try {
      const uploadResults = await uploadService.uploadImages(filesToUpload);
      const urls = uploadResults.map((r) => r.url);
      addUploadedImages(urls);
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传失败，请稍后重试';
      setUploadError(message);
    } finally {
      setUploadingCount(0);
    }
  }, [maxImages, validImages.length, addUploadedImages]);

  // Web 端：点击选择文件
  const handleWebClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleWebFileUpload(files);
      }
    };
    input.click();
  }, [handleWebFileUpload]);

  // Web 端：拖拽处理
  const handleDragOver = useCallback((e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleWebFileUpload(files);
    }
  }, [handleWebFileUpload]);

  // 原生端：从图库选择图片
  const pickImageFromLibrary = useCallback(async () => {
    const availableSlots = maxImages - validImages.length;
    if (availableSlots <= 0) {
      setUploadError(`最多只能上传 ${maxImages} 张图片`);
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setUploadError('需要相册权限才能选择图片');
        return;
      }

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
      setUploadingCount(result.assets.length);

      const sources: UploadSource[] = result.assets.map((asset) => ({
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
      setUploadingCount(0);
    }
  }, [maxImages, validImages.length, addUploadedImages]);

  const canAddMore = validImages.length < maxImages && uploadingCount === 0;

  return (
    <View style={styles.container}>
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
      <View style={styles.grid}>
        {/* 已上传的图片 */}
        {validImages.map((url, idx) => (
          <Pressable
            key={`img-${idx}-${url.slice(-10)}`}
            style={[
              styles.gridItem,
              {
                width: itemSize,
                height: itemSize,
              },
            ]}
            onPress={() => onImagePress?.(idx)}
          >
            <Image
              source={{ uri: url }}
              style={[styles.imagePreview, { borderRadius: 12 }]}
              resizeMode="cover"
            />
            {/* 删除按钮 */}
            <Pressable
              style={[styles.removeBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
              onPress={(e) => {
                e.stopPropagation();
                handleRemoveImage(idx);
              }}
            >
              <Ionicons name="close" size={14} color={theme.colors.onPrimary} />
            </Pressable>
          </Pressable>
        ))}

        {/* 上传中指示器 */}
        {uploadingCount > 0 && (
          <View
            style={[
              styles.gridItem,
              styles.uploadingItem,
              {
                width: itemSize,
                height: itemSize,
                backgroundColor: theme.colors.primaryContainer,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.uploadingText, { color: theme.colors.primary }]}>
              {uploadingCount} 张上传中
            </Text>
          </View>
        )}

        {/* 添加按钮 - 灰色虚线边框，简洁透气 */}
        {canAddMore && (
          <Pressable
            style={[
              styles.gridItem,
              styles.addButton,
              {
                width: itemSize,
                height: itemSize,
                borderColor: isDragging ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: isDragging ? theme.colors.primaryContainer : 'transparent',
              },
            ]}
            onPress={isWeb ? handleWebClick : pickImageFromLibrary}
            {...(isWeb ? {
              onDragOver: handleDragOver,
              onDragLeave: handleDragLeave,
              onDrop: handleDrop,
            } : {})}
          >
            <Ionicons 
              name="add" 
              size={36} 
              color={isDragging ? theme.colors.primary : theme.colors.outline} 
            />
            <Text style={[styles.addText, { color: isDragging ? theme.colors.primary : theme.colors.outline }]}>
              {isWeb ? (isDragging ? '松开上传' : '点击或拖拽') : '添加图片'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* 底部提示 */}
      {validImages.length > 0 && (
        <Text style={[styles.countHint, { color: theme.colors.outline }]}>
          {validImages.length}/{maxImages} 张图片
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addText: {
    fontSize: 12,
    fontWeight: '500',
  },
  uploadingItem: {
    borderWidth: 1,
    borderStyle: 'solid',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  uploadingText: {
    fontSize: 11,
    fontWeight: '500',
  },
  countHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
});
