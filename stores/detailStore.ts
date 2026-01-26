import { create } from "zustand";
import { SearchResult, api } from "@/services/api";
import { getResolutionFromM3U8 } from "@/services/m3u8";
import { useSettingsStore } from "@/stores/settingsStore";
import { FavoriteManager } from "@/services/storage";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("DetailStore");

// 计算视频源的综合评分（基于测速信息）
const calculateVideoScore = (videoInfo: { quality: string; loadSpeed: string; pingTime: number }): number => {
  let score = 0;

  // 分辨率评分 (40% 权重)
  const qualityScore = (() => {
    switch (videoInfo.quality) {
      case "4K":
        return 100;
      case "2K":
        return 85;
      case "1080p":
        return 75;
      case "720p":
        return 60;
      case "480p":
        return 40;
      case "SD":
        return 20;
      default:
        return 30; // 未知质量给默认分
    }
  })();
  score += qualityScore * 0.4;

  // 加载速度评分 (40% 权重)
  const speedScore = (() => {
    const speedStr = videoInfo.loadSpeed;
    if (speedStr === "未知" || speedStr === "测量中...") return 30;

    const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
    if (!match) return 30;

    const value = parseFloat(match[1]);
    const unit = match[2];
    const speedKBps = unit === "MB/s" ? value * 1024 : value;

    // 基于速度线性映射，最高100分
    // 假设 5MB/s 为满分基准
    const maxSpeed = 5120; // 5MB/s
    const speedRatio = Math.min(speedKBps / maxSpeed, 1);
    return speedRatio * 100;
  })();
  score += speedScore * 0.4;

  // 网络延迟评分 (20% 权重)
  const pingScore = (() => {
    const ping = videoInfo.pingTime;
    if (ping <= 0) return 0;

    // 延迟越低分数越高
    // 假设 50ms 为满分，1000ms 为0分
    const minPing = 50;
    const maxPing = 1000;

    if (ping <= minPing) return 100;
    if (ping >= maxPing) return 0;

    return ((maxPing - ping) / (maxPing - minPing)) * 100;
  })();
  score += pingScore * 0.2;

  return Math.round(score * 100) / 100; // 保留两位小数
};

export type SearchResultWithResolution = SearchResult & {
  resolution?: string | null;
  videoInfo?: {
    quality: string;
    loadSpeed: string;
    pingTime: number;
  };
};

interface DetailState {
  q: string | null;
  searchResults: SearchResultWithResolution[];
  sources: {
    source: string;
    source_name: string;
    resolution: string | null | undefined;
    videoInfo?: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    };
  }[];
  detail: SearchResultWithResolution | null;
  loading: boolean;
  error: string | null;
  allSourcesLoaded: boolean;
  controller: AbortController | null;
  isFavorited: boolean;
  failedSources: Set<string>; // 记录失败的source列表

  init: (q: string, preferredSource?: string, id?: string) => Promise<void>;
  setDetail: (detail: SearchResultWithResolution) => Promise<void>;
  abort: () => void;
  toggleFavorite: () => Promise<void>;
  markSourceAsFailed: (source: string, reason: string) => void;
  getNextAvailableSource: (currentSource: string, episodeIndex: number) => SearchResultWithResolution | null;
}

