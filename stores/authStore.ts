import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/services/api";
import { useSettingsStore } from "./settingsStore";
import Toast from "react-native-toast-message";
import Logger from "@/utils/Logger";
import { LoginCredentialsManager } from "@/services/storage";

const logger = Logger.withTag('AuthStore');

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
  _isCheckingLogin: false, // internal flag to prevent concurrent checkLoginStatus calls
  showLoginModal: () => set({ isLoginModalVisible: true }),
  hideLoginModal: () => set({ isLoginModalVisible: false }),
  checkLoginStatus: async (apiBaseUrl?: string, skipAutoLogin: boolean = false) => {
    // Prevent concurrent calls
    const currentState = useAuthStore.getState();
    if (currentState._isCheckingLogin) {
      logger.info('checkLoginStatus already in progress, skipping');
      return;
    }
    set({ _isCheckingLogin: true });

    if (!apiBaseUrl) {
      set({ isLoggedIn: false, isLoginModalVisible: false, _isCheckingLogin: false });
      return;
    }
    try {
      // Wait for server config to be loaded if it's currently loading
      const settingsState = useSettingsStore.getState();
      let serverConfig = settingsState.serverConfig;

      // If server config is loading, wait a bit for it to complete
      if (settingsState.isLoadingServerConfig) {
        // Wait up to 3 seconds for server config to load
        const maxWaitTime = 3000;
        const checkInterval = 100;
        let waitTime = 0;

        while (waitTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
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

      const authToken = await AsyncStorage.getItem('authCookies');
      if (!authToken) {
        // skipAutoLogin=true means this is called after a manual login attempt,
        // so we should NOT attempt silent auto-login
        if (!skipAutoLogin) {
          // Try to auto re-login with saved credentials
          const savedCredentials = await LoginCredentialsManager.get();
          if (savedCredentials) {
            try {
              const loginResult = await api.reLogin(savedCredentials.username, savedCredentials.password);
              if (loginResult && loginResult.ok) {
                set({ isLoggedIn: true, isLoginModalVisible: false });
              } else {
                // Re-login failed, clear saved credentials and show login modal
                await LoginCredentialsManager.clear();
                set({ isLoggedIn: false, isLoginModalVisible: true });
              }
            } catch (error) {
              logger.error("Auto re-login failed:", error);
              await LoginCredentialsManager.clear();
              set({ isLoggedIn: false, isLoginModalVisible: true });
            }
          } else {
            // No saved credentials, show login modal
            set({ isLoggedIn: false, isLoginModalVisible: true });
          }
        } else {
          set({ isLoggedIn: false, isLoginModalVisible: true });
        }
      } else {
        set({ isLoggedIn: true, isLoginModalVisible: false });
      }
    } catch (error) {
      logger.error("Failed to check login status:", error);
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        set({ isLoggedIn: false, isLoginModalVisible: true });
      } else {
        set({ isLoggedIn: false });
      }
    } finally {
      set({ _isCheckingLogin: false });
    }
  },
  logout: async () => {
    try {
      await api.logout();
      // Clear saved credentials on manual logout
      await LoginCredentialsManager.clear();
      set({ isLoggedIn: false, isLoginModalVisible: true });
    } catch (error) {
      logger.error("Failed to logout:", error);
    }
  },
}));

export default useAuthStore;
