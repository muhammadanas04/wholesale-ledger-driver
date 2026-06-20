import React from 'react';
import { View, useColorScheme } from 'react-native';
import Colors from '../constants/Colors';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export default function ScreenBackground({ children, className = '' }: ScreenBackgroundProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={{ backgroundColor: colors.background }}
      className={`flex-1 ${className}`}
    >
      {children}
    </View>
  );
}
