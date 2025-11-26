import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/services/api";
import { useSettingsStore } from "./settingsStore";
import { LoginCredentialsManager } from "@/services/storage";
import Toast from "react-native-toast-message";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("AuthStore");

interface AuthState {
  isLoggedIn: boolean;
  isLoginModalVisible: boolean;
  showLoginModal: () => void;
  hideLoginModal: () => void;
  checkLoginStatus: (apiBaseUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  isLoginModalVisible: false,
  showLoginModal: () => set({ isLoginModalVisible: true }),
  hideLoginModal: () => set({ isLoginModalVisible: false }),
  checkLoginStatus: async (apiBaseUrl?: string) => {
    if (!apiBaseUrl) {
      set({ isLoggedIn: false, isLoginModalVisible: false });
      return;
    }
    try {
      // Wait for server config to be loaded if it's currently loading
      let settingsState = useSettingsStore.getState();
      let serverConfig = settingsState.serverConfig;

      // If server config is not loaded and not currently loading, try to fetch it
      if (!serverConfig && !settingsState.isLoadingServerConfig) {
        await useSettingsStore.getState().fetchServerConfig();
        settingsState = useSettingsStore.getState();
        serverConfig = settingsState.serverConfig;
      }

      // If server config is loading, wait a bit for it to complete
      if (settingsState.isLoadingServerConfig) {
        // Wait up to 3 seconds for server config to load
        const maxWaitTime = 3000;
        const checkInterval = 100;
        let waitTime = 0;

        while (waitTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
          const currentState = useSettingsStore.getState();
          if (!currentState.isLoadingServerConfig) {
            serverConfig = currentState.serverConfig;
            break;
          }
        }
      }

      if (!serverConfig?.StorageType) {
        // Only show error if we're not loading and have tried to fetch the config
        if (!settingsState.isLoadingServerConfig) {
          Toast.show({ type: "error", text1: "请检查网络或者服务器地址是否可用" });
        }
        return;
      }

      const authToken = await AsyncStorage.getItem("authCookies");
      if (!authToken) {
        if (serverConfig && serverConfig.StorageType === "localstorage") {
          const loginResult = await api.login().catch(() => {
            set({ isLoggedIn: false, isLoginModalVisible: true });
          });
          if (loginResult && loginResult.ok) {
            set({ isLoggedIn: true });
          }
        } else {
          set({ isLoggedIn: false, isLoginModalVisible: true });
        }
      } else {
        // 如果有 cookies，尝试验证登录状态
        try {
          // 这里可以添加一个简单的验证请求，比如获取用户信息或检查 session
          // 暂时通过一个简单的请求来验证 cookies 是否有效
          await api.getServerConfig(); // 假设这个请求需要认证
          set({ isLoggedIn: true, isLoginModalVisible: false });
        } catch (error) {
          // 如果验证失败，尝试使用保存的凭证重新登录
          const savedCredentials = await LoginCredentialsManager.get();
          if (savedCredentials) {
            try {
              const loginResult = await api.login(savedCredentials.username, savedCredentials.password);
              if (loginResult && loginResult.ok) {
                // 重新验证登录状态
                await api.getServerConfig();
                set({ isLoggedIn: true, isLoginModalVisible: false });
                return;
              }
            } catch (loginError) {
              logger.error("Failed to auto re-login:", loginError);
            }
          }
          // 如果重新登录失败，清空无效 cookies 并显示登录模态框
          await AsyncStorage.removeItem("authCookies");
          set({ isLoggedIn: false, isLoginModalVisible: true });
        }
      }
    } catch (error) {
      logger.error("Failed to check login status:", error);
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        set({ isLoggedIn: false, isLoginModalVisible: true });
      } else {
        set({ isLoggedIn: false });
      }
    }
  },
  logout: async () => {
    try {
      await api.logout();
      set({ isLoggedIn: false, isLoginModalVisible: true });
    } catch (error) {
      logger.error("Failed to logout:", error);
    }
  },
}));

export default useAuthStore;
