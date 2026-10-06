import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X, Camera, Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import {
  screenshotService,
  validateImageFile,
  MAX_SCREENSHOTS_PER_TRADE,
} from '../../services/screenshotService';
import { TradeScreenshot, StagedScreenshot } from '../../types/models';
import { ImageLightboxModal } from './ImageLightboxModal';

interface ScreenshotPickerProps {
  tradeId?: string;
  stagedScreenshots?: StagedScreenshot[];
  onStagedChange?: (items: StagedScreenshot[]) => void;
  onUploadSuccess?: () => void;
}

export function ScreenshotPicker({
  tradeId,
  stagedScreenshots = [],
  onStagedChange,
  onUploadSuccess,
}: ScreenshotPickerProps) {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [remoteScreenshots, setRemoteScreenshots] = useState<TradeScreenshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string | undefined>(undefined);

  // Load remote screenshots if tradeId is present (Edit Mode)
  const loadRemote = async () => {
    if (!tradeId) return;
    setLoading(true);
    setError('');
    try {
      const list = await screenshotService.listScreenshots(tradeId);
      setRemoteScreenshots(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load trade screenshots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tradeId) {
      loadRemote();
    }
  }, [tradeId]);

  const currentCount = tradeId ? remoteScreenshots.length : stagedScreenshots.length;
  const isAtLimit = currentCount >= MAX_SCREENSHOTS_PER_TRADE;

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Media library permission is needed to select trade screenshots. Please enable it in your device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processSelectedAssets(result.assets);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open gallery.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is needed to take trade screenshots. Please enable it in your device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processSelectedAssets(result.assets);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to capture photo.');
    }
  };

  const promptPickerSource = () => {
    if (isAtLimit) {
      Alert.alert('Limit Reached', `Each trade can have at most ${MAX_SCREENSHOTS_PER_TRADE} screenshots.`);
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Choose from Gallery', 'Take Photo'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handlePickFromGallery();
          else if (buttonIndex === 2) handleTakePhoto();
        }
      );
    } else {
      Alert.alert(
        'Add Screenshot',
        'Choose a source for your trade screenshot',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Gallery', onPress: handlePickFromGallery },
          { text: 'Camera', onPress: handleTakePhoto },
        ],
        { cancelable: true }
      );
    }
  };

  const processSelectedAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setError('');

    if (tradeId) {
      // Direct remote upload mode
      if (!user?.id) {
        setError('User authentication required for upload.');
        return;
      }

      setUploading(true);
      try {
        let count = remoteScreenshots.length;
        const uploadedList: TradeScreenshot[] = [];

        for (const asset of assets) {
          if (count >= MAX_SCREENSHOTS_PER_TRADE) {
            setError(`Limit reached: maximum ${MAX_SCREENSHOTS_PER_TRADE} screenshots per trade.`);
            break;
          }

          validateImageFile(asset.fileName || asset.uri.split('/').pop(), asset.mimeType, asset.fileSize);

          const saved = await screenshotService.uploadScreenshot(
            user.id,
            tradeId,
            asset.uri,
            asset.fileName || asset.uri.split('/').pop(),
            asset.mimeType,
            asset.fileSize
          );
          uploadedList.push(saved);
          count += 1;
        }

        setRemoteScreenshots((prev) => [...prev, ...uploadedList]);
        onUploadSuccess?.();
      } catch (err: any) {
        setError(err.message || 'Failed to upload screenshot.');
      } finally {
        setUploading(false);
      }
    } else {
      // Staged mode (creating new trade)
      const validStaged: StagedScreenshot[] = [];
      let count = stagedScreenshots.length;

      for (const asset of assets) {
        if (count >= MAX_SCREENSHOTS_PER_TRADE) {
          setError(`Limit reached: maximum ${MAX_SCREENSHOTS_PER_TRADE} screenshots per trade.`);
          break;
        }

        try {
          validateImageFile(asset.fileName || asset.uri.split('/').pop(), asset.mimeType, asset.fileSize);
          validStaged.push({
            id: `staged_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            uri: asset.uri,
            fileName: asset.fileName || `screenshot_${count + 1}.jpg`,
            mimeType: asset.mimeType,
            fileSize: asset.fileSize,
          });
          count += 1;
        } catch (err: any) {
          setError(err.message || 'Invalid image format.');
          break;
        }
      }

      if (validStaged.length > 0 && onStagedChange) {
        onStagedChange([...stagedScreenshots, ...validStaged]);
      }
    }
  };

  const handleDeleteRemote = async (screenshot: TradeScreenshot) => {
    Alert.alert('Delete Screenshot', 'Are you sure you want to delete this screenshot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await screenshotService.deleteScreenshot(screenshot);
            setRemoteScreenshots((prev) => prev.filter((s) => s.id !== screenshot.id));
          } catch (err: any) {
            setError(err.message || 'Failed to delete screenshot.');
          }
        },
      },
    ]);
  };

  const handleRemoveStaged = (index: number) => {
    if (onStagedChange) {
      const updated = stagedScreenshots.filter((_, i) => i !== index);
      onStagedChange(updated);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with counter */}
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trade Screenshots</Text>
        <Text style={[styles.counter, { color: theme.colors.textMuted }]}>
          {currentCount}/{MAX_SCREENSHOTS_PER_TRADE}
        </Text>
      </View>

      {/* Error Banner */}
      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.semantic.dangerDim }]}>
          <Text style={[styles.errorText, { color: theme.colors.semantic.danger }]}>{error}</Text>
        </View>
      ) : null}

      {/* Upload trigger button / card */}
      {!isAtLimit && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={promptPickerSource}
          disabled={uploading}
          style={[
            styles.uploadCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator color={theme.colors.accent} size="small" />
              <Text style={[styles.uploadingText, { color: theme.colors.textMuted }]}>
                Uploading screenshot…
              </Text>
            </View>
          ) : (
            <View style={styles.uploadInner}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.bgElevated }]}>
                <ImagePlus size={22} color={theme.colors.accent} />
              </View>
              <Text style={[styles.uploadPrompt, { color: theme.colors.text }]}>
                Add Trade Screenshot
              </Text>
              <Text style={[styles.uploadSubtext, { color: theme.colors.textMuted }]}>
                Tap to pick from gallery or take photo (JPG, PNG, WEBP)
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Loading state for remote images */}
      {loading && remoteScreenshots.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 6 }}>
            Loading screenshots…
          </Text>
        </View>
      )}

      {/* Thumbnail Grid */}
      <View style={styles.grid}>
        {/* Remote Screenshots */}
        {tradeId &&
          remoteScreenshots.map((item) => (
            <View
              key={item.id}
              style={[
                styles.thumbWrapper,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.thumbTouch}
                onPress={() => {
                  if (item.url) {
                    setLightboxUrl(item.url);
                    setLightboxName(item.fileName);
                  }
                }}
              >
                {item.url ? (
                  <Image source={{ uri: item.url }} style={styles.thumbImage} resizeMode="cover" />
                ) : (
                  <View style={styles.placeholderThumb}>
                    <ImageIcon size={20} color={theme.colors.textMuted} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBadge}
                onPress={() => handleDeleteRemote(item)}
                accessibilityLabel="Delete screenshot"
              >
                <X size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}

        {/* Staged Screenshots (Add Trade Mode) */}
        {!tradeId &&
          stagedScreenshots.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.thumbWrapper,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.thumbTouch}
                onPress={() => {
                  setLightboxUrl(item.uri);
                  setLightboxName(item.fileName);
                }}
              >
                <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBadge}
                onPress={() => handleRemoveStaged(idx)}
                accessibilityLabel="Remove screenshot"
              >
                <X size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
      </View>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        visible={lightboxUrl !== null}
        imageUrl={lightboxUrl}
        fileName={lightboxName}
        onClose={() => {
          setLightboxUrl(null);
          setLightboxName(undefined);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  counter: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorBanner: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 12,
  },
  uploadCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadInner: {
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadPrompt: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadSubtext: {
    fontSize: 11,
    textAlign: 'center',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  uploadingText: {
    fontSize: 13,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumbWrapper: {
    width: '31%',
    aspectRatio: 4 / 3,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbTouch: {
    width: '100%',
    height: '100%',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  placeholderThumb: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(20, 20, 25, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
});
