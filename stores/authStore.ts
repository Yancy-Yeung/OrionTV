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
  checkLoginStatus: (apiBaseUrl?: string, skipAutoLogin?: boolean) => Promise<void>;
  logout: () => Promise<void>;

  // Internal bookkeeping flags.
  _isCheckingLogin?: boolean;   // guards against concurrent checkLoginStatus calls
  _manualLogout?: boolean;      // set by logout(); suppresses silent auto-login until next app launch or a new manual login
}

const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  isLoginModalVisible: false,
  _isCheckingLogin: false, // internal flag to prevent concurrent checkLoginStatus calls
  _manualLogout: false, // set by logout(); suppresses silent auto-login until next app launch or a new manual login
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
        // so we should NOT attempt silent auto-login.
        // _manualLogout=true means the user clicked logout: suppress silent
        // auto-login (saved-credential re-login and guest fallback) until the
        // next app launch or a new manual login.
        if (!skipAutoLogin && !useAuthStore.getState()._manualLogout) {
          // Silent re-login: saved credentials first, then guest fallback.
          const relogged = await api.trySilentReLogin();
          set({ isLoggedIn: relogged, isLoginModalVisible: !relogged });
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
    // Suppress silent auto-login immediately so a concurrent checkLoginStatus
    // cannot re-login (saved credentials or guest) while logout is in flight.
    set({ _manualLogout: true });
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
