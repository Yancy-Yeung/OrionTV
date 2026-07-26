import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';

interface TVSidebarNavigatorProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onToggleFocus?: () => void;
  sidebarTitle?: string;
  sidebarFocusable?: boolean;
}

const TVSidebarNavigator: React.FC<TVSidebarNavigatorProps> = ({
  children,
  sidebarContent,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  onToggleFocus,
  sidebarTitle = '菜单',
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
      {/* 侧边栏容器 - 整体控制焦点 */}
      <View
        style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}
      >
        <View style={styles.sidebarHeader}>
          {!collapsed && <ThemedText style={styles.sidebarTitle}>{sidebarTitle}</ThemedText>}
          <StyledButton
            focusable={true}
            text={collapsed ? '>' : '<'}
            onPress={() => setCollapsed(!collapsed)}
            onFocus={handleToggleFocus}
            variant="ghost"
            style={styles.toggleButton}
            textStyle={styles.toggleText}
          />
        </View>
        <View style={styles.sidebarContent}>
          {sidebarContent}
        </View>
      </View>
      {/* 主内容区 */}
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
      width: collapsed ? 80 : 240,
      backgroundColor: '#111',
      borderRightWidth: 1,
      borderRightColor: '#333',
      paddingHorizontal: collapsed ? spacing / 2 : spacing,
      paddingTop: spacing,
      paddingBottom: spacing,
    },
    sidebarCollapsed: {
      width: 80,
    },
    sidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing,
    },
    sidebarTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
    },
    toggleButton: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      minWidth: 42,
    },
    toggleText: {
      fontSize: 18,
      color: '#fff',
    },
    sidebarContent: {
      flex: 1,
    },
    mainContent: {
      flex: 1,
      backgroundColor: '#000',
    },
  });

export default TVSidebarNavigator;
