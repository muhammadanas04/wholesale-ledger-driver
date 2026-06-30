import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface ProgressBarProps {
  completed: number;
  total: number;
  height?: number;
}

export default function ProgressBar({ completed, total, height = 10 }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progressShared = useSharedValue(0);

  useEffect(() => {
    progressShared.value = withTiming(percentage, { duration: 600 });
  }, [percentage]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progressShared.value}%`,
    };
  });

  return (
    <View className="flex-row items-center gap-3">
      {/* ProgressBar Track */}
      <View style={{ height, padding: 2 }} className="flex-1 bg-brand-darkest rounded-full border border-brand-petrol/40">
        {/* ProgressBar Fill */}
        <Animated.View
          style={[{ height: '100%' }, animatedStyle]}
          className="bg-brand-silver rounded-full"
        />
      </View>
      {/* Percentage Text */}
      <View className="bg-brand-petrol/40 border border-brand-steel/20 px-2 py-0.5 rounded-full">
        <Text className="text-[11px] font-bold text-brand-silver">
          {percentage}%
        </Text>
      </View>
    </View>
  );
}
