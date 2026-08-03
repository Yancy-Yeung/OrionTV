import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { ThemedText } from '@/components/ThemedText';
import { SidebarButton } from '@/components/SidebarButton';

interface TVSidebarNavigatorProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onToggleFocus?: () => void;
  sidebarFocusable?: boolean;
}

const TVSidebarNavigator: React.FC<TVSidebarNavigatorProps> = ({
  children,
  sidebarContent,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  onToggleFocus,
  sidebarFocusable = true,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const { spacing } = useResponsiveLayout(collapsed);

  const setCollapsed = (value: boolean) => {
    if (onCollapsedChange) {
      onCollapsedChange(value);
    } else {
      setInternalCollapsed(value);
    }
  };

  const handleToggleFocus = () => {
    onToggleFocus?.();
    if (collapsed) {
      setCollapsed(false);
    }
  };

  const styles = createStyles(spacing, collapsed);

  return (
    <View style={styles.container}>
      {/* 区域1: 侧边栏 */}
      <View
        style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}
      >
        <View style={styles.sidebarHeader}>
          {!collapsed }
        </View>
        <View style={styles.sidebarContent}>
          {sidebarContent}
        </View>
      </View>
      
      {/* 区域2: 焦点过渡按钮 - 高度与侧边栏相同，作为焦点从侧边栏到主内容区的必经之路 */}
      {/* 保持可见，即使侧边栏折叠也需要它来重新展开 */}
      <View style={styles.toggleButton}>
        <SidebarButton
          focusable={true}
          text={collapsed ? ">" : "<"}
          onPress={() => setCollapsed(!collapsed)}
          onFocus={handleToggleFocus}
          variant="ghost"
          style={styles.toggleButtonInner}
          textStyle={styles.toggleText}
          collapsed={collapsed}
        />
      </View>
      
      {/* 区域3: 主内容区 */}
      <View style={styles.mainContent}>
        {children}
      </View>
    </View>
  );
};

const createStyles = (spacing: number, collapsed: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
      height: '100%',
      flexDirection: 'row',
    },
    sidebar: {
      width: collapsed ? 50 : 210,
      backgroundColor: '#111',
      borderRightWidth: 1,
      borderRightColor: '#333',
      // 左侧增加内边距，确保菜单项聚焦放大时左侧边框不超出屏幕
      paddingLeft: collapsed ? 12 : spacing + 12,
      paddingRight: collapsed ? 4 : spacing,
      paddingTop: spacing,
      paddingBottom: spacing,
    },
    sidebarCollapsed: {
      width: 50,
    },
    sidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing,
    },    
    toggleButton: {
      width: 40,
      height: '100%',
      backgroundColor: 'rgba(0, 122, 255, 0.15)',
      borderLeftWidth: 1,
      borderLeftColor: '#333',
      borderRightWidth: 1,
      borderRightColor: '#333',
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleButtonInner: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing * 2,
    },
    toggleText: {
      fontSize: 24,
      color: '#fff',
      writingMode: 'vertical-rl',
      textOrientation: 'mixed',
    },
    toggleTextCollapsed: {
      fontSize: 24,
      color: '#fff',
      writingMode: 'vertical-rl',
      textOrientation: 'mixed',
    },
    mainContent: {
      flex: 1,
      backgroundColor: '#000',
    },
  });

export default TVSidebarNavigator;
