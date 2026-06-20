import React from 'react';
import { Platform, ColorValue } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { MaterialIcons } from '@expo/vector-icons';

export interface IconName {
  ios: string;
  android: keyof typeof MaterialIcons.glyphMap;
  web: keyof typeof MaterialIcons.glyphMap;
}

interface IconProps {
  name: IconName;
  size?: number;
  tintColor?: ColorValue;
  className?: string;
}

export default function Icon({ name, size = 24, tintColor = '#000', className }: IconProps) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={name.ios as any}
        size={size}
        tintColor={tintColor as any}
        style={{ width: size, height: size }}
        className={className}
      />
    );
  }

  const materialName = Platform.OS === 'web' ? name.web : name.android;
  return (
    <MaterialIcons
      name={materialName}
      size={size}
      color={tintColor}
      className={className}
    />
  );
}
