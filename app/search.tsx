import React, { useState, useRef, useEffect, useMemo } from "react";
import { View, TextInput, StyleSheet, Alert, Keyboard, Pressable, BackHandler, ScrollView, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api, SearchResult } from "@/services/api";
import { Search, QrCode, Trash2 } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { RemoteControlModal } from "@/components/RemoteControlModal";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout, LayoutSidebarProvider } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from '@/utils/Logger';
import { SearchHistoryManager } from "@/services/storage";

const logger = Logger.withTag('SearchScreen');

interface HistoryTagButtonProps {
  item: string;
  onPress: () => void;
  hasPreferredFocus?: boolean;
  onFocus?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * 历史搜索标签按钮（TV 端支持遥控器焦点导航：光标高亮）
 * 不用 Animated.View 包裹，避免 transform scale 动画干扰 TV 原生焦点响应
 */
const HistoryTagButton = React.memo(
  React.forwardRef<View, HistoryTagButtonProps>(function HistoryTagButton(
    { item, onPress, hasPreferredFocus = false, onFocus, style, textStyle },
    ref
  ) {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <Pressable
        ref={ref}
        focusable
        hasTVPreferredFocus={hasPreferredFocus}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => setIsFocused(false)}
        onPress={onPress}
        style={[
          ...(Array.isArray(style) ? style : [style]),
          { borderWidth: 2, borderColor: "transparent" },
          isFocused && {
            backgroundColor: Colors.dark.link,
            borderColor: Colors.dark.background,
            shadowColor: Colors.dark.link,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 10,
            elevation: 5,
          },
        ]}
      >
        <ThemedText style={textStyle} darkColor={isFocused ? "white" : undefined} >{item}</ThemedText>
      </Pressable>
    );
  })
);

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const inputContainerRef = useRef<View>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // TV 端文本编辑模式：TextInput 持有焦点时可输入，按返回键退出编辑回到容器选中
  const [isEditingText, setIsEditingText] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  // Search history state
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  // TV 遥控器光标状态：输入框焦点高亮
  const [isInputCursorFocused, setIsInputCursorFocused] = useState(false);
  // 标记初始焦点已应用，避免历史列表更新后第一个标签再次抢占焦点
  const [initialFocusDone, setInitialFocusDone] = useState(false);
  // TV 手动初始焦点 refs（hasTVPreferredFocus 在动态挂载场景下不可靠，需要手动 focus 兜底）
  const firstTagRef = useRef<View>(null);
  const searchButtonRef = useRef<View>(null);
  const clearHistoryButtonRef = useRef<View>(null);

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;
  

  useEffect(() => {
    if (lastMessage && targetPage === 'search') {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      handleSearch(realMessage);
      clearMessage(); // Clear the message after processing
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage, targetPage]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setSearchHistory(await SearchHistoryManager.get());
      } catch (err) {
        logger.info("Failed to load search history:", err);
      } finally {
        setHistoryLoaded(true);
      }
    };
    loadHistory();
  }, []);

  // TV 端手动设置初始焦点：
  // hasTVPreferredFocus 在"历史异步加载后才挂载标签"的场景下不可靠（requestFocus 可能在布局完成前调用而静默失败），
  // 而且 TextInput 是强焦点候选，可能抢走初始焦点导致方向键被文本光标占用。
  // 这里在历史加载完成后，用 ref.focus() 把焦点明确落到第一个标签（有历史）或搜索按钮（无历史）。
  useEffect(() => {
    if (!historyLoaded || initialFocusDone) return;
    const timer = setTimeout(() => {
      if (searchHistory.length > 0 && firstTagRef.current) {
        firstTagRef.current.focus();
      } else if (searchButtonRef.current) {
        searchButtonRef.current.focus();
      }
      setInitialFocusDone(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [historyLoaded, searchHistory.length, initialFocusDone]);

  // TV 端文本编辑模式：按返回键退出编辑，焦点回到输入框容器（容器保持选中态，可继续方向键导航）
  useEffect(() => {
    if (!isEditingText) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      textInputRef.current?.blur();
      // 等 TextInput 失焦后再把焦点还给外层容器
      setTimeout(() => inputContainerRef.current?.focus(), 0);
      return true; // 拦截返回，不退出页面
    });
    return () => backHandler.remove();
  }, [isEditingText]);

  // useEffect(() => {
  //   // Focus the text input when the screen loads
  //   const timer = setTimeout(() => {
  //     textInputRef.current?.focus();
  //   }, 200);
  //   return () => clearTimeout(timer);
  // }, []);

  const handleSearch = async (searchText?: string) => {
    const term = typeof searchText === "string" ? searchText : keyword;

    if (!term.trim()) {
      Keyboard.dismiss();
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      await SearchHistoryManager.add(term);
      setSearchHistory(await SearchHistoryManager.get()); // refresh local list without duplicates/order issues
      const response = await api.searchVideos(term);
      if (response.results.length > 0) {
        setResults(response.results);
      } else {
        setError("没有找到相关内容");
      }
    } catch (err) {
      setError("搜索失败，请稍后重试。");
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // 一键清除全部历史查询记录（需二次确认）
  const handleClearHistory = () => {
    Alert.alert("清除历史记录", "确定要删除全部历史查询记录吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "清除",
        style: "destructive",
        onPress: async () => {
          try {
            await SearchHistoryManager.clear();
            setSearchHistory([]);
            // TV 端：焦点从被移除的按钮上消失，手动回到搜索按钮
            if (deviceType === 'tv') {
              setTimeout(() => searchButtonRef.current?.focus(), 0);
            }
          } catch (err) {
            logger.info("Failed to clear search history:", err);
          }
        },
      },
    ]);
  };

  const handleQrPress = () => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal('search');
  };

  const renderItem = ({ item }: { item: SearchResult; index: number }) => (
    <VideoCard
      id={item.id.toString()}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      sourceName={item.source_name}
      api={api}
    />
  );

  // 动态样式
  const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType, spacing), [deviceType, spacing]);

  const renderSearchContent = () => (
    <>
      <View style={dynamicStyles.searchContainer}>
        <Pressable
          ref={inputContainerRef}
          
          onFocus={() => setIsInputCursorFocused(true) }
          onBlur={() => setIsInputCursorFocused(false) }
          style={[
            dynamicStyles.inputContainer,
            {
              borderColor: isInputFocused
                ? Colors.dark.primary
                : isInputCursorFocused
                  ? Colors.dark.link
                  : "transparent",
            },
          ]}
          onPress={() => {            
            // 如需输入文字，可通过右侧 QR 按钮打开手机扫码输入，或连接蓝牙键盘
            textInputRef.current?.focus();            
          }}
        >
          <TextInput
            ref={textInputRef}
            style={dynamicStyles.input}
            placeholder="搜索电影、剧集..."
            placeholderTextColor="#888"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => handleSearch()}
            onFocus={() => {
              setIsInputFocused(true);
              setIsEditingText(true);
            }}
            onBlur={() => {
              setIsInputFocused(false);
              setIsEditingText(false);
            }}
            returnKeyType="search"
          />
        </Pressable>
        <StyledButton ref={searchButtonRef} style={dynamicStyles.searchButton} onPress={() => handleSearch()}>
          <Search size={deviceType === 'mobile' ? 20 : 24} color="white" />
        </StyledButton>
        {deviceType !== 'mobile' && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={deviceType === 'tv' ? 24 : 20} color="white" />
          </StyledButton>
        )}
        {/* 一键删除全部历史查询记录（有历史时才显示） */}
        {searchHistory.length > 0 && (
          <StyledButton
            ref={clearHistoryButtonRef}
            style={dynamicStyles.clearHistoryButton}
            onPress={handleClearHistory}
          >
            <Trash2 size={deviceType === 'mobile' ? 20 : 24} color="white" />
          </StyledButton>
        )}
      </View>

      <View style={dynamicStyles.historyContainer}>
        {searchHistory.map((item, index) => (
          <HistoryTagButton
            key={item}
            ref={index === 0 ? firstTagRef : undefined}
            item={item}
            hasPreferredFocus={historyLoaded && index === 0 && !initialFocusDone}
            onFocus={() => setInitialFocusDone(true)}
            onPress={() => handleSearch(item)}
            style={[
              dynamicStyles.historyButton,
              { marginRight: spacing },
            ]}
            textStyle={dynamicStyles.historyText}
          />
        ))}
      </View>

      {loading ? (
        <VideoLoadingAnimation showProgressBar={false} />
      ) : error ? (
        <View style={[commonStyles.center, { flex: 1 }]}>
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      ) : (
        <CustomScrollView
          data={results}
          renderItem={renderItem}
          loading={loading}
          error={error}
          emptyMessage="输入关键词开始搜索"
        />
      )}
      <RemoteControlModal />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderSearchContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return <LayoutSidebarProvider hasSidebar={false}>{content}</LayoutSidebarProvider>;
  }

  return (
    <LayoutSidebarProvider hasSidebar={false}>
      <ResponsiveNavigation>
        <ResponsiveHeader title="搜索" showBackButton />
        {content}
      </ResponsiveNavigation>
    </LayoutSidebarProvider>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === 'mobile';
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === 'tv' ? 50 : 0,
    },
    searchContainer: {
      flexDirection: "row",
      paddingHorizontal: spacing,
      marginBottom: spacing,
      alignItems: "center",
      paddingTop: isMobile ? spacing / 2 : 0,
    },
    inputContainer: {
      flex: 1,
      height: isMobile ? minTouchTarget : 50,
      backgroundColor: "#2c2c2e",
      borderRadius: isMobile ? 8 : 8,
      marginRight: spacing / 2,
      borderWidth: 2,
      borderColor: "transparent",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      paddingHorizontal: spacing,
      color: "white",
      fontSize: isMobile ? 16 : 18,
    },
    searchButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
      marginRight: deviceType !== 'mobile' ? spacing / 2 : 0,
    },
    qrButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
    },
    clearHistoryButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
      marginLeft: deviceType !== 'mobile' ? spacing / 2 : 0,
    },
    errorText: {
      color: "red",
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
    historyContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: spacing,
      marginBottom: spacing / 2,
    },
    historyButton: {
      backgroundColor: "#3a3a3c",
      paddingHorizontal: isMobile ? 10 : 14,
      paddingVertical: isMobile ? 6 : 8,
      borderRadius: isMobile ? 999 : 20,
      marginRight: spacing / 2,
      marginBottom: spacing / 2,
    },
    historyText: {
      color: "white",
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
  });
};
