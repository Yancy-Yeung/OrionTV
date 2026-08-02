import { useState, useEffect, useRef } from "react";
import { Dimensions, Platform } from "react-native";

export type DeviceType = "mobile" | "tablet" | "tv";

export interface ResponsiveConfig {
  deviceType: DeviceType;
  columns: number;
  cardWidth: number;
  cardHeight: number;
  spacing: number;
  isPortrait: boolean;
  screenWidth: number;
  screenHeight: number;
}

const BREAKPOINTS = {
  mobile: { min: 0, max: 767 },
  tablet: { min: 768, max: 1023 },
  tv: { min: 1024, max: Infinity },
};

const getDeviceType = (width: number): DeviceType => {
  if (Platform.isTV) return "tv";

  if (width >= BREAKPOINTS.tv.min) return "tv";
  if (width >= BREAKPOINTS.tablet.min) return "tablet";
  return "mobile";
};

const getLayoutConfig = (
  deviceType: DeviceType,
  width: number,
  height: number,
  isPortrait: boolean,
  sidebarCollapsed: boolean
): ResponsiveConfig => {
  let spacing = 16;
  if (deviceType === "mobile") {
    spacing = 8;
  } else if (deviceType === "tablet") {
    spacing = 12;
  }

  let columns: number;
  let cardWidth: number;
  let cardHeight: number;

  switch (deviceType) {
    case "mobile":
      columns = isPortrait ? 3 : 4;
      // 使用flex布局，卡片可以更大一些来填充空间
      cardWidth = ((width - spacing) / columns) * 0.85; // 增大到85%
      cardHeight = cardWidth * 1.2; // 5:6 aspect ratio (reduced from 2:3)
      break;

    case "tablet":
      columns = isPortrait ? 3 : 4;
      cardWidth = ((width - spacing) / columns) * 0.85; // 增大到85%
      cardHeight = cardWidth * 1.4; // slightly less tall ratio
      break;

    case "tv":
    default: {
      const sidebarWidth = sidebarCollapsed ? 80 : 240;
      const availableWidth = width - sidebarWidth - spacing;
      const minCardWidth = 150;
      const maxColumns = Math.max(1, Math.floor((availableWidth + spacing) / (minCardWidth + spacing)));
      columns = Math.min(5, maxColumns);
      cardWidth = Math.floor((availableWidth - spacing * (columns - 1)) / columns);
      cardHeight = Math.floor(cardWidth * 1.5);
      break;
    }
  }

  return {
    deviceType,
    columns,
    cardWidth,
    cardHeight,
    spacing,
    isPortrait,
    screenWidth: width,
    screenHeight: height,
  };
};

export const useResponsiveLayout = (sidebarCollapsed: boolean = false): ResponsiveConfig => {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get("window");
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;
  const isPortrait = height > width;
  const deviceType = getDeviceType(width);

  // 缓存布局配置，避免每次渲染都创建新对象
  const layoutRef = useRef<ResponsiveConfig | null>(null);
  const prevConfigRef = useRef<{
    deviceType: DeviceType;
    width: number;
    height: number;
    isPortrait: boolean;
    sidebarCollapsed: boolean;
  } | null>(null);

  const currentConfig = getLayoutConfig(deviceType, width, height, isPortrait, sidebarCollapsed);

  // 只有当关键参数变化时才创建新对象
  if (
    !layoutRef.current ||
    prevConfigRef.current?.deviceType !== deviceType ||
    prevConfigRef.current?.width !== width ||
    prevConfigRef.current?.height !== height ||
    prevConfigRef.current?.isPortrait !== isPortrait ||
    prevConfigRef.current?.sidebarCollapsed !== sidebarCollapsed
  ) {
    layoutRef.current = currentConfig;
    prevConfigRef.current = { deviceType, width, height, isPortrait, sidebarCollapsed };
  }

  return layoutRef.current;
};

// Utility hook for responsive values
export const useResponsiveValue = <T>(values: { mobile: T; tablet: T; tv: T }): T => {
  const { deviceType } = useResponsiveLayout();
  return values[deviceType];
};

// Utility hook for responsive styles
export const useResponsiveStyles = () => {
  const config = useResponsiveLayout();

  return {
    // Common responsive styles
    container: {
      paddingHorizontal: config.spacing,
    },

    // Card styles
    cardContainer: {
      width: config.cardWidth,
      height: config.cardHeight,
      marginBottom: config.spacing,
    },

    // Grid styles
    gridContainer: {
      paddingHorizontal: config.spacing / 2,
    },

    // Typography
    titleFontSize: (() => {
      if (config.deviceType === "mobile") return 18;
      if (config.deviceType === "tablet") return 22;
      return 28;
    })(),
    bodyFontSize: (() => {
      if (config.deviceType === "mobile") return 14;
      if (config.deviceType === "tablet") return 16;
      return 18;
    })(),

    // Spacing
    sectionSpacing: (() => {
      if (config.deviceType === "mobile") return 16;
      if (config.deviceType === "tablet") return 20;
      return 24;
    })(),
    itemSpacing: config.spacing,
  };
};
