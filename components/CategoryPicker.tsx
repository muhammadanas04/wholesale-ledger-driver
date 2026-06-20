import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon, { IconName } from './Icon';
import { ExpenseCategory, EXPENSE_CATEGORIES } from '../types';

interface CategoryPickerProps {
  selectedCategory: ExpenseCategory | null;
  onSelect: (category: ExpenseCategory) => void;
}

const SYMBOL_MAP: Record<ExpenseCategory, IconName> = {
  petrol_diesel: { ios: 'fuelpump.fill', android: 'local-gas-station', web: 'local-gas-station' },
  repair: { ios: 'wrench.and.screwdriver.fill', android: 'build', web: 'build' },
  defective_item: { ios: 'exclamationmark.triangle.fill', android: 'report-problem', web: 'report-problem' },
  other: { ios: 'ellipsis.circle.fill', android: 'more-horiz', web: 'more-horiz' },
};

export default function CategoryPicker({ selectedCategory, onSelect }: CategoryPickerProps) {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-3">
      {EXPENSE_CATEGORIES.map((cat) => {
        const isSelected = selectedCategory === cat.key;
        const symbol = SYMBOL_MAP[cat.key];

        return (
          <TouchableOpacity
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            activeOpacity={0.8}
            className={`w-[48%] bg-white p-4 rounded-2xl border flex flex-col gap-2.5 items-center justify-center active:scale-95 ${
              isSelected
                ? 'bg-[#0D9488]/5 border-[#0D9488]'
                : 'border-slate-200'
            }`}
          >
            <View
              className={`w-12 h-12 rounded-full items-center justify-center ${
                isSelected ? 'bg-[#0D9488]/15' : 'bg-slate-100'
              }`}
            >
              <Icon
                name={symbol}
                size={22}
                tintColor={isSelected ? '#0D9488' : '#64748B'}
              />
            </View>
            <Text
              className={`text-sm font-bold text-center ${
                isSelected ? 'text-[#0D9488]' : 'text-slate-600'
              }`}
            >
              {cat.label}
            </Text>
            {isSelected && (
              <View className="absolute top-2 right-2 w-5 h-5 bg-[#0D9488] rounded-full items-center justify-center">
                <Icon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={12} tintColor="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
