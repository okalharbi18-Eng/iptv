import { useState } from 'react';
import { Tv, Radio, FileText, Loader2, Wifi } from 'lucide-react';

interface SetupScreenProps {
  onLoadM3U: (source: string, options?: { name?: string }) => Promise<void>;
  onLoadXtream: (server: string, username: string, password: string) => Promise<void>;
  onLoadSavedSource: (sourceId: string) => Promise<void>;
  savedSources: Array<{ id: string; name: string; type: 'xtream' | 'm3u' }>;
  isLoading: boolean;
  error: string | null;
}

type Tab = 'xtream' | 'm3u';

export function SetupScreen({ onLoadM3U, onLoadXtream, onLoadSavedSource, savedSources, isLoading, error }: SetupScreenProps) {
  const [tab, setTab] = useState<Tab>('xtream');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');

  const handleXtream = () => {
    if (server && username && password) {
      onLoadXtream(server, username, password);
    }
  };

  const handleM3U = () => {
    if (m3uUrl) {
      onLoadM3U(m3uUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) onLoadM3U(content, { name: file.name });
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 glow-primary mb-4">
            <Tv className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">IPTV Player</h1>
          <p className="text-muted-foreground mt-2">Stream your favorite channels easily</p>
        </div>

        {/* Tabs */}
        {savedSources.length > 0 && (
          <div className="bg-card rounded-2xl p-4 border border-border mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Saved Sources</div>
                <div className="text-xs text-muted-foreground">Switch without losing favorites or channel order</div>
              </div>
              <div className="text-xs text-muted-foreground">{savedSources.length}</div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
              {savedSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => onLoadSavedSource(source.id)}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{source.name}</div>
                      <div className="text-xs text-muted-foreground">{source.type === 'xtream' ? 'Xtream' : 'M3U'}</div>
                    </div>
                    <Radio className="w-4 h-4 text-primary shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex rounded-xl bg-secondary p-1 mb-6">
          <button
            onClick={() => setTab('xtream')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all ${
              tab === 'xtream'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wifi className="w-4 h-4" />
            Xtream
          </button>
          <button
            onClick={() => setTab('m3u')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all ${
              tab === 'm3u'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            M3U
          </button>
        </div>

        {/* Form */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          {tab === 'xtream' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Server URL</label>
                <input
                  type="url"
                  value={server}
                  onChange={e => setServer(e.target.value)}
                  placeholder="http://example.com:8080"
                  className="w-full bg-secondary text-foreground rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full bg-secondary text-foreground rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="password"
                  className="w-full bg-secondary text-foreground rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  dir="ltr"
                />
              </div>
              <button
                onClick={handleXtream}
                disabled={isLoading || !server || !username || !password}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                Connect
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">M3U URL</label>
                <input
                  type="url"
                  value={m3uUrl}
                  onChange={e => setM3uUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className="w-full bg-secondary text-foreground rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  dir="ltr"
                />
              </div>
              <button
                onClick={handleM3U}
                disabled={isLoading || !m3uUrl}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                Load Playlist
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">or</span>
                </div>
              </div>

              <label className="block w-full border-2 border-dashed border-border rounded-xl py-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <span className="text-sm text-muted-foreground">Choose M3U file from your device</span>
                <input type="file" accept=".m3u,.m3u8" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
