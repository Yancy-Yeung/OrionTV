import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface TVSidebarNavigatorProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
}

const TVSidebarNavigator: React.FC<TVSidebarNavigatorProps> = ({
  children,
  sidebarContent,
}) => {
  const { spacing } = useResponsiveLayout();

  const styles = createStyles(spacing);

  return (
    <View style={styles.container}>
      {/* 区域1: 侧边栏 */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarContent}>
          {sidebarContent}
        </View>
      </View>
      
      {/* 区域2: 主内容区 */}
      <View style={styles.mainContent}>
        {children}
      </View>
    </View>
  );
};

const createStyles = (spacing: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
      height: '100%',
      flexDirection: 'row',
    },
    sidebar: {
      width: 210,
      backgroundColor: '#111',
      borderRightWidth: 1,
      borderRightColor: '#333',
      paddingLeft: spacing + 12,
      paddingRight: spacing,
      paddingTop: spacing,
      paddingBottom: spacing,
    },    
    sidebarContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainContent: {
      flex: 1,
      backgroundColor: '#000',
    },
  });

export default TVSidebarNavigator;
