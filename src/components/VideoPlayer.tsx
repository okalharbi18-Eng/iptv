import { useRef, useEffect, useState, useCallback } from 'react';
import { Channel } from '@/lib/m3u-parser';
import Hls from 'hls.js';
import { Tv, Volume2, VolumeX, Maximize, ChevronUp, ChevronDown, List, LogOut, RefreshCw, Settings } from 'lucide-react';

interface VideoPlayerProps {
  channel: Channel | null;
  playbackMode: 'auto' | 'hls' | 'native';
  onToggleList: () => void;
  onNavigate: (dir: 'up' | 'down') => void;
  onSwitchSource: () => void;
  onExit: () => void;
  onToggleSettings: () => void;
  listVisible: boolean;
  settingsVisible: boolean;
}

export function VideoPlayer({ channel, playbackMode, onToggleList, onNavigate, onSwitchSource, onExit, onToggleSettings, listVisible, settingsVisible }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return;

    setPlaybackError(null);
    destroyHls();

    const url = channel.url;
    const isHls = url.includes('.m3u8') || url.includes('/live/') || url.includes('type=m3u_plus');

    const useHlsJs = playbackMode === 'hls' || (playbackMode === 'auto' && isHls && Hls.isSupported());
    const useNative = playbackMode === 'native' || (playbackMode === 'auto' && isHls && !Hls.isSupported());

    if (isHls && useHlsJs && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: localStorage.getItem('iptv_hls_use_worker') === '1',
        lowLatencyMode: localStorage.getItem('iptv_hls_low_latency') === '1',
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000,
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        startLevel: -1,
        abrEwmaDefaultEstimate: 500000,
        abrBandWidthUpFactor: 0.7,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setPlaybackError('Playback failed');
            hls.destroy();
          }
        }
      });

      hlsRef.current = hls;
    } else if (isHls && (useNative || video.canPlayType('application/vnd.apple.mpegurl'))) {
      video.src = url;
      video.load();
      video.play().catch(() => {});
    } else {
      video.src = url;
      video.load();
      video.play().catch(() => {});
    }

    setShowInfo(true);
    const infoTimer = setTimeout(() => setShowInfo(false), 3000);
    showControlsTemporarily();

    return () => {
      clearTimeout(infoTimer);
    };
  }, [channel, destroyHls, playbackMode, showControlsTemporarily]);

  useEffect(() => {
    return () => destroyHls();
  }, [destroyHls]);

  // Only handle video player keys when no overlay is open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle any keys when list or settings are open
      if (listVisible || settingsVisible) return;
      
      showControlsTemporarily();
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigate('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigate('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onToggleList();
      } else if (e.key === 'm') {
        setMuted(m => !m);
      } else if (e.key === 'f') {
        videoRef.current?.requestFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [listVisible, settingsVisible, onNavigate, onToggleList]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const handleMouseMove = () => {
    showControlsTemporarily();
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  return (
    <div
      className="relative w-full h-screen bg-background"
      onMouseMove={handleMouseMove}
      onClick={() => { if (!listVisible && !settingsVisible) showControlsTemporarily(); }}
    >
      {channel ? (
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-background"
          autoPlay
          playsInline
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
          <Tv className="w-16 h-16 mb-4 opacity-30" />
          <span className="text-lg">Select a channel to watch</span>
        </div>
      )}

      {playbackError && channel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
          <Tv className="w-12 h-12 text-destructive mb-3 opacity-60" />
          <div className="text-sm text-destructive font-medium">{playbackError}</div>
          <div className="text-xs text-muted-foreground mt-1">{channel.name}</div>
        </div>
      )}

      {showInfo && channel && (
        <div className="absolute top-6 left-6 glass-surface rounded-xl px-5 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            {channel.logo && (
              <img src={channel.logo} alt="" className="w-10 h-10 rounded-lg object-contain" />
            )}
            <div>
              <div className="text-sm font-bold text-foreground">{channel.name}</div>
              {channel.group && <div className="text-xs text-muted-foreground">{channel.group}</div>}
            </div>
          </div>
        </div>
      )}

      {showControls && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent pt-20 pb-6 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={onToggleList} className="p-2.5 rounded-xl glass-surface hover:bg-secondary transition-colors" title="Channel List (←)">
                <List className="w-5 h-5 text-foreground" />
              </button>
              <button onClick={() => onNavigate('up')} className="p-2.5 rounded-xl glass-surface hover:bg-secondary transition-colors" title="Previous Channel (↑)">
                <ChevronUp className="w-5 h-5 text-foreground" />
              </button>
              <button onClick={() => onNavigate('down')} className="p-2.5 rounded-xl glass-surface hover:bg-secondary transition-colors" title="Next Channel (↓)">
                <ChevronDown className="w-5 h-5 text-foreground" />
              </button>
            </div>

            {channel && (
              <div className="text-sm font-medium text-foreground">
                {channel.name}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button onClick={() => setMuted(m => !m)} className="p-2.5 rounded-xl glass-surface hover:bg-secondary transition-colors" title="Mute (M)">
                {muted ? <VolumeX className="w-5 h-5 text-foreground" /> : <Volume2 className="w-5 h-5 text-foreground" />}
              </button>
              <button onClick={() => videoRef.current?.requestFullscreen()} className="p-2.5 rounded-xl glass-surface hover:bg-secondary transition-colors" title="Fullscreen (F)">
                <Maximize className="w-5 h-5 text-foreground" />
              </button>
              <button onClick={onToggleSettings} className="p-2.5 rounded-xl glass-surface hover:bg-secondary transition-colors" title="Settings">
                <Settings className="w-5 h-5 text-foreground" />
              </button>
              <button onClick={onSwitchSource} className="p-2.5 rounded-xl glass-surface hover:bg-secondary transition-colors" title="Switch Source">
                <RefreshCw className="w-5 h-5 text-foreground" />
              </button>
              <button onClick={onExit} className="p-2.5 rounded-xl glass-surface hover:bg-secondary transition-colors" title="Exit">
                <LogOut className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showControls && !listVisible && !settingsVisible && (
        <div className="absolute top-4 right-4 text-xs text-muted-foreground/50 space-y-1">
          <div>← Channel List</div>
          <div>↑↓ Switch Channels</div>
          <div>M Mute</div>
          <div>F Fullscreen</div>
        </div>
      )}
    </div>
  );
}
