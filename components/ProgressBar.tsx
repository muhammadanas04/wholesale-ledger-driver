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
      <View style={{ height }} className="flex-1 bg-slate-200/80 rounded-full overflow-hidden">
        {/* ProgressBar Fill */}
        <Animated.View
          style={[{ height }, animatedStyle]}
          className="bg-[#0D9488] rounded-full"
        />
      </View>
      {/* Percentage Text */}
      <View className="bg-[#0D9488]/10 px-2.5 py-1 rounded-full">
        <Text className="text-sm font-extrabold text-[#0D9488]">
          {percentage}%
        </Text>
      </View>
    </View>
  );
}