const useDetailStore = create<DetailState>((set, get) => ({
  q: null,
  searchResults: [],
  sources: [],
  detail: null,
  loading: true,
  error: null,
  allSourcesLoaded: false,
  controller: null,
  isFavorited: false,
  failedSources: new Set(),

  init: async (q, preferredSource, id) => {
    const perfStart = performance.now();
    logger.info(`[PERF] DetailStore.init START - q: ${q}, preferredSource: ${preferredSource}, id: ${id}`);

    const { controller: oldController } = get();
    if (oldController) {
      oldController.abort();
    }
    const newController = new AbortController();
    const signal = newController.signal;

    set({
      q,
      loading: true,
      searchResults: [],
      detail: null,
      error: null,
      allSourcesLoaded: false,
      controller: newController,
    });

    const { videoSource } = useSettingsStore.getState();

    const processAndSetResults = async (results: SearchResult[], merge = false) => {
      const resolutionStart = performance.now();
      logger.info(`[PERF] Processing results START - processing ${results.length} sources`);

      const resultsWithResolution = await Promise.all(
        results.map(async (searchResult) => {
          // 如果结果已经包含 videoInfo（来自 LunaTV API），直接使用
          if (searchResult.videoInfo) {
            logger.info(
              `[INFO] Using pre-computed videoInfo for ${searchResult.source_name}: ${searchResult.videoInfo.quality}, ${searchResult.videoInfo.loadSpeed}, ${searchResult.videoInfo.pingTime}ms`,
            );
            return {
              ...searchResult,
              resolution: searchResult.videoInfo.quality, // 使用 videoInfo 中的质量作为分辨率
            };
          }

          // 否则进行本地分辨率检测（向后兼容）
          let resolution;
          const m3u8Start = performance.now();
          try {
            if (searchResult.episodes && searchResult.episodes.length > 0) {
              resolution = await getResolutionFromM3U8(searchResult.episodes[0], signal);
            }
          } catch (e) {
            if ((e as Error).name !== "AbortError") {
              logger.info(`Failed to get resolution for ${searchResult.source_name}`, e);
            }
          }
          const m3u8End = performance.now();
          logger.info(
            `[PERF] M3U8 resolution for ${searchResult.source_name}: ${(m3u8End - m3u8Start).toFixed(2)}ms (${resolution || "failed"})`,
          );
          return { ...searchResult, resolution };
        }),
      );

      const resolutionEnd = performance.now();
      logger.info(`[PERF] Processing results COMPLETE - took ${(resolutionEnd - resolutionStart).toFixed(2)}ms`);

      if (signal.aborted) return;

      set((state) => {
        const existingSources = new Set(state.searchResults.map((r) => r.source));
        const newResults = resultsWithResolution.filter((r) => !existingSources.has(r.source));
        const finalResults = merge ? [...state.searchResults, ...newResults] : resultsWithResolution;

        return {
          searchResults: finalResults,
          sources: finalResults.map((r) => ({
            source: r.source,
            source_name: r.source_name,
            resolution: r.resolution,
            videoInfo: r.videoInfo, // 包含完整的测速信息
          })),
          detail: state.detail ?? finalResults[0] ?? null,
        };
      });
    };

    try {
      // Optimization for favorite navigation
      if (preferredSource && id) {
        const searchPreferredStart = performance.now();
        logger.info(`[PERF] API searchVideo (preferred) START - source: ${preferredSource}, query: "${q}"`);

        let preferredResult: SearchResult[] = [];
        let preferredSearchError: any = null;

        try {
          const response = await api.searchVideo(q, preferredSource, signal);
          preferredResult = response.results;
        } catch (error) {
          preferredSearchError = error;
          logger.error(`[ERROR] API searchVideo (preferred) FAILED - source: ${preferredSource}, error:`, error);
        }

        const searchPreferredEnd = performance.now();
        logger.info(
          `[PERF] API searchVideo (preferred) END - took ${(searchPreferredEnd - searchPreferredStart).toFixed(2)}ms, results: ${preferredResult.length}, error: ${!!preferredSearchError}`,
        );

        if (signal.aborted) return;

        // 检查preferred source结果
        if (preferredResult.length > 0) {
          logger.info(
            `[SUCCESS] Preferred source "${preferredSource}" found ${preferredResult.length} results for "${q}"`,
          );
          await processAndSetResults(preferredResult, false);
          set({ loading: false });
        } else {
          // 降级策略：preferred source失败时立即尝试所有源
          if (preferredSearchError) {
            logger.warn(
              `[FALLBACK] Preferred source "${preferredSource}" failed with error, trying all sources immediately`,
            );
          } else {
            logger.warn(
              `[FALLBACK] Preferred source "${preferredSource}" returned 0 results for "${q}", trying all sources immediately`,
            );
          }

          // 立即尝试所有源，不再依赖后台搜索
          const fallbackStart = performance.now();
          logger.info(`[PERF] FALLBACK search (all sources) START - query: "${q}"`);

          try {
            const { results: allResults } = await api.searchVideos(q);
            const fallbackEnd = performance.now();
            logger.info(
              `[PERF] FALLBACK search END - took ${(fallbackEnd - fallbackStart).toFixed(2)}ms, total results: ${allResults.length}`,
            );

            const filteredResults = allResults.filter((item) => item.title === q);
            logger.info(`[FALLBACK] Filtered results: ${filteredResults.length} matches for "${q}"`);

            if (filteredResults.length > 0) {
              logger.info(`[SUCCESS] FALLBACK search found results, proceeding with ${filteredResults[0].source_name}`);
              await processAndSetResults(filteredResults, false);
              set({ loading: false });
            } else {
              logger.error(`[ERROR] FALLBACK search found no matching results for "${q}"`);
              set({
                error: `未找到 "${q}" 的播放源，请检查标题或稍后重试`,
                loading: false,
              });
            }
          } catch (fallbackError) {
            logger.error(`[ERROR] FALLBACK search FAILED:`, fallbackError);
            set({
              error: `搜索失败：${fallbackError instanceof Error ? fallbackError.message : "网络错误，请稍后重试"}`,
              loading: false,
            });
          }
        }

        // 后台搜索（如果preferred source成功的话）
        if (preferredResult.length > 0) {
          const searchAllStart = performance.now();
          logger.info(`[PERF] API searchVideos (background) START`);

          try {
            const { results: allResults } = await api.searchVideos(q);

            const searchAllEnd = performance.now();
            logger.info(
              `[PERF] API searchVideos (background) END - took ${(searchAllEnd - searchAllStart).toFixed(2)}ms, results: ${allResults.length}`,
            );

            if (signal.aborted) return;
            await processAndSetResults(
              allResults.filter((item) => item.title === q),
              true,
            );
          } catch (backgroundError) {
            logger.warn(`[WARN] Background search failed, but preferred source already succeeded:`, backgroundError);
          }
        }
      } else {
        // Standard navigation: fetch resources, then fetch details one by one
        const resourcesStart = performance.now();
        logger.info(`[PERF] API getResources START - query: "${q}"`);

        try {
          const allResources = await api.getResources(signal);

          const resourcesEnd = performance.now();
          logger.info(
            `[PERF] API getResources END - took ${(resourcesEnd - resourcesStart).toFixed(2)}ms, resources: ${allResources.length}`,
          );

          const enabledResources = videoSource.enabledAll
            ? allResources
            : allResources.filter((r) => videoSource.sources[r.key]);

          logger.info(`[PERF] Enabled resources: ${enabledResources.length}/${allResources.length}`);

          if (enabledResources.length === 0) {
            logger.error(`[ERROR] No enabled resources available for search`);
            set({
              error: "没有可用的视频源，请检查设置或联系管理员",
              loading: false,
            });
            return;
          }

          let firstResultFound = false;
          let totalResults = 0;
          const searchPromises = enabledResources.map(async (resource) => {
            try {
              const searchStart = performance.now();
              const { results } = await api.searchVideo(q, resource.key, signal);
              const searchEnd = performance.now();
              logger.info(
                `[PERF] API searchVideo (${resource.name}) took ${(searchEnd - searchStart).toFixed(2)}ms, results: ${results.length}`,
              );

              if (results.length > 0) {
                totalResults += results.length;
                logger.info(`[SUCCESS] Source "${resource.name}" found ${results.length} results for "${q}"`);
                await processAndSetResults(results, true);
                if (!firstResultFound) {
                  set({ loading: false }); // Stop loading indicator on first result
                  firstResultFound = true;
                  logger.info(`[SUCCESS] First result found from "${resource.name}", stopping loading indicator`);
                }
              } else {
                logger.warn(`[WARN] Source "${resource.name}" returned 0 results for "${q}"`);
              }
            } catch (error) {
              logger.error(`[ERROR] Failed to fetch from ${resource.name}:`, error);
            }
          });

          await Promise.all(searchPromises);

          // 检查是否找到任何结果
          if (totalResults === 0) {
            logger.error(`[ERROR] All sources returned 0 results for "${q}"`);
            set({
              error: `未找到 "${q}" 的播放源，请尝试其他关键词或稍后重试`,
              loading: false,
            });
          } else {
            logger.info(`[SUCCESS] Standard search completed, total results: ${totalResults}`);
          }
        } catch (resourceError) {
          logger.error(`[ERROR] Failed to get resources:`, resourceError);
          set({
            error: `获取视频源失败：${resourceError instanceof Error ? resourceError.message : "网络错误，请稍后重试"}`,
            loading: false,
          });
          return;
        }
      }

      const favoriteCheckStart = performance.now();
      const finalState = get();

      // 最终检查：如果所有搜索都完成但仍然没有结果
      if (finalState.searchResults.length === 0 && !finalState.error) {
        logger.error(`[ERROR] All search attempts completed but no results found for "${q}"`);
        set({ error: `未找到 "${q}" 的播放源，请检查标题拼写或稍后重试` });
      } else if (finalState.searchResults.length > 0) {
        logger.info(
          `[SUCCESS] DetailStore.init completed successfully with ${finalState.searchResults.length} sources`,
        );
      }

      if (finalState.detail) {
        const { source, id } = finalState.detail;
        logger.info(`[INFO] Checking favorite status for source: ${source}, id: ${id}`);
        try {
          const isFavorited = await FavoriteManager.isFavorited(source, id.toString());
          set({ isFavorited });
          logger.info(`[INFO] Favorite status: ${isFavorited}`);
        } catch (favoriteError) {
          logger.warn(`[WARN] Failed to check favorite status:`, favoriteError);
        }
      } else {
        logger.warn(`[WARN] No detail found after all search attempts for "${q}"`);
      }

      const favoriteCheckEnd = performance.now();
      logger.info(`[PERF] Favorite check took ${(favoriteCheckEnd - favoriteCheckStart).toFixed(2)}ms`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        logger.error(`[ERROR] DetailStore.init caught unexpected error:`, e);
        const errorMessage = e instanceof Error ? e.message : "获取数据失败";
        set({ error: `搜索失败：${errorMessage}` });
      } else {
        logger.info(`[INFO] DetailStore.init aborted by user`);
      }
    } finally {
      if (!signal.aborted) {
        set({ loading: false, allSourcesLoaded: true });
        logger.info(`[INFO] DetailStore.init cleanup completed`);
      }

      const perfEnd = performance.now();
      logger.info(`[PERF] DetailStore.init COMPLETE - total time: ${(perfEnd - perfStart).toFixed(2)}ms`);
    }
  },

  setDetail: async (detail) => {
    set({ detail });
    const { source, id } = detail;
    const isFavorited = await FavoriteManager.isFavorited(source, id.toString());
    set({ isFavorited });
  },

  abort: () => {
    get().controller?.abort();
  },

  toggleFavorite: async () => {
    const { detail } = get();
    if (!detail) return;

    const { source, id, title, poster, source_name, episodes, year } = detail;
    const favoriteItem = {
      cover: poster,
      title,
      poster,
      source_name,
      total_episodes: episodes.length,
      search_title: get().q!,
      year: year || "",
    };

    const newIsFavorited = await FavoriteManager.toggle(source, id.toString(), favoriteItem);
    set({ isFavorited: newIsFavorited });
  },

  markSourceAsFailed: (source: string, reason: string) => {
    const { failedSources } = get();
    const newFailedSources = new Set(failedSources);
    newFailedSources.add(source);

    logger.warn(`[SOURCE_FAILED] Marking source "${source}" as failed due to: ${reason}`);
    logger.info(`[SOURCE_FAILED] Total failed sources: ${newFailedSources.size}`);

    set({ failedSources: newFailedSources });
  },

  getNextAvailableSource: (currentSource: string, episodeIndex: number) => {
    const { searchResults, failedSources } = get();

    logger.info(`[SOURCE_SELECTION] Looking for alternative to "${currentSource}" for episode ${episodeIndex + 1}`);
    logger.info(`[SOURCE_SELECTION] Failed sources: [${Array.from(failedSources).join(", ")}]`);

    // 过滤掉当前source和已失败的sources
    const availableSources = searchResults.filter(
      (result) =>
        result.source !== currentSource &&
        !failedSources.has(result.source) &&
        result.episodes &&
        result.episodes.length > episodeIndex,
    );

    logger.info(`[SOURCE_SELECTION] Available sources: ${availableSources.length}`);
    availableSources.forEach((source) => {
      logger.info(
        `[SOURCE_SELECTION] - ${source.source} (${source.source_name}): ${source.episodes?.length || 0} episodes`,
      );
    });

    if (availableSources.length === 0) {
      logger.error(`[SOURCE_SELECTION] No available sources for episode ${episodeIndex + 1}`);
      return null;
    }

    // 智能选择最佳可用源（基于测速信息）
    const sortedSources = availableSources.sort((a, b) => {
      // 如果有 videoInfo，使用综合评分算法
      if (a.videoInfo && b.videoInfo) {
        const scoreA = calculateVideoScore(a.videoInfo);
        const scoreB = calculateVideoScore(b.videoInfo);
        return scoreB - scoreA; // 降序排列，最高分优先
      }

      // 如果没有 videoInfo，回退到分辨率优先级
      const aResolution = a.resolution || "";
      const bResolution = b.resolution || "";

      const resolutionPriority = (res: string) => {
        if (res.includes("1080")) return 4;
        if (res.includes("720")) return 3;
        if (res.includes("480")) return 2;
        if (res.includes("360")) return 1;
        return 0;
      };

      return resolutionPriority(bResolution) - resolutionPriority(aResolution);
    });

    const selectedSource = sortedSources[0];
    const selectionReason = selectedSource.videoInfo
      ? `videoInfo: ${selectedSource.videoInfo.quality}, ${selectedSource.videoInfo.loadSpeed}, ${selectedSource.videoInfo.pingTime}ms`
      : `resolution: ${selectedSource.resolution || "unknown"}`;
    logger.info(
      `[SOURCE_SELECTION] Selected fallback source: ${selectedSource.source} (${selectedSource.source_name}) with ${selectionReason}`,
    );

    return selectedSource;
  },
}));

export const sourcesSelector = (state: DetailState) => state.sources;
export default useDetailStore;
export const episodesSelectorBySource = (source: string) => (state: DetailState) =>
  state.searchResults.find((r) => r.source === source)?.episodes || [];
