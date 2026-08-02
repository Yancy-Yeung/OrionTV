/**
 * 速度测试结果接口
 */
export interface SpeedTestResult {
  responseTime: number; // 响应时间（毫秒）
  siteName: string; // 站点名称
  storageType: string; // 存储类型
}

/**
 * 测试 API 速度
 * @param apiBaseUrl API 地址
 * @returns Promise<SpeedTestResult> 测试结果
 */
export async function testApiSpeed(apiBaseUrl: string): Promise<SpeedTestResult> {
  if (!apiBaseUrl) {
    throw new Error("API 地址不能为空");
  }

  // 确保 URL 格式正确
  let url: string;
  try {
    url = apiBaseUrl.startsWith("http") ? apiBaseUrl : `https://${apiBaseUrl}`;
  } catch {
    throw new Error("API 地址格式不正确");
  }

  const startTime = performance.now();
  let responseTime = 0;
  let siteName = "未知";
  let storageType = "未知";

  try {
    // 使用 AbortController 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒超时

    const response = await fetch(`${url}/api/search/resources`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`);
    }

    // 解析响应数据获取站点信息
    const data = await response.json();

    // 如果返回的是数组，取第一个元素的名称
    if (Array.isArray(data) && data.length > 0) {
      siteName = data[0].name || data[0].site_name || "未知";
    } else if (data && data.siteName) {
      siteName = data.siteName;
    }

    // 尝试获取服务器配置信息
    try {
      const configResponse = await fetch(`${url}/api/server-config`, {
        method: "GET",
        signal: controller.signal,
      });
      if (configResponse.ok) {
        const configData = await configResponse.json();
        if (configData && configData.siteName) {
          siteName = configData.siteName;
        }
        if (configData && configData.storageType) {
          storageType = configData.storageType;
        }
      }
    } catch {
      // 服务器配置获取失败，使用默认值
    }

    responseTime = performance.now() - startTime;
  } catch (error) {
    responseTime = performance.now() - startTime;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时（10秒）");
    }

    throw error;
  }

  return {
    responseTime: Math.round(responseTime),
    siteName,
    storageType,
  };
}
