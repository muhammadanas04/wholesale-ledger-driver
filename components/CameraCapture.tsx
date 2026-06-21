import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Modal, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from './Icon';

interface CameraCaptureProps {
  onCapture: (uri: string) => void;
  onCancel: () => void;
  visible: boolean;
}

export default function CameraCapture({ onCapture, onCancel, visible }: CameraCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  if (!visible) return null;

  const handleCapture = async () => {
    if (cameraRef.current && !isTakingPhoto) {
      setIsTakingPhoto(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          skipProcessing: false,
        });
        if (photo?.uri) {
          setPhotoUri(photo.uri);
        }
      } catch (err) {
        console.error('Failed to take photo', err);
      } finally {
        setIsTakingPhoto(false);
      }
    }
  };

  const handleUsePhoto = () => {
    if (photoUri) {
      onCapture(photoUri);
      setPhotoUri(null);
    }
  };

  const handleRetake = () => {
    setPhotoUri(null);
  };

  const handleClose = () => {
    setPhotoUri(null);
    onCancel();
  };

  // Permission states
  if (!permission) {
    // Camera permissions are still loading
    return (
      <Modal visible={visible} animationType="fade">
        <View className="flex-1 justify-center items-center bg-black">
          <ActivityIndicator size="large" color="#0D9488" />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    const showSettings = !permission.canAskAgain;
    return (
      <Modal visible={visible} animationType="fade">
        <View className="flex-1 justify-center items-center bg-slate-900 p-6 flex flex-col gap-6">
          <View className="w-20 h-20 bg-slate-800 rounded-full items-center justify-center">
            <Icon name={{ ios: 'camera.fill', android: 'camera-alt', web: 'camera-alt' }} size={40} tintColor="#E2E8F0" />
          </View>
          <Text className="text-xl font-bold text-white text-center">
            Camera Permission Required
          </Text>
          <Text className="text-sm text-slate-400 text-center max-w-[280px]">
            {showSettings
              ? 'Camera permission has been denied. Please enable it in your device settings to photograph expense receipts.'
              : 'We need your permission to use the camera to photograph expense receipts.'}
          </Text>
          {showSettings ? (
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              activeOpacity={0.8}
              className="bg-[#0D9488] px-8 py-3.5 rounded-2xl active:scale-95"
            >
              <Text className="text-white font-bold text-base">Open Settings</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={requestPermission}
              activeOpacity={0.8}
              className="bg-[#0D9488] px-8 py-3.5 rounded-2xl active:scale-95"
            >
              <Text className="text-white font-bold text-base">Grant Permission</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleClose} className="mt-2">
            <Text className="text-slate-400 font-bold text-sm">Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-black">
        {photoUri ? (
          // ── Photo Preview Screen ──
          <View className="flex-1 justify-between py-12 px-6">
            <View className="flex-1 rounded-3xl overflow-hidden bg-slate-950 mb-8 border border-slate-800 shadow-lg justify-center items-center">
              <Image source={{ uri: photoUri }} className="w-full h-full" resizeMode="contain" />
            </View>

            <View className="flex flex-col gap-3">
              <TouchableOpacity
                onPress={handleUsePhoto}
                activeOpacity={0.8}
                className="w-full bg-[#0D9488] py-4 rounded-2xl items-center justify-center active:scale-95"
              >
                <Text className="text-white font-bold text-lg">Use Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRetake}
                activeOpacity={0.8}
                className="w-full border border-slate-700 py-4 rounded-2xl items-center justify-center active:scale-95"
              >
                <Text className="text-slate-300 font-bold text-base">Retake Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // ── Live Camera Shutter Screen ──
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
            <View className="flex-1 justify-between py-12 px-6" style={StyleSheet.absoluteFill}>
              {/* Top Row close button */}
              <View className="flex-row justify-end">
                <TouchableOpacity
                  onPress={handleClose}
                  className="w-10 h-10 rounded-full bg-black/45 justify-center items-center"
                >
                  <Icon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Bottom Row controls */}
              <View className="items-center">
                <TouchableOpacity
                  onPress={handleCapture}
                  disabled={isTakingPhoto}
                  className="w-20 h-20 bg-white/10 rounded-full border-4 border-white justify-center items-center active:scale-95"
                >
                  <View className="w-14 h-14 bg-white rounded-full justify-center items-center">
                    {isTakingPhoto && <ActivityIndicator size="small" color="#000000" />}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
