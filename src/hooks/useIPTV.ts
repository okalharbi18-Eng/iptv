import { useCallback, useEffect, useRef, useState } from 'react';
import { Channel, parseM3U, buildXtreamUrl } from '@/lib/m3u-parser';

export interface IPTVState {
  channels: Channel[];
  currentChannel: Channel | null;
  isLoading: boolean;
  error: string | null;
  isSetup: boolean;
  sources: SourceConfig[];
  currentSourceId: string | null;
}

export interface SourceConfig {
  id: string;
  name: string;
  type: 'xtream' | 'm3u';
  server?: string;
  username?: string;
  password?: string;
  m3uUrl?: string;
  m3uContent?: string;
}

interface SourceChannelState {
  favorites: string[];
  order: string[];
  lastChannelId: string | null;
}

const STORAGE_KEYS = {
  legacyFavorites: 'iptv_favorites',
  legacyOrder: 'iptv_order',
  legacySource: 'iptv_source',
  sources: 'iptv_sources',
  currentSourceId: 'iptv_current_source_id',
  statePrefix: 'iptv_source_state_',
  lastActiveSource: 'iptv_last_active_source',
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeServer(server: string) {
  return server.trim().replace(/\/+$/, '');
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function createSourceId(config: Omit<SourceConfig, 'id' | 'name'>): string {
  if (config.type === 'xtream') {
    return `xtream:${normalizeServer(config.server || '').toLowerCase()}|${(config.username || '').trim().toLowerCase()}`;
  }
  if (config.m3uUrl) {
    return `m3u:${config.m3uUrl.trim()}`;
  }
  return `m3u-file:${hashString(config.m3uContent || '')}`;
}

function createSourceName(config: Omit<SourceConfig, 'id' | 'name'>, fallbackName?: string) {
  if (fallbackName?.trim()) return fallbackName.trim();
  if (config.type === 'xtream') return config.username?.trim() || 'Xtream source';
  if (config.m3uUrl) return config.m3uUrl.trim();
  return 'Local M3U file';
}

function loadSavedSources(): SourceConfig[] {
  return readJson<SourceConfig[]>(STORAGE_KEYS.sources, []);
}

function saveSources(sources: SourceConfig[]) {
  localStorage.setItem(STORAGE_KEYS.sources, JSON.stringify(sources));
}

function upsertSource(source: SourceConfig): SourceConfig[] {
  const existing = loadSavedSources().filter(saved => saved.id !== source.id);
  const nextSources = [source, ...existing];
  saveSources(nextSources);
  return nextSources;
}

function getSourceStateKey(sourceId: string) {
  return `${STORAGE_KEYS.statePrefix}${sourceId}`;
}

function loadSourceState(sourceId: string): SourceChannelState {
  return readJson<SourceChannelState>(getSourceStateKey(sourceId), {
    favorites: [],
    order: [],
    lastChannelId: null,
  });
}

function saveSourceState(sourceId: string, channels: Channel[], currentChannel: Channel | null) {
  localStorage.setItem(
    getSourceStateKey(sourceId),
    JSON.stringify({
      favorites: channels.filter(channel => channel.isFavorite).map(channel => channel.id),
      order: channels.map(channel => channel.id),
      lastChannelId: currentChannel?.id || null,
    } satisfies SourceChannelState)
  );
}

function applySavedState(channels: Channel[], favorites: string[], order: string[]): Channel[] {
  channels.forEach(channel => {
    if (favorites.includes(channel.id)) channel.isFavorite = true;
  });
  if (order.length > 0) {
    const orderMap = new Map(order.map((id, idx) => [id, idx]));
    channels.sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }
  return channels;
}

export function useIPTV() {
  const [state, setState] = useState<IPTVState>(() => ({
    channels: [],
    currentChannel: null,
    isLoading: false,
    error: null,
    isSetup: false,
    sources: loadSavedSources(),
    currentSourceId: localStorage.getItem(STORAGE_KEYS.currentSourceId),
  }));

  const autoLoadRef = useRef(false);

  useEffect(() => {
    if (!state.currentSourceId || state.channels.length === 0) return;
    saveSourceState(state.currentSourceId, state.channels, state.currentChannel);
  }, [state.channels, state.currentChannel, state.currentSourceId]);

  const loadPlaylist = useCallback(async (sourceConfig: SourceConfig, playlistSource: string) => {
    setState(current => ({ ...current, isLoading: true, error: null }));
    try {
      let content: string;
      const isUrl = playlistSource.startsWith('http');
      if (isUrl) {
        const response = await fetch(playlistSource);
        if (!response.ok) throw new Error('Failed to load playlist');
        content = await response.text();
      } else {
        content = playlistSource;
      }
      const channels = parseM3U(content);
      if (channels.length === 0) throw new Error('No channels found');

      const savedState = loadSourceState(sourceConfig.id);
      applySavedState(channels, savedState.favorites, savedState.order);

      const currentChannel = channels.find(channel => channel.id === savedState.lastChannelId) || channels[0] || null;
      const sources = upsertSource(sourceConfig);

      localStorage.setItem(STORAGE_KEYS.currentSourceId, sourceConfig.id);
      localStorage.setItem(STORAGE_KEYS.lastActiveSource, sourceConfig.id);

      setState(current => ({
        ...current,
        channels,
        currentChannel,
        isLoading: false,
        isSetup: true,
        sources,
        currentSourceId: sourceConfig.id,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setState(current => ({ ...current, isLoading: false, error: errorMessage }));
    }
  }, []);

  // Auto-load last active source on startup
  useEffect(() => {
    // If the setup is already complete, or we've already tried to auto-load, do nothing.
    if (state.isSetup || autoLoadRef.current) return;

    autoLoadRef.current = true; // Mark that we've attempted to auto-load

    const lastActiveId = localStorage.getItem(STORAGE_KEYS.lastActiveSource);
    if (!lastActiveId) {
      // No last active source to load, so stay on setup screen
      return;
    }

    const availableSource = state.sources.find(s => s.id === lastActiveId);

    if (availableSource) {
      // Load the found source
      loadSavedSource(availableSource.id);
    }
    // If no availableSource, remain in setup state.
  }, [state.isSetup, state.sources, loadSavedSource]);
 

  const loadFromM3U = useCallback(async (source: string, options?: { name?: string }) => {
    const isUrl = source.startsWith('http');
    const baseConfig = isUrl
      ? { type: 'm3u' as const, m3uUrl: source }
      : { type: 'm3u' as const, m3uContent: source };

    const sourceConfig: SourceConfig = {
      ...baseConfig,
      id: createSourceId(baseConfig),
      name: createSourceName(baseConfig, options?.name),
    };

    await loadPlaylist(sourceConfig, isUrl ? source : sourceConfig.m3uContent || '');
  }, [loadPlaylist]);

  const loadFromXtream = useCallback(async (server: string, username: string, password: string) => {
    const trimmedServer = normalizeServer(server);
    const trimmedUsername = username.trim();
    const baseConfig = {
      type: 'xtream' as const,
      server: trimmedServer,
      username: trimmedUsername,
      password,
    };

    const sourceConfig: SourceConfig = {
      ...baseConfig,
      id: createSourceId(baseConfig),
      name: createSourceName(baseConfig),
    };

    await loadPlaylist(sourceConfig, buildXtreamUrl(trimmedServer, trimmedUsername, password));
  }, [loadPlaylist]);

  const loadSavedSource = useCallback(async (sourceId: string) => {
    const source = state.sources.find(item => item.id === sourceId) || loadSavedSources().find(item => item.id === sourceId);
    if (!source) {
      setState(current => ({ ...current, error: 'Saved source not found' }));
      return;
    }

    const playlistSource = source.type === 'xtream'
      ? buildXtreamUrl(source.server || '', source.username || '', source.password || '')
      : source.m3uUrl || source.m3uContent || '';

    await loadPlaylist(source, playlistSource);
  }, [loadPlaylist, state.sources]);

  const selectChannel = useCallback((channel: Channel) => {
    setState(current => ({ ...current, currentChannel: channel }));
  }, []);

  const toggleFavorite = useCallback((channelId: string) => {
    setState(current => {
      const channels = current.channels.map(channel =>
        channel.id === channelId ? { ...channel, isFavorite: !channel.isFavorite } : channel
      );
      const currentChannel = current.currentChannel?.id === channelId
        ? channels.find(channel => channel.id === channelId) || current.currentChannel
        : current.currentChannel;
      return { ...current, channels, currentChannel };
    });
  }, []);

  const removeChannel = useCallback((channelId: string) => {
    setState(current => {
      const channels = current.channels.filter(channel => channel.id !== channelId);
      const currentChannel = current.currentChannel?.id === channelId
        ? channels[0] || null
        : current.currentChannel;
      return { ...current, channels, currentChannel };
    });
  }, []);

  const moveChannel = useCallback((channelId: string, direction: 'up' | 'down') => {
    setState(current => {
      const currentIndex = current.channels.findIndex(channel => channel.id === channelId);
      if (currentIndex === -1) return current;
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= current.channels.length) return current;
      const channels = [...current.channels];
      [channels[currentIndex], channels[nextIndex]] = [channels[nextIndex], channels[currentIndex]];
      return { ...current, channels };
    });
  }, []);

  const navigateChannel = useCallback((direction: 'up' | 'down', filteredChannels?: Channel[]) => {
    setState(current => {
      const list = filteredChannels && filteredChannels.length > 0 ? filteredChannels : current.channels;
      if (list.length === 0) return current;
      if (!current.currentChannel) {
        return { ...current, currentChannel: list[0] };
      }
      const currentIndex = list.findIndex(channel => channel.id === current.currentChannel?.id);
      const nextIndex = currentIndex === -1
        ? direction === 'up' ? list.length - 1 : 0
        : direction === 'up'
          ? (currentIndex - 1 + list.length) % list.length
          : (currentIndex + 1) % list.length;
      return { ...current, currentChannel: list[nextIndex] };
    });
  }, []);

  const switchSource = useCallback(() => {
    setState(current => ({
      ...current,
      isSetup: false,
      error: null,
    }));
  }, []);

  const deleteSource = useCallback((sourceId: string) => {
    const sources = loadSavedSources().filter(s => s.id !== sourceId);
    saveSources(sources);
    // Remove source state
    localStorage.removeItem(getSourceStateKey(sourceId));
    setState(current => ({ ...current, sources }));
  }, []);

  const reset = useCallback(() => {
    Object.keys(localStorage)
      .filter(key => key.startsWith(STORAGE_KEYS.statePrefix))
      .forEach(key => localStorage.removeItem(key));

    localStorage.removeItem(STORAGE_KEYS.sources);
    localStorage.removeItem(STORAGE_KEYS.currentSourceId);
    localStorage.removeItem(STORAGE_KEYS.lastActiveSource);
    localStorage.removeItem(STORAGE_KEYS.legacyFavorites);
    localStorage.removeItem(STORAGE_KEYS.legacyOrder);
    localStorage.removeItem(STORAGE_KEYS.legacySource);

    setState({
      channels: [],
      currentChannel: null,
      isLoading: false,
      error: null,
      isSetup: false,
      sources: [],
      currentSourceId: null,
    });
  }, []);

  return {
    ...state,
    loadFromM3U,
    loadFromXtream,
    loadSavedSource,
    selectChannel,
    toggleFavorite,
    removeChannel,
    moveChannel,
    navigateChannel,
    switchSource,
    deleteSource,
    reset,
  };
}
