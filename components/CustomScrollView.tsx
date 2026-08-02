import React, { useCallback, useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler } from "react-native";
import type { ListRenderItem } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";

export interface CustomScrollViewRef {
  scrollToIndex: (params: { index: number; animated?: boolean; viewPosition?: number }) => void;
}

interface CustomScrollViewProps {
  data: any[];
  renderItem: ListRenderItem<any>;
  numColumns?: number; // 如果不提供，将使用响应式默认值
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  loadMoreThreshold?: number;
  emptyMessage?: string;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
}

const CustomScrollView = forwardRef<CustomScrollViewRef, CustomScrollViewProps>(({
  data,
  renderItem,
  numColumns,
  loading = false,
  loadingMore = false,
  error = null,
  onEndReached,
  loadMoreThreshold = 200,
  emptyMessage = "暂无内容",
  ListFooterComponent,
}, ref) => {
  const flatListRef = useRef<FlatList>(null);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (params: { index: number; animated?: boolean; viewPosition?: number }) => {
      flatListRef.current?.scrollToIndex({
        index: params.index,
        animated: params.animated ?? true,
        viewPosition: params.viewPosition ?? 0,
      });
    },
  }));
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType } = responsiveConfig;

  // 使用响应式列数，如果没有明确指定的话
  const effectiveColumns = numColumns || responsiveConfig.columns;

  // 缓存 renderItemWrapper，避免每次 render 都创建新函数
  const renderItemWrapper = useMemo(() => {
    const isTV = responsiveConfig.deviceType === 'tv';
    return ({ item, index }: { item: any; index: number }): React.ReactElement => {
      const card = renderItem({ item, index });
      const isLastInRow = (index + 1) % effectiveColumns === 0;
      return (
        <View style={{ 
          marginBottom: isTV ? responsiveConfig.spacing : 0,
          marginRight: isLastInRow ? 0 : responsiveConfig.spacing / 2,
        }}>
          {card}
        </View>
      );
    };
  }, [renderItem, responsiveConfig.deviceType, responsiveConfig.spacing, effectiveColumns]);

  // 动态样式
  const dynamicStyles = useMemo(() => StyleSheet.create({
    listContent: {
      paddingBottom: responsiveConfig.spacing * 2,
      paddingHorizontal: responsiveConfig.deviceType === 'tv' ? 0 : responsiveConfig.spacing / 2,
    },
    columnWrapper: {
      marginBottom: 0,
    },
    itemContainer: {
      width: responsiveConfig.cardWidth,
      marginRight: responsiveConfig.spacing,
    },
    lastItemContainer: {
      width: responsiveConfig.cardWidth,
      marginRight: 0,
    },
    scrollToTopButton: {
      position: 'absolute',
      right: responsiveConfig.spacing,
      bottom: responsiveConfig.spacing * 2,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      padding: responsiveConfig.spacing,
      borderRadius: responsiveConfig.spacing,
      opacity: showScrollToTop ? 1 : 0,
    },
  }), [responsiveConfig.spacing, responsiveConfig.deviceType, showScrollToTop]);

  // 计算 FlatList 每个网格项的高度，用于 TV 焦点滚动对齐
  // 注意：这里的高度必须与 renderItemWrapper 中的 marginBottom 完全匹配
  const itemHeight = useMemo(() => {
    if (responsiveConfig.deviceType === "tv") {
      // VideoCard.tv pressable height = 300, plus column wrapper spacing for row gap
      return 300 + responsiveConfig.spacing;
    }
    // 非 TV 模式下 renderItemWrapper 的 marginBottom = 0，所以只使用卡片高度
    return responsiveConfig.cardHeight;
  }, [responsiveConfig.cardHeight, responsiveConfig.deviceType, responsiveConfig.spacing]);

  // 为 getItemLayout 提供精确的项高度计算
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: itemHeight,
      offset: itemHeight * Math.floor(index / effectiveColumns),
      index,
    }),
    [itemHeight, effectiveColumns]
  );

  // 添加返回键处理逻辑
  useEffect(() => {
    if (deviceType === 'tv') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (showScrollToTop) {
          scrollToTop();
          return true; // 阻止默认的返回行为
        }
        return false; // 允许默认的返回行为
      });

      return () => backHandler.remove();
    }
  }, [showScrollToTop,deviceType]);

  const handleScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: any }) => {
      // 显示/隐藏返回顶部按钮
      setShowScrollToTop(nativeEvent.contentOffset.y > 200);
    },
    []
  );

  const handleEndReached = useCallback(() => {
    if (!loadingMore && onEndReached) {
      onEndReached();
    }
  }, [onEndReached, loadingMore]);

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderFooter = useMemo(() => {
    if (ListFooterComponent) {
      if (React.isValidElement(ListFooterComponent)) {
        return () => ListFooterComponent;
      } else if (typeof ListFooterComponent === "function") {
        const Component = ListFooterComponent as React.ComponentType<any>;
        return () => <Component />;
      }
      return () => null;
    }
    if (loadingMore) {
      return () => <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
    }
    return () => null;
  }, [ListFooterComponent, loadingMore]);

  if (loading) {
    return (
      <View style={commonStyles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={commonStyles.center}>
        <ThemedText type="subtitle" style={{ padding: responsiveConfig.spacing }}>
          {error}
        </ThemedText>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={commonStyles.center}>
        <ThemedText>{emptyMessage}</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItemWrapper}
        numColumns={effectiveColumns}
        keyExtractor={(item, index) => item.id || String(index)}
        contentContainerStyle={dynamicStyles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={responsiveConfig.deviceType !== 'tv'}
        ListFooterComponent={renderFooter()}
        initialNumToRender={responsiveConfig.deviceType === 'tv' ? 16 : 8}
        maxToRenderPerBatch={responsiveConfig.deviceType === 'tv' ? 8 : 5}
        windowSize={responsiveConfig.deviceType === 'tv' ? 7 : 5}
        removeClippedSubviews={responsiveConfig.deviceType !== 'tv'}
        columnWrapperStyle={effectiveColumns > 1 ? dynamicStyles.columnWrapper : undefined}
      />
      {deviceType!=='tv' && (
        <TouchableOpacity
          style={dynamicStyles.scrollToTopButton}
          onPress={scrollToTop}
          activeOpacity={0.8}
        >
          <ThemedText>⬆️</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default CustomScrollView;