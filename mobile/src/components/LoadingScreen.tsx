import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { useResponsive } from '../utils/responsive';

interface LoadingScreenProps {
  /** Optional custom loading text. Defaults to "Loading..." */
  text?: string;
}

/**
 * A reusable loading screen component with centered spinner and text.
 * Provides a consistent loading experience across the app.
 */
export function LoadingScreen({ text = 'Loading...' }: LoadingScreenProps) {
  const responsive = useResponsive();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[
          styles.loadingText,
          { fontSize: responsive.fontSize.medium, marginTop: responsive.spacing.md }
        ]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 16,
  },
});

export default LoadingScreen;
