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

  // 优化 renderItemWrapper，使用 useMemo 缓存
  const renderItemWrapper = useMemo(() => {
    const isTV = responsiveConfig.deviceType === 'tv';
    const spacing = responsiveConfig.spacing;
    const columns = effectiveColumns;
    
    return ({ item, index }: { item: any; index: number }): React.ReactElement => {
      const card = renderItem({ item, index });
      const isLastInRow = (index + 1) % columns === 0;
      return (
        <View style={{ 
          marginBottom: isTV ? spacing : 0,
          marginRight: isLastInRow ? 0 : spacing / 2,
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

  // 各设备卡片信息区的固定高度（与 VideoCard.mobile/tablet 的 infoContainer 高度保持一致）
  const INFO_AREA_HEIGHT = { mobile: 56, tablet: 62, tv: 60 } as const;

  // 计算 FlatList 每个网格项的高度，用于 TV 焦点滚动对齐
  // 注意：这里的高度必须与 renderItemWrapper 中的 marginBottom 完全匹配
  const itemHeight = useMemo(() => {
    if (responsiveConfig.deviceType === "tv") {
      // VideoCard.tv 高度 = cardHeight + 60，加上行间距
      return responsiveConfig.cardHeight + INFO_AREA_HEIGHT.tv + responsiveConfig.spacing;
    }
    // 非 TV：卡片高度 + 固定信息区高度 + 卡片底部间距
    // （VideoCard.mobile/tablet 的 wrapper marginBottom = spacing，renderItemWrapper 不额外加）
    return (
      responsiveConfig.cardHeight +
      INFO_AREA_HEIGHT[responsiveConfig.deviceType] +
      responsiveConfig.spacing
    );
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
        extraData={renderItem}
        numColumns={effectiveColumns}
        keyExtractor={(item, index) => item.id || String(index)}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          // getItemLayout 与真实布局存在偏差时的兜底：按平均项高滚动到估算位置
          flatListRef.current?.scrollToOffset({
            offset: averageItemLength * index,
            animated: false,
          });
        }}
        contentContainerStyle={dynamicStyles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={responsiveConfig.deviceType !== 'tv'}
        ListFooterComponent={renderFooter()}
        // 虚拟化参数必须足够宽松：ScrollView 版本（203ba2b）全量渲染无断层，
        // FlatList 虚拟化窗口过小（e900257 曾将 TV 的 maxToRenderPerBatch 缩到 8、
        // windowSize 缩到 7）会导致翻页追加数据后渲染跟不上滚动，出现大片空白"断层"。
        // 注意：contentData 无上限（缓存才限 200 条），翻页到 200 条以上后 windowSize
        // 再大也覆盖不了全部内容，虚拟化仍会卸载窗口外的行 → 滚动经过即空白。
        // 因此直接关闭虚拟化，行为与 203ba2b 的 ScrollView 全量渲染一致；数据量
        // 有限（通常 <400 条），性能可接受，同时保留 FlatList 以兼容 scrollToIndex。
        initialNumToRender={40}
        maxToRenderPerBatch={40}
        windowSize={21}
        removeClippedSubviews={false}
        disableVirtualization
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