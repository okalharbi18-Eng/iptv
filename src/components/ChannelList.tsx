import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Channel } from '@/lib/m3u-parser';
import { Star, Trash2, ChevronUp, ChevronDown, Search, X, Heart, Layers } from 'lucide-react';

interface ChannelListProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  visible: boolean;
  onClose: () => void;
  onNavigate: (dir: 'up' | 'down', filtered: Channel[]) => void;
  onFilteredChange?: (filtered: Channel[]) => void;
}

type Filter = 'all' | 'favorites' | string;

export function ChannelList({
  channels,
  currentChannel,
  onSelect,
  onToggleFavorite,
  onRemove,
  onMove,
  visible,
  onClose,
  onFilteredChange,
}: ChannelListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<'search' | 'filters' | 'channels' | 'actions'>('channels');
  const [actionChannelId, setActionChannelId] = useState<string | null>(null);
  const [actionFocusIdx, setActionFocusIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [filterFocusIdx, setFilterFocusIdx] = useState(0);
  const previousVisibleRef = useRef(visible);
  const previousChannelIdRef = useRef<string | null>(currentChannel?.id || null);

  const groups = useMemo(() => {
    const g = new Set<string>();
    channels.forEach(ch => { if (ch.group) g.add(ch.group); });
    return Array.from(g);
  }, [channels]);

  const allFilters = useMemo(() => ['all', 'favorites', ...groups], [groups]);

  const filtered = useMemo(() => {
    let list = channels;
    if (filter === 'favorites') list = list.filter(ch => ch.isFavorite);
    else if (filter !== 'all') list = list.filter(ch => ch.group === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(ch => ch.name.toLowerCase().includes(q));
    }
    return list;
  }, [channels, filter, search]);

  const focusIdx = useMemo(
    () => filtered.findIndex(channel => channel.id === focusedChannelId),
    [filtered, focusedChannelId]
  );

  const actionButtons = ['favorite', 'moveUp', 'moveDown', 'delete'] as const;
  const actionButtonRefs = useRef<(HTMLButtonElement | null)[][]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const LONG_PRESS_MS = 500;

  useEffect(() => {
    if (onFilteredChange) onFilteredChange(filtered);
  }, [filtered, onFilteredChange]);

  useEffect(() => {
    if (filtered.length === 0) {
      setFocusedChannelId(null);
      return;
    }
    if (focusedChannelId && filtered.some(channel => channel.id === focusedChannelId)) return;
    if (currentChannel && filtered.some(channel => channel.id === currentChannel.id)) {
      setFocusedChannelId(currentChannel.id);
      return;
    }
    setFocusedChannelId(filtered[0].id);
  }, [filtered, focusedChannelId, currentChannel]);

  useEffect(() => {
    const previousVisible = previousVisibleRef.current;
    const previousChannelId = previousChannelIdRef.current;
    const currentChannelId = currentChannel?.id || null;

    if (visible && currentChannelId && (!previousVisible || previousChannelId !== currentChannelId)) {
      const idx = filtered.findIndex(ch => ch.id === currentChannel.id);
      if (idx >= 0) {
        setFocusedChannelId(currentChannelId);
        requestAnimationFrame(() => itemRefs.current[idx]?.scrollIntoView({ block: 'nearest' }));
      }
    }

    previousVisibleRef.current = visible;
    previousChannelIdRef.current = currentChannelId;
  }, [visible, currentChannel, filtered]);

  useEffect(() => {
    if (visible) {
      setFocusArea('channels');
      setActionChannelId(null);
      setActionFocusIdx(0);
    }
  }, [visible]);

  // Keep DOM focus in sync with virtual focus areas for D-pad accessibility
  useEffect(() => {
    if (!visible) return;

    if (focusArea === 'search') {
      searchRef.current?.focus();
    } else if (focusArea === 'filters') {
      const idx = Math.min(Math.max(0, filterFocusIdx), filterRefs.current.length - 1);
      filterRefs.current[idx]?.focus();
    } else if (focusArea === 'channels') {
      const idx = Math.max(0, focusIdx);
      // focus the channel container so remote focus is visible
      itemRefs.current[idx]?.focus?.();
      requestAnimationFrame(() => scrollToChannel(idx));
    } else if (focusArea === 'actions' && actionChannelId) {
      // ensure the channel row is visible and then focus the first action
      const idx = filtered.findIndex(ch => ch.id === actionChannelId);
      if (idx >= 0) {
        requestAnimationFrame(() => itemRefs.current[idx]?.scrollIntoView({ block: 'nearest' }));
      }
    }
  }, [focusArea, filterFocusIdx, focusIdx, actionChannelId, visible, filtered, scrollToChannel]);

  const scrollToChannel = useCallback((idx: number) => {
    requestAnimationFrame(() => itemRefs.current[idx]?.scrollIntoView({ block: 'nearest' }));
  }, []);

  useEffect(() => {
    if (!visible) return;

    const handlerDown = (e: KeyboardEvent) => {
      const currentIndex = filtered.findIndex(channel => channel.id === focusedChannelId);

      // Back button - close list (don't let it propagate)
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'actions') {
          setFocusArea('channels');
          setActionChannelId(null);
        } else if (focusArea === 'search') {
          setFocusArea('channels');
          searchRef.current?.blur();
        } else if (focusArea === 'filters') {
          setFocusArea('channels');
        } else {
          onClose();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'channels') {
          if (currentIndex <= 0) {
            setFocusArea('filters');
            setFilterFocusIdx(0);
          } else {
            const next = currentIndex - 1;
            setFocusedChannelId(filtered[next].id);
            scrollToChannel(next);
          }
        } else if (focusArea === 'filters') {
          setFocusArea('search');
          searchRef.current?.focus();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'search') {
          setFocusArea('filters');
          setFilterFocusIdx(0);
          searchRef.current?.blur();
        } else if (focusArea === 'filters') {
          setFocusArea('channels');
          if (filtered.length > 0) {
            setFocusedChannelId(filtered[0].id);
            scrollToChannel(0);
          }
        } else if (focusArea === 'channels' && filtered.length > 0) {
          const next = Math.min(currentIndex + 1, filtered.length - 1);
          setFocusedChannelId(filtered[next].id);
          scrollToChannel(next);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'filters') {
          setFilterFocusIdx(idx => Math.max(0, idx - 1));
        } else if (focusArea === 'actions') {
          setActionFocusIdx(idx => {
            if (idx <= 0) {
              setFocusArea('channels');
              setActionChannelId(null);
              return 0;
            }
            return idx - 1;
          });
          // focus corresponding action button
          const idx = filtered.findIndex(ch => ch.id === actionChannelId);
          if (idx >= 0) setTimeout(() => actionButtonRefs.current[idx]?.[Math.max(0, actionFocusIdx - 1)]?.focus?.(), 50);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (focusArea === 'filters') {
          setFilterFocusIdx(idx => Math.min(allFilters.length - 1, idx + 1));
        } else if (focusArea === 'channels' && currentIndex >= 0) {
          setFocusArea('actions');
          setActionChannelId(filtered[currentIndex].id);
          setActionFocusIdx(0);
          setTimeout(() => actionButtonRefs.current[currentIndex]?.[0]?.focus?.(), 50);
        } else if (focusArea === 'actions') {
          setActionFocusIdx(idx => Math.min(actionButtons.length - 1, idx + 1));
          const idx = filtered.findIndex(ch => ch.id === actionChannelId);
          if (idx >= 0) setTimeout(() => actionButtonRefs.current[idx]?.[Math.min(actionButtons.length - 1, actionFocusIdx + 1)]?.focus?.(), 50);
        }
      } else if (e.key === 'Enter') {
        // For channels, start long-press detection; for actions, perform immediately
        if (focusArea === 'channels') {
          if (currentIndex >= 0) {
            e.preventDefault();
            e.stopPropagation();
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
            longPressFired.current = false;
            longPressTimer.current = setTimeout(() => {
              longPressFired.current = true;
              setFocusArea('actions');
              setActionChannelId(filtered[currentIndex].id);
              setActionFocusIdx(0);
              setTimeout(() => actionButtonRefs.current[currentIndex]?.[0]?.focus?.(), 50);
            }, LONG_PRESS_MS);
          }
        } else if (focusArea === 'actions' && actionChannelId) {
          e.preventDefault();
          e.stopPropagation();
          const action = actionButtons[actionFocusIdx];
          if (action === 'favorite') onToggleFavorite(actionChannelId);
          else if (action === 'moveUp') onMove(actionChannelId, 'up');
          else if (action === 'moveDown') onMove(actionChannelId, 'down');
          else if (action === 'delete') onRemove(actionChannelId);
        } else if (focusArea === 'filters') {
          e.preventDefault();
          e.stopPropagation();
          const selectedFilter = allFilters[filterFocusIdx];
          if (selectedFilter) {
            setFilter(selectedFilter);
            setFocusArea('channels');
          }
        }
      }
    };

    const handlerUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (focusArea === 'channels') {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            if (longPressFired.current) {
              longPressFired.current = false;
            } else {
              // short press -> select
              if (filtered[focusIdx]) onSelect(filtered[focusIdx]);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handlerDown, true);
    window.addEventListener('keyup', handlerUp, true);
    return () => {
      window.removeEventListener('keydown', handlerDown, true);
      window.removeEventListener('keyup', handlerUp, true);
    };
  }, [visible, focusArea, focusIdx, filtered, focusedChannelId, actionChannelId, actionFocusIdx, filterFocusIdx, allFilters, onSelect, onClose, onToggleFavorite, onMove, onRemove, scrollToChannel]);

  if (!visible) return null;

  return (
    <div className="fixed inset-y-0 left-0 w-80 glass-surface border-r border-border z-50 flex flex-col animate-in slide-in-from-left-full duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">Channels</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Search */}
        <div className={`relative rounded-xl transition-all ${focusArea === 'search' ? 'ring-2 ring-primary' : ''}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocusArea('search')}
            placeholder="Search..."
            className="w-full bg-secondary text-foreground rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-thin pb-2" style={{ scrollbarWidth: 'thin' }}>
          {allFilters.map((f, idx) => {
            const isActive = filter === f;
            const isFocused = focusArea === 'filters' && filterFocusIdx === idx;
            const label = f === 'all' ? `All (${channels.length})` : f === 'favorites' ? 'Favorites' : f;
            const Icon = f === 'all' ? Layers : f === 'favorites' ? Heart : null;
            
            return (
              <button
                key={f}
                ref={el => { filterRefs.current[idx] = el; }}
                onClick={() => { setFilter(f); setFocusArea('channels'); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? f === 'favorites' ? 'bg-channel-favorite text-primary-foreground' : 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                } ${isFocused ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110' : ''}`}
              >
                {Icon && <Icon className="w-3 h-3 inline mr-1" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel list */}
      <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm">No results</span>
          </div>
        ) : (
          filtered.map((ch, idx) => {
            const isActive = currentChannel?.id === ch.id;
            const isFocused = focusArea === 'channels' && focusedChannelId === ch.id;
            const showActions = actionChannelId === ch.id && focusArea === 'actions';

            return (
              <div
                key={ch.id}
                ref={el => { itemRefs.current[idx] = el; }}
                tabIndex={-1}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all group ${
                  isActive ? 'channel-active' : ''
                } ${isFocused ? 'bg-secondary border-l-2 border-l-primary' : 'hover:bg-channel-hover'}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(ch)}
                  onMouseEnter={() => { setFocusedChannelId(ch.id); setFocusArea('channels'); }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                    {ch.logo ? (
                      <img src={ch.logo} alt="" className="w-full h-full object-contain p-0.5" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground break-words leading-tight">{ch.name}</div>
                    {ch.group && <div className="text-xs text-muted-foreground">{ch.group}</div>}
                  </div>
                </button>

                {/* Favorite indicator */}
                {ch.isFavorite && !showActions && (
                  <Star className="w-3.5 h-3.5 fill-channel-favorite text-channel-favorite shrink-0" />
                )}

                {/* Actions - visible on hover (mouse) or focus (remote) */}
                <div className={`flex items-center gap-1 shrink-0 transition-opacity ${
                  showActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  {actionButtons.map((action, aIdx) => {
                    const isActionFocused = showActions && actionFocusIdx === aIdx;
                    const icons = {
                      favorite: <Star className={`w-4 h-4 ${ch.isFavorite ? 'fill-channel-favorite text-channel-favorite' : 'text-muted-foreground'}`} />,
                      moveUp: <ChevronUp className="w-4 h-4 text-muted-foreground" />,
                      moveDown: <ChevronDown className="w-4 h-4 text-muted-foreground" />,
                      delete: <Trash2 className="w-4 h-4 text-destructive" />,
                    };

                    return (
                      <button
                        key={action}
                        ref={el => { actionButtonRefs.current[idx] = actionButtonRefs.current[idx] || []; actionButtonRefs.current[idx][aIdx] = el; }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (action === 'favorite') onToggleFavorite(ch.id);
                          else if (action === 'moveUp') onMove(ch.id, 'up');
                          else if (action === 'moveDown') onMove(ch.id, 'down');
                          else if (action === 'delete') onRemove(ch.id);
                        }}
                        className={`p-1.5 rounded transition-all ${
                          isActionFocused
                            ? 'bg-primary/20 ring-2 ring-primary scale-125'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {icons[action]}
                      </button>
                    );
                  })}
                </div>

                {isActive && !showActions && (
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Action hints */}
      {focusArea === 'actions' && actionChannelId && (
        <div className="p-3 border-t border-border bg-background/70 text-center text-xs text-foreground">
          ←→ Navigate actions • Enter to apply • Esc to go back
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-border text-center">
        <span className="text-xs text-muted-foreground">
          {filtered.length} channels • ↑↓ Navigate • → Options • Enter Select
        </span>
      </div>
    </div>
  );
}
