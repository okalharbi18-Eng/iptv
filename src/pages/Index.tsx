import { useEffect, useState, useRef, useCallback } from 'react';
import { useIPTV } from '@/hooks/useIPTV';
import { SetupScreen } from '@/components/SetupScreen';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ChannelList } from '@/components/ChannelList';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Channel } from '@/lib/m3u-parser';

const Index = () => {
  const iptv = useIPTV();
  const [listVisible, setListVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [confirmExitVisible, setConfirmExitVisible] = useState(false);
  const [navigationChannels, setNavigationChannels] = useState<Channel[]>([]);
  const [playbackMode, setPlaybackMode] = useState<'auto' | 'hls' | 'native'>(() => {
    return (localStorage.getItem('iptv_playback_mode') as 'auto' | 'hls' | 'native') || 'auto';
  });
  const backPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backPressCount = useRef(0);

  const savePlaybackMode = (mode: 'auto' | 'hls' | 'native') => {
    localStorage.setItem('iptv_playback_mode', mode);
    setPlaybackMode(mode);
  };

  // Back button: hierarchical close, then double-press to exit
  useEffect(() => {
    const hijackBack = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Backspace') return;
      
      // Don't handle if channel list is open (it handles its own back)
      if (listVisible) return;

      e.preventDefault();
      e.stopPropagation();

      // Close settings first
      if (settingsVisible) {
        setSettingsVisible(false);
        return;
      }

      // Close exit confirm
      // Only show exit confirm if nothing else is open
      if (!settingsVisible && !listVisible && !confirmExitVisible) {
        setConfirmExitVisible(true);
      } else if (confirmExitVisible) {
        setConfirmExitVisible(false);
      }
    };

    window.addEventListener('keydown', hijackBack, true);
    return () => window.removeEventListener('keydown', hijackBack, true);
  }, [settingsVisible, listVisible, confirmExitVisible]);

  if (!iptv.isSetup) {
    return (
      <SetupScreen
        onLoadM3U={iptv.loadFromM3U}
        onLoadXtream={iptv.loadFromXtream}
        onLoadSavedSource={iptv.loadSavedSource}
        savedSources={iptv.sources}
        isLoading={iptv.isLoading}
        error={iptv.error}
      />
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <VideoPlayer
        channel={iptv.currentChannel}
        playbackMode={playbackMode}
        onToggleList={() => setListVisible(v => !v)}
        onNavigate={(dir) => iptv.navigateChannel(dir, navigationChannels)}
        onSwitchSource={iptv.switchSource}
        onExit={() => setConfirmExitVisible(true)}
        onToggleSettings={() => setSettingsVisible(v => !v)}
        listVisible={listVisible}
        settingsVisible={settingsVisible}
      />
      <ChannelList
        channels={iptv.channels}
        currentChannel={iptv.currentChannel}
        onSelect={(ch) => { iptv.selectChannel(ch); setListVisible(false); }}
        onToggleFavorite={iptv.toggleFavorite}
        onRemove={iptv.removeChannel}
        onMove={iptv.moveChannel}
        visible={listVisible}
        onClose={() => setListVisible(false)}
        onNavigate={iptv.navigateChannel}
        onFilteredChange={setNavigationChannels}
      />
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        playbackMode={playbackMode}
        onChangePlaybackMode={savePlaybackMode}
        onSwitchSource={iptv.switchSource}
        sources={iptv.sources}
        currentSourceId={iptv.currentSourceId}
        onLoadSavedSource={iptv.loadSavedSource}
        onDeleteSource={iptv.deleteSource}
      />

      {confirmExitVisible && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-xl">
            <h2 className="text-lg font-semibold text-foreground mb-3">Exit App?</h2>
            <p className="text-sm text-muted-foreground mb-5">Are you sure you want to exit?</p>
            <div className="flex gap-3 justify-center">
              <button
                className="px-6 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-medium"
                autoFocus
                onClick={() => {
                  setConfirmExitVisible(false);
                  window.close();
                  if (typeof (navigator as any).app?.exitApp === 'function') {
                    (navigator as any).app.exitApp();
                  }
                }}
              >
                Yes, Exit
              </button>
              <button
                className="px-6 py-2.5 rounded-lg bg-secondary text-foreground font-medium"
                onClick={() => setConfirmExitVisible(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
