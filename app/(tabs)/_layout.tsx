import { Stack } from 'expo-router';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surfaceSolid,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
