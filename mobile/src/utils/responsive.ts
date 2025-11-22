import { useWindowDimensions } from 'react-native';

/**
 * Hook to get responsive values based on screen size
 * Helps adapt layouts for phones, tablets, and split-screen modes
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  
  // Ensure we have valid dimensions (width > 0)
  // This prevents layout issues on initial render
  const validWidth = width > 0 ? width : 0;
  const validHeight = height > 0 ? height : 0;
  
  // Consider tablet if width >= 600 (medium tablet size)
  const isTablet = validWidth >= 600;
  const isSmallTablet = validWidth >= 600 && validWidth < 900;
  const isLargeTablet = validWidth >= 900;
  
  // For split-screen, we might have narrower widths
  const isSplitScreen = validWidth < 600 && validWidth >= 400;
  
  // Calculate max content width for tablets to prevent content from being too wide
  const maxContentWidth = isTablet ? Math.min(validWidth * 0.8, 1200) : validWidth;
  
  // Responsive padding
  const padding = {
    small: isTablet ? 16 : 10,
    medium: isTablet ? 24 : 15,
    large: isTablet ? 32 : 20,
  };
  
  // Responsive font sizes
  const fontSize = {
    small: isTablet ? 14 : 12,
    medium: isTablet ? 18 : 16,
    large: isTablet ? 28 : 24,
    xlarge: isTablet ? 36 : 28,
  };
  
  // Responsive spacing
  const spacing = {
    xs: isTablet ? 8 : 5,
    sm: isTablet ? 12 : 8,
    md: isTablet ? 16 : 12,
    lg: isTablet ? 24 : 16,
    xl: isTablet ? 32 : 20,
  };
  
  return {
    width: validWidth,
    height: validHeight,
    isTablet,
    isSmallTablet,
    isLargeTablet,
    isSplitScreen,
    maxContentWidth,
    padding,
    fontSize,
    spacing,
    hasValidDimensions: validWidth > 0 && validHeight > 0,
  };
}

