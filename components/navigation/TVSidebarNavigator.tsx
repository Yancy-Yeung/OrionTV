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
      {!collapsed && (
        <View style={styles.toggleButton}>
          <StyledButton
            focusable={true}
            text="<"
            onPress={() => setCollapsed(true)}
            onFocus={handleToggleFocus}
            variant="ghost"
            style={styles.toggleButtonInner}
            textStyle={styles.toggleText}
          />
        </View>
      )}
      
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
      width: collapsed ? 80 : 240,
      backgroundColor: '#111',
      borderRightWidth: 1,
      borderRightColor: '#333',
      paddingHorizontal: collapsed ? 4 : spacing,
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
    mainContent: {
      flex: 1,
      backgroundColor: '#000',
    },
  });

export default TVSidebarNavigator;
