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
  // 根据屏幕宽度自动计算间距
  let spacing = 16;
  if (deviceType === "mobile") {
    spacing = Math.max(6, Math.floor(width / 60));
  } else if (deviceType === "tablet") {
    spacing = Math.max(8, Math.floor(width / 80));
  } else {
    spacing = Math.max(12, Math.floor(width / 100));
  }

  let columns: number;
  let cardWidth: number;
  let cardHeight: number;

  switch (deviceType) {
    case "mobile":
      columns = isPortrait ? 3 : 4;
      // 根据间距自动调整卡片宽度，确保卡片填满屏幕
      cardWidth = (width - spacing * (columns + 1)) / columns;
      cardHeight = cardWidth * 1.428; // 7:5 aspect ratio (2:3)
      break;

    case "tablet":
      columns = isPortrait ? 3 : 4;
      cardWidth = (width - spacing * (columns + 1)) / columns;
      cardHeight = cardWidth * 1.428; // 7:5 aspect ratio (2:3)
      break;

    case "tv":
    default: {
      const sidebarWidth = sidebarCollapsed ? 80 : 240;
      const availableWidth = width - sidebarWidth - spacing * 2;
      const minCardWidth = 120;
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

  // 缓存样式对象，避免每次渲染都创建新对象
  const stylesRef = useRef<any>(null);
  const prevDeviceTypeRef = useRef<string>(config.deviceType);

  if (!stylesRef.current || prevDeviceTypeRef.current !== config.deviceType) {
    stylesRef.current = {
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
      titleFontSize: config.deviceType === "mobile" ? 18 : config.deviceType === "tablet" ? 22 : 28,
      bodyFontSize: config.deviceType === "mobile" ? 14 : config.deviceType === "tablet" ? 16 : 18,

      // Spacing
      sectionSpacing: config.deviceType === "mobile" ? 16 : config.deviceType === "tablet" ? 20 : 24,
      itemSpacing: config.spacing,
    };
    prevDeviceTypeRef.current = config.deviceType;
  }

  return stylesRef.current;
};
