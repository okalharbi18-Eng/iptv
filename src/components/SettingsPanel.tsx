import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Radio, Plus } from 'lucide-react';
import { SourceConfig } from '@/hooks/useIPTV';

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
  playbackMode: 'auto' | 'hls' | 'native';
  onChangePlaybackMode: (mode: 'auto' | 'hls' | 'native') => void;
  onSwitchSource: () => void;
  sources: SourceConfig[];
  currentSourceId: string | null;
  onLoadSavedSource: (sourceId: string) => void;
  onDeleteSource: (sourceId: string) => void;
}

type SettingsFocusArea = 'playback' | 'sources' | 'addSource' | 'programOptions';

export function SettingsPanel({
  visible,
  onClose,
  playbackMode,
  onChangePlaybackMode,
  onSwitchSource,
  sources,
  currentSourceId,
  onLoadSavedSource,
  onDeleteSource,
}: SettingsPanelProps) {
  const [focusArea, setFocusArea] = useState<SettingsFocusArea>('playback');
  const [playbackIdx, setPlaybackIdx] = useState(0);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [sourceActionFocused, setSourceActionFocused] = useState(false);
  const [programIdx, setProgramIdx] = useState(0);
  const [hlsWorkerEnabled, setHlsWorkerEnabled] = useState(() => localStorage.getItem('iptv_hls_use_worker') === '1');
  const [hlsLowLatency, setHlsLowLatency] = useState(() => localStorage.getItem('iptv_hls_low_latency') === '1');
  const playbackModes: ('auto' | 'hls' | 'native')[] = ['auto', 'hls', 'native'];
  const playbackRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sourceRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (visible) {
      setFocusArea('playback');
      setPlaybackIdx(playbackModes.indexOf(playbackMode));
      setSourceIdx(0);
      setSourceActionFocused(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'addSource') {
          setFocusArea('sources');
          setSourceIdx(Math.max(0, sources.length - 1));
          setSourceActionFocused(false);
        } else if (focusArea === 'sources') {
          if (sourceIdx <= 0) {
            setFocusArea('playback');
          } else {
            setSourceIdx(i => i - 1);
            setSourceActionFocused(false);
          }
        } else if (focusArea === 'programOptions') {
          // move focus between program options; if at first option, jump to sources
          if (programIdx > 0) {
            setProgramIdx(i => Math.max(0, i - 1));
          } else if (sources.length > 0) {
            setFocusArea('sources');
            setSourceIdx(Math.max(0, sources.length - 1));
          } else {
            setFocusArea('playback');
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'playback') {
          if (sources.length > 0) {
            setFocusArea('sources');
            setSourceIdx(0);
            setSourceActionFocused(false);
          } else {
            setFocusArea('programOptions');
            setProgramIdx(0);
          }
        } else if (focusArea === 'sources') {
          if (sourceIdx >= sources.length - 1) {
            setFocusArea('programOptions');
            setProgramIdx(0);
          } else {
            setSourceIdx(i => i + 1);
            setSourceActionFocused(false);
          }
        } else if (focusArea === 'programOptions') {
          // navigate between program options
          setProgramIdx(i => Math.min(1, i + 1));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'playback') {
          setPlaybackIdx(i => Math.max(0, i - 1));
        } else if (focusArea === 'sources' && sourceActionFocused) {
          setSourceActionFocused(false);
        } else if (focusArea === 'programOptions') {
          // toggle selected program option off
          if (programIdx === 0) {
            setHlsWorkerEnabled(false);
            localStorage.setItem('iptv_hls_use_worker', '0');
          } else if (programIdx === 1) {
            setHlsLowLatency(false);
            localStorage.setItem('iptv_hls_low_latency', '0');
          }
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'playback') {
          setPlaybackIdx(i => Math.min(playbackModes.length - 1, i + 1));
        } else if (focusArea === 'sources' && sources.length > 0 && !sourceActionFocused) {
          setSourceActionFocused(true);
        } else if (focusArea === 'programOptions') {
          // toggle selected program option on
          if (programIdx === 0) {
            setHlsWorkerEnabled(true);
            localStorage.setItem('iptv_hls_use_worker', '1');
          } else if (programIdx === 1) {
            setHlsLowLatency(true);
            localStorage.setItem('iptv_hls_low_latency', '1');
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'playback') {
          onChangePlaybackMode(playbackModes[playbackIdx]);
        } else if (focusArea === 'sources') {
          if (sourceActionFocused) {
            onDeleteSource(sources[sourceIdx].id);
            setSourceActionFocused(false);
            if (sources.length > 1) {
              setSourceIdx(prev => Math.max(0, prev - 1));
            } else {
              setSourceIdx(0);
              setFocusArea('programOptions'); // If last source deleted, move focus
            }
          } else {
            onLoadSavedSource(sources[sourceIdx].id);
            onClose();
          }
        } else if (focusArea === 'addSource') {
          onSwitchSource();
          onClose();
        } else if (focusArea === 'programOptions') {
          // Toggle the selected program option
          if (programIdx === 0) {
            const next = !hlsWorkerEnabled;
            setHlsWorkerEnabled(next);
            localStorage.setItem('iptv_hls_use_worker', next ? '1' : '0');
          } else if (programIdx === 1) {
            const next = !hlsLowLatency;
            setHlsLowLatency(next);
            localStorage.setItem('iptv_hls_low_latency', next ? '1' : '0');
          }
        }
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [visible, focusArea, playbackIdx, sourceIdx, sourceActionFocused, sources, playbackModes, onClose, onChangePlaybackMode, onSwitchSource, onLoadSavedSource, onDeleteSource]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl max-h-[80vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground">Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Playback Engine */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Playback Engine</div>
            <div className="text-xs text-muted-foreground">Choose how streams are processed</div>
            <div className="flex gap-2">
              {playbackModes.map((mode, idx) => (
                <button
                  key={mode}
                  ref={el => { playbackRefs.current[idx] = el; }}
                  onClick={() => { onChangePlaybackMode(mode); setPlaybackIdx(idx); }}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    playbackMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                  } ${focusArea === 'playback' && playbackIdx === idx ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-105' : ''}`}
                >
                  {mode === 'auto' ? 'Auto' : mode === 'hls' ? 'HLS.js' : 'Native'}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {playbackMode === 'auto' && 'Automatically selects the best engine for each stream'}
              {playbackMode === 'hls' && 'Uses HLS.js library — better compatibility, smoother playback'}
              {playbackMode === 'native' && 'Uses device native player — lower resource usage'}
            </div>
          </div>

          {/* Source Management */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Source Management</div>
            <div className="text-xs text-muted-foreground">Switch between sources or add new ones</div>
            
            <div className="space-y-2">
              {sources.map((source, idx) => {
                const isFocused = focusArea === 'sources' && sourceIdx === idx;
                const isDeleteFocused = isFocused && sourceActionFocused;

                return (
                  <div
                    key={source.id}
                    ref={el => { sourceRefs.current[idx] = el; }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                      source.id === currentSourceId
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary/50 hover:bg-secondary'
                    } ${isFocused && !sourceActionFocused ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                  >
                    <button
                      onClick={() => { onLoadSavedSource(source.id); onClose(); }}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      <Radio className={`w-4 h-4 shrink-0 ${source.id === currentSourceId ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{source.name}</div>
                        <div className="text-xs text-muted-foreground">{source.type === 'xtream' ? 'Xtream' : 'M3U'}</div>
                      </div>
                    </button>
                    {sources.length > 1 && (
                      <button
                        onClick={() => onDeleteSource(source.id)}
                        className={`p-1.5 rounded transition-all ${
                          isDeleteFocused
                            ? 'bg-destructive/20 ring-2 ring-destructive scale-125 text-destructive'
                            : 'hover:bg-destructive/20 text-muted-foreground hover:text-destructive'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => { onSwitchSource(); onClose(); }}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-all ${
                focusArea === 'addSource'
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              <Plus className="w-4 h-4" />
              Add New Source
            </button>
          </div>

          {/* Program Options */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Program Options</div>
            <div className="text-xs text-muted-foreground">General application settings</div>

            <div className="space-y-2">
              <div
                className={`px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between ${
                  focusArea === 'programOptions' && programIdx === 0 ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-105' : 'border-border bg-secondary/50'
                }`}
                tabIndex={-1}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">HLS.js Worker</div>
                  <div className="text-xs text-muted-foreground">Use web worker for HLS.js (can reduce main-thread load)</div>
                </div>
                <button
                  onClick={() => { const next = !hlsWorkerEnabled; setHlsWorkerEnabled(next); localStorage.setItem('iptv_hls_use_worker', next ? '1' : '0'); }}
                  className={`px-3 py-1 rounded-lg text-sm ${hlsWorkerEnabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
                >
                  {hlsWorkerEnabled ? 'On' : 'Off'}
                </button>
              </div>

              <div
                className={`px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between ${
                  focusArea === 'programOptions' && programIdx === 1 ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-105' : 'border-border bg-secondary/50'
                }`}
                tabIndex={-1}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">HLS Low-Latency</div>
                  <div className="text-xs text-muted-foreground">Enable low-latency mode for supported streams</div>
                </div>
                <button
                  onClick={() => { const next = !hlsLowLatency; setHlsLowLatency(next); localStorage.setItem('iptv_hls_low_latency', next ? '1' : '0'); }}
                  className={`px-3 py-1 rounded-lg text-sm ${hlsLowLatency ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
                >
                  {hlsLowLatency ? 'On' : 'Off'}
                </button>
              </div>

              <div className="px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between border-border bg-secondary/50">
                <span className="text-sm font-medium text-foreground">App Version</span>
                <span className="text-sm text-muted-foreground">1.0.0</span>
              </div>
            </div>
          </div>

          {/* Navigation hints */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border space-y-1">
            <div>↑↓ Navigate • ←→ Options • Enter Select • Back Close</div>
            <div className="opacity-50">IPTV Player v1.1</div>
          </div>
        </div>
      </div>
    </div>
  );
}
