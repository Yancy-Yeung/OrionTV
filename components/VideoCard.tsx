import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { API } from '@/services/api';

// 导入不同平台的VideoCard组件
import VideoCardMobile from './VideoCard.mobile';
import VideoCardTablet from './VideoCard.tablet';
import VideoCardTV from './VideoCard.tv';

interface VideoCardProps extends React.ComponentProps<typeof TouchableOpacity> {
  id: string;
  source: string;
  title: string;
  poster: string;
  year?: string;
  rate?: string;
  sourceName?: string;
  progress?: number;
  playTime?: number;
  episodeIndex?: number;
  totalEpisodes?: number;
  onFocus?: () => void;
  onRecordDeleted?: () => void;
  api: API;
}

/**
 * 响应式VideoCard组件
 * 根据设备类型自动选择合适的VideoCard实现
 * 使用 memo 避免在列表滚动时不必要的重渲染
 */
const VideoCard = React.memo(React.forwardRef<any, VideoCardProps>((props, ref) => {
  const { deviceType } = useResponsiveLayout();

  switch (deviceType) {
    case 'mobile':
      return <VideoCardMobile {...props} ref={ref} />;
    
    case 'tablet':
      return <VideoCardTablet {...props} ref={ref} />;
    
    case 'tv':
    default:
      return <VideoCardTV {...props} ref={ref} />;
  }
}), (prev, next) => {
  // 浅比较影响渲染的 props
  // 注意：必须包含 hasTVPreferredFocus（焦点恢复关键）、数据字段和进度字段
  // 回调函数（onFocus/onRecordDeleted）和 api 是稳定引用或无需触发重渲染的，不参与比较
  return (
    prev.id === next.id &&
    prev.source === next.source &&
    prev.title === next.title &&
    prev.poster === next.poster &&
    prev.year === next.year &&
    prev.rate === next.rate &&
    prev.sourceName === next.sourceName &&
    prev.progress === next.progress &&
    prev.playTime === next.playTime &&
    prev.episodeIndex === next.episodeIndex &&
    prev.totalEpisodes === next.totalEpisodes &&
    prev.hasTVPreferredFocus === next.hasTVPreferredFocus
  );
});

VideoCard.displayName = 'VideoCard';

export default VideoCard;