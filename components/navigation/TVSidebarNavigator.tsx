import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';

interface TVSidebarNavigatorProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  sidebarTitle?: string;
  handleMainContentFocus?: () => void;
}

const TVSidebarNavigator: React.FC<TVSidebarNavigatorProps> = ({
  children,
  sidebarContent,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  sidebarTitle = '菜单',
  handleMainContentFocus,
}) => {
  const { spacing } = useResponsiveLayout();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const setCollapsed = (value: boolean) => {
    if (onCollapsedChange) {
      onCollapsedChange(value);
    } else {
      setInternalCollapsed(value);
    }
  };

  // 当焦点进入侧边栏区域时自动展开（解决折叠后焦点死锁问题）
  const handleSidebarFocus = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
    }
  }, [collapsed, setCollapsed]);

  const styles = createStyles(spacing, collapsed);

  return (
    <View style={styles.container}>
      {/* 侧边栏容器 - 添加 onFocus 实现自动展开 */}
      <View
        style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}
        focusable={true}
        onFocus={handleSidebarFocus}
      >
        <View style={styles.sidebarHeader}>
          {!collapsed && <ThemedText style={styles.sidebarTitle}>{sidebarTitle}</ThemedText>}
          <StyledButton
            text={collapsed ? '>' : '<'}
            onPress={() => setCollapsed(!collapsed)}
            variant="ghost"
            style={styles.toggleButton}
            textStyle={styles.toggleText}
          />
        </View>
        <ScrollView style={styles.sidebarContent} showsVerticalScrollIndicator={false}>
          {sidebarContent}
        </ScrollView>
      </View>
      <View style={styles.mainContent} onFocus={handleMainContentFocus}>{children}</View>
    </View>
  );
};

const createStyles = (spacing: number, collapsed: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
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
