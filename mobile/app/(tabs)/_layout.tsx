import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scrape',
          tabBarIcon: ({ color }) => <Feather name="search" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crawl"
        options={{
          title: 'Crawl',
          tabBarIcon: ({ color }) => <Feather name="git-merge" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
