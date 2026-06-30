import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon, { IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <Animated.View entering={FadeIn.duration(400)} className="flex-1 items-center justify-center p-8 mt-12">
      <View className="w-20 h-20 bg-brand-deep/50 rounded-full items-center justify-center mb-4">
        <Icon
          name={icon}
          size={40}
          tintColor="#7F8C94"
        />
      </View>
      <Text className="text-xl font-bold text-brand-silver text-center">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-sm text-brand-steel text-center mt-2 max-w-[280px]">
          {subtitle}
        </Text>
      )}
    </Animated.View>
  );
}
