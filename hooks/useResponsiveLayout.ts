import { useState, useEffect, useRef, createContext, useContext, createElement, type ReactNode } from "react";
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

// 是否带 TV 侧边栏的上下文。
// 只有首页（index）使用 TVSidebarNavigator 侧边栏，其余页面（搜索/收藏等）没有侧边栏。
// 卡片宽度的 TV 计算会根据该值决定是否减去侧边栏宽度，从而让无侧边栏页面自适配全屏宽度。
const LayoutContext = createContext<{ hasSidebar: boolean }>({ hasSidebar: true });

export const LayoutSidebarProvider = ({
  hasSidebar,
  children,
}: {
  hasSidebar: boolean;
  children: ReactNode;
}) => {
  return createElement(
    LayoutContext.Provider,
    { value: { hasSidebar } },
    children
  );
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
  hasSidebar: boolean
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
      // 侧边栏固定宽度（仅带侧边栏的页面才扣除，如首页）
      const sidebarWidth = hasSidebar ? 210 : 0;
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

export const useResponsiveLayout = (): ResponsiveConfig => {
  const { hasSidebar } = useContext(LayoutContext);

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
    hasSidebar: boolean;
  } | null>(null);

  const currentConfig = getLayoutConfig(deviceType, width, height, isPortrait, hasSidebar);

  // 只有当关键参数变化时才创建新对象
  if (
    !layoutRef.current ||
    prevConfigRef.current?.deviceType !== deviceType ||
    prevConfigRef.current?.width !== width ||
    prevConfigRef.current?.height !== height ||
    prevConfigRef.current?.isPortrait !== isPortrait ||
    prevConfigRef.current?.hasSidebar !== hasSidebar
  ) {
    layoutRef.current = currentConfig;
    prevConfigRef.current = { deviceType, width, height, isPortrait, hasSidebar };
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
