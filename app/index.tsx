import React, { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { View, StyleSheet, ActivityIndicator, FlatList, Pressable, Animated, StatusBar, Platform, BackHandler, ToastAndroid } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { api } from "@/services/api";
import VideoCard from "@/components/VideoCard";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { Search, Settings, LogOut, Heart } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import useHomeStore, { RowItem, Category } from "@/stores/homeStore";
import useAuthStore from "@/stores/authStore";
import CustomScrollView from "@/components/CustomScrollView";
import type { CustomScrollViewRef } from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import TVSidebarNavigator from "@/components/navigation/TVSidebarNavigator";
import { useApiConfig, getApiConfigErrorMessage } from "@/hooks/useApiConfig";
import { Colors } from "@/constants/Colors";

const LOAD_MORE_THRESHOLD = 200;

export default function HomeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = "dark";
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [lastDetailCardIndex, setLastDetailCardIndex] = useState<number>(0);
  const [tvFocusRegion, setTVFocusRegion] = useState<'sidebar' | 'content'>('sidebar');
  const [restoreCardFocus, setRestoreCardFocus] = useState(false);
  const [lastSidebarFocusKey, setLastSidebarFocusKey] = useState<string | null>(null);
  const [restorePending, setRestorePending] = useState(false);
  const customScrollRef = useRef<CustomScrollViewRef>(null);
  const hasMountedRef = useRef(false);
  const lastDetailCardIndexRef = useRef<number>(0);
  const lastSidebarFocusKeyRef = useRef<string | null>(null);
  const sidebarItemRefs = useRef<Record<string, React.RefObject<any>>>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  // 缓存动态样式，避免每次渲染重新创建
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === "mobile" ? insets.top : deviceType === "tablet" ? insets.top + 20 : 0,
    },
    headerContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing * 1.5,
      marginBottom: spacing,
    },
    headerTitle: {
      fontSize: deviceType === "mobile" ? 24 : deviceType === "tablet" ? 28 : 32,
      fontWeight: "bold",
      paddingTop: 16,
    },
    rightHeaderButtons: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconButton: {
      borderRadius: 30,
      marginLeft: spacing / 2,
    },
    categoryContainer: {
      paddingBottom: spacing / 2,
    },
    categoryListContent: {
      paddingHorizontal: spacing,
    },
    categoryButton: {
      paddingHorizontal: deviceType === "tv" ? spacing / 4 : spacing / 2,
      paddingVertical: spacing / 2,
      borderRadius: deviceType === "mobile" ? 6 : 8,
      marginHorizontal: deviceType === "tv" ? spacing / 4 : spacing / 2,
    },
    categoryText: {
      fontSize: deviceType === "mobile" ? 14 : 16,
      fontWeight: "500",
    },
    tvSidebarList: {
      paddingBottom: spacing,
    },
    tvSidebarItem: {
      marginBottom: spacing / 2,
      width: "100%",
      justifyContent: "center",
      alignItems: "flex-start",
      paddingVertical: spacing * 0.75,
      paddingHorizontal: spacing / 2,
      borderRadius: 10,
    },
    tvSidebarItemCollapsed: {
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 8,
      minWidth: 0,
    },
    tvSidebarItemCollapseText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#fff",
      includeFontPadding: false,
    },
    tvTagGroup: {
      marginLeft: spacing,
      marginTop: spacing / 4,
      marginBottom: spacing / 2,
    },
    tvTagButton: {
      marginBottom: spacing / 4,
      alignItems: "flex-start",
      width: "100%",
      paddingHorizontal: spacing / 2,
    },
    contentContainer: {
      flex: 1,
    },
  }), [deviceType, spacing, insets.top]);

  const {
    categories,
    selectedCategory,
    contentData,
    loading,
    loadingMore,
    error,
    fetchInitialData,
    loadMoreData,
    selectCategory,
    refreshPlayRecords,
    clearError,
  } = useHomeStore();

  const sidebarFocusEnabled = tvFocusRegion === 'sidebar';
  const contentFocusEnabled = tvFocusRegion === 'content';
  const { isLoggedIn, logout } = useAuthStore();
  const apiConfigStatus = useApiConfig();

  useFocusEffect(
    useCallback(() => {
      refreshPlayRecords();
    }, [refreshPlayRecords])
  );

    // 双击返回退出逻辑（只在首页 index 生效）
  const backPressTimeRef = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
    const handleBackPress = () => {
      // 仅当当前页面是首页（index）时才处理返回逻辑，
      // 其他页面（如 detail）直接放行给默认返回行为（返回上一页）
      if (pathname !== "/") {
        backPressTimeRef.current = null; // 重置计时，防止跨页面误触发退出
        return false;
      }

      const now = Date.now();



      // 如果在侧边栏，双击返回退出
      if (!backPressTimeRef.current || now - backPressTimeRef.current > 2000) {
        backPressTimeRef.current = now;
        ToastAndroid.show("再按一次返回键退出", ToastAndroid.SHORT);
        return true; // 拦截返回事件，不退出
      }

      // 两次返回键间隔小于2秒，退出应用
      BackHandler.exitApp();
      return true;
    };

    // 仅限 Android 平台启用此功能
    if (Platform.OS === "android") {
      const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackPress);

      // 首页失去焦点时移除监听并重置状态
      return () => {
        backHandler.remove();
        backPressTimeRef.current = null;
      };
    }
  }, [tvFocusRegion, pathname])
);

  // 统一的数据获取逻辑
  useEffect(() => {
    if (!selectedCategory) return;

    // 如果是容器分类且没有选择标签，设置默认标签
    if (selectedCategory.tags && !selectedCategory.tag) {
      const defaultTag = selectedCategory.tags[0];
      setSelectedTag(defaultTag);
      selectCategory({ ...selectedCategory, tag: defaultTag });
      return;
    }

    // 只有在API配置完成且分类有效时才获取数据
    if (apiConfigStatus.isConfigured && !apiConfigStatus.needsConfiguration) {
      // 对于有标签的分类，需要确保有标签才获取数据
      if (selectedCategory.tags && selectedCategory.tag) {
        fetchInitialData();
      }
      // 对于无标签的分类，直接获取数据
      else if (!selectedCategory.tags) {
        fetchInitialData();
      }
    }
  }, [
    selectedCategory,
    selectedCategory?.tag,
    apiConfigStatus.isConfigured,
    apiConfigStatus.needsConfiguration,
    fetchInitialData,
    selectCategory,
  ]);

  // 清除错误状态的逻辑
  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) {
      clearError();
    }
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  useEffect(() => {
    if (!loading && contentData.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (loading) {
      fadeAnim.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, contentData.length]);

  const handleCategorySelect = (category: Category) => {
    setSelectedTag(null);
    // 选择分类后，继续留在侧边栏模式（可能要选标签）
    setTVFocusRegion('sidebar');
    
    // 切换一级菜单的展开/收起状态
    if (expandedCategory === category.title) {
      // 如果当前分类已展开，则收起
      setExpandedCategory(null);
    } else {
      // 如果当前分类未展开，则展开
      setExpandedCategory(category.title);
    }
    
    selectCategory(category);
  };

  const handleTagSelect = (tag: string) => {
    setSelectedTag(tag);
    // 选择标签后，继续留在侧边栏模式
    setTVFocusRegion('sidebar');
    if (selectedCategory) {
      const categoryWithTag = { ...selectedCategory, tag: tag };
      selectCategory(categoryWithTag);
    }
  };

  const getSidebarItemRef = useCallback((key: string) => {
    if (!sidebarItemRefs.current[key]) {
      sidebarItemRefs.current[key] = React.createRef<any>();
    }
    return sidebarItemRefs.current[key];
  }, []);

  const focusSelectedSidebarItem = useCallback((key?: string) => {
    const targetKey = key ?? lastSidebarFocusKeyRef.current;
    if (!targetKey) return;

    const targetRef = sidebarItemRefs.current[targetKey];
    if (targetRef?.current?.focus) {
      setTimeout(() => targetRef.current.focus(), 0);
    }
  }, []);

  const handleSidebarFocus = useCallback(() => {
    setTVFocusRegion('sidebar');
  }, []);

  useEffect(() => {
    if (tvFocusRegion === 'sidebar') {
      focusSelectedSidebarItem();
    }
  }, [tvFocusRegion, focusSelectedSidebarItem]);


  // 从详情页返回时：保持 FlatList 挂载，只恢复焦点和滚动位置
  lastDetailCardIndexRef.current = lastDetailCardIndex;

  // 数据就绪后才执行焦点恢复（避免 loading 期间 CustomScrollView 卸载导致恢复失败）
  useEffect(() => {
    if (!restorePending) return;
    if (loading) return; // 等待数据就绪
    if (contentData.length === 0) {
      // 无数据可恢复焦点时直接清理挂起状态
      setRestorePending(false);
      return;
    }

    const targetIndex = lastDetailCardIndexRef.current;
    setRestoreCardFocus(true);
    customScrollRef.current?.scrollToIndex({
      index: targetIndex,
      animated: false,
      viewPosition: 0.5,
    });

    const timer = setTimeout(() => {
      setRestoreCardFocus(false);
      setRestorePending(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [restorePending, loading, contentData.length]);

  useFocusEffect(
    useCallback(() => {
      if (hasMountedRef.current && lastDetailCardIndexRef.current >= 0) {

        setRestorePending(true); // 标记待恢复，等数据就绪后执行
      } else {
        hasMountedRef.current = true;
      }
    }, [])
  );

  // 二级菜单紧跟在一级分类下面，选中时展开标签组
  const renderTVCategoryItem = useCallback(({ item, index }: { item: Category; index: number }) => {
    const isSelected = selectedCategory?.title === item.title;
    const hasTags = item.tags && item.tags.length > 0;

    return (
      <View>
        <StyledButton
          ref={getSidebarItemRef(`category-${item.title}`)}
          focusable={true}
          text={item.title}
          onPress={() => handleCategorySelect(item)}
          onFocus={() => {
            const key = `category-${item.title}`;
            setLastSidebarFocusKey(key);
            lastSidebarFocusKeyRef.current = key;
            handleSidebarFocus();
          }}
          isSelected={isSelected}
          style={dynamicStyles.tvSidebarItem}
          textStyle={dynamicStyles.categoryText}
          variant="ghost"
        />
        {/* 选中且有标签时，紧跟在分类下面显示标签组 */}
        {isSelected && hasTags && expandedCategory === item.title && (
          <View style={dynamicStyles.tvTagGroup}>
            {item.tags!.map((tag) => {
              const tagSelected = selectedTag === tag;
              return (
                <StyledButton
                  key={tag}
                  ref={getSidebarItemRef(`tag-${tag}`)}
                  focusable={true}
                  hasTVPreferredFocus={tagSelected && sidebarFocusEnabled}
                  text={tag}
                  onPress={() => handleTagSelect(tag)}
                  onFocus={() => {
                    const key = `tag-${tag}`;
                    setLastSidebarFocusKey(key);
                    lastSidebarFocusKeyRef.current = key;
                    handleSidebarFocus();
                  }}
                  isSelected={tagSelected}
                  style={dynamicStyles.tvTagButton}
                  textStyle={dynamicStyles.categoryText}
                  variant="ghost"
                />
              );
            })}
          </View>
        )}
      </View>
    );
  }, [selectedCategory?.title, sidebarFocusEnabled, selectedTag, expandedCategory, handleCategorySelect, handleTagSelect, getSidebarItemRef, dynamicStyles]);

  const renderCategory = useCallback(({ item }: { item: Category }) => {
    const isSelected = selectedCategory?.title === item.title;
    return (
      <StyledButton
        focusable={deviceType !== 'tv' || sidebarFocusEnabled}
        text={item.title}
        onPress={() => handleCategorySelect(item)}
        onFocus={() => setTVFocusRegion('content')}
        isSelected={isSelected}
        style={dynamicStyles.categoryButton}
        textStyle={dynamicStyles.categoryText}
      />
    );
  }, [selectedCategory?.title, deviceType, sidebarFocusEnabled, handleCategorySelect, dynamicStyles]);

  const renderContentItem = useCallback(({ item, index }: { item: RowItem; index: number }) => {
    // 仅在需要恢复焦点时（从详情页返回）设置 hasTVPreferredFocus
    const shouldRestoreFocus = deviceType === 'tv' && contentFocusEnabled && index === lastDetailCardIndex && restoreCardFocus;
    
    return (
      <VideoCard
        key={item.id}
        id={item.id}
        source={item.source}
        title={item.title}
        poster={item.poster}
        year={item.year}
        rate={item.rate}
        progress={item.progress}
        playTime={item.play_time}
        episodeIndex={item.episodeIndex}
        sourceName={item.sourceName}
        totalEpisodes={item.totalEpisodes}
        api={api}
        onRecordDeleted={fetchInitialData}
        onFocus={() => {
          // 只在首次进入内容区时切换焦点区域
          if (tvFocusRegion !== 'content') {
            setTVFocusRegion('content');
          }
          // 记录进入详情页前的卡片焦点位置
          lastDetailCardIndexRef.current = index;
        }}
        hasTVPreferredFocus={shouldRestoreFocus}
      />
    );
  }, [deviceType, contentFocusEnabled, lastDetailCardIndex, restoreCardFocus, tvFocusRegion, api, fetchInitialData]);

  const renderFooter = useMemo(() => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
  }, [loadingMore]);

  // 检查是否需要显示API配置提示
  const shouldShowApiConfig = apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags;

  // TV端和平板端的顶部导航
  const renderHeader = useCallback(() => {
    if (deviceType === "mobile") {
      return null;
    }

    return (
      <View style={dynamicStyles.headerContainer}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ThemedText style={dynamicStyles.headerTitle}>首页</ThemedText>
          <Pressable android_ripple={Platform.isTV || deviceType !== 'tv'? { color: 'transparent' } : { color: Colors.dark.link }} style={{ marginLeft: 20 }} onPress={() => router.push("/live")}>
            {({ focused }) => (
              <ThemedText style={[dynamicStyles.headerTitle, { color: focused ? "white" : "grey" }]}>直播</ThemedText>
            )}
          </Pressable>
        </View>
        <View style={dynamicStyles.rightHeaderButtons}>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push("/favorites")} variant="ghost">
            <Heart color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          <StyledButton
            style={dynamicStyles.iconButton}
            onPress={() => router.push({ pathname: "/search" })}
            variant="ghost"
          >
            <Search color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push("/settings")} variant="ghost">
            <Settings color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          {isLoggedIn && (
            <StyledButton style={dynamicStyles.iconButton} onPress={logout} variant="ghost">
              <LogOut color={colorScheme === "dark" ? "white" : "black"} size={24} />
            </StyledButton>
          )}
        </View>
      </View>
    );
  }, [deviceType, isLoggedIn, logout, router, dynamicStyles, colorScheme]);

  const tvSidebarContent = (
    <FlatList
      data={categories}
      renderItem={renderTVCategoryItem}
      keyExtractor={(item) => item.title}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={dynamicStyles.tvSidebarList}
    />
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {/* 状态栏 */}
      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}

      {/* 顶部导航 */}
      {renderHeader()}

      {/* 分类选择器 */}
      <View style={dynamicStyles.categoryContainer}>
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.title}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.categoryListContent}
        />
      </View>

      {/* 子分类标签 */}
      {selectedCategory && selectedCategory.tags && (
        <View style={dynamicStyles.categoryContainer}>
          <FlatList
            data={selectedCategory.tags}
            renderItem={({ item, index }) => {
              const isSelected = selectedTag === item;
              return (
                <StyledButton
                  focusable={deviceType !== 'tv' || sidebarFocusEnabled}
                  hasTVPreferredFocus={contentFocusEnabled && index === 0}
                  text={item}
                  onPress={() => handleTagSelect(item)}
                  onFocus={() => setTVFocusRegion('content')}
                  isSelected={isSelected}
                  style={dynamicStyles.categoryButton}
                  textStyle={dynamicStyles.categoryText}
                  variant="ghost"
                />
              );
            }}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dynamicStyles.categoryListContent}
          />
        </View>
      )}

      {/* 内容网格 */}
      {shouldShowApiConfig ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {getApiConfigErrorMessage(apiConfigStatus)}
          </ThemedText>
        </View>
      ) : apiConfigStatus.isValidating ? (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            正在验证服务器配置...
          </ThemedText>
        </View>
      ) : apiConfigStatus.error && !apiConfigStatus.isValid ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {apiConfigStatus.error}
          </ThemedText>
        </View>
      ) : loading ? (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing }}>
            {error}
          </ThemedText>
        </View>
      ) : (
        <Animated.View style={[dynamicStyles.contentContainer, { opacity: fadeAnim }]}>
          <CustomScrollView
            data={contentData}
            renderItem={renderContentItem}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            onEndReached={loadMoreData}
            loadMoreThreshold={LOAD_MORE_THRESHOLD}
            emptyMessage={selectedCategory?.tags ? "请选择一个子分类" : "该分类下暂无内容"}
            ListFooterComponent={renderFooter}
          />
        </Animated.View>
      )}
    </ThemedView>
  );

  if (deviceType === "tv") {
    return (
      <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
        <TVSidebarNavigator sidebarContent={tvSidebarContent}>
          {renderHeader()}
          {shouldShowApiConfig ? (
            <View style={commonStyles.center}>
              <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
                {getApiConfigErrorMessage(apiConfigStatus)}
              </ThemedText>
            </View>
          ) : apiConfigStatus.isValidating ? (
            <View style={commonStyles.center}>
              <ActivityIndicator size="large" />
              <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
                正在验证服务器配置...
              </ThemedText>
            </View>
          ) : apiConfigStatus.error && !apiConfigStatus.isValid ? (
            <View style={commonStyles.center}>
              <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
                {apiConfigStatus.error}
              </ThemedText>
            </View>
          ) : loading ? (
            <View style={commonStyles.center}>
              <ActivityIndicator size="large" />
            </View>
          ) : error ? (
            <View style={commonStyles.center}>
              <ThemedText type="subtitle" style={{ padding: spacing }}>
                {error}
              </ThemedText>
            </View>
          ) : (
            <Animated.View style={[dynamicStyles.contentContainer, { opacity: fadeAnim }]}>
              <CustomScrollView
                ref={customScrollRef}
                data={contentData}
                renderItem={renderContentItem}
                loading={loading}
                loadingMore={loadingMore}
                error={error}
                onEndReached={loadMoreData}
                loadMoreThreshold={LOAD_MORE_THRESHOLD}
                emptyMessage={selectedCategory?.tags ? "请选择一个子分类" : "该分类下暂无内容"}
                ListFooterComponent={renderFooter}
              />
            </Animated.View>
          )}
        </TVSidebarNavigator>
      </ThemedView>
    );
  }

  return <ResponsiveNavigation>{content}</ResponsiveNavigation>;
}
