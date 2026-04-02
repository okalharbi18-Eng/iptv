export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  isFavorite: boolean;
}

function hashString(value: string): string {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return `ch_${Math.abs(hash).toString(36)}`;
}

export function parseM3U(content: string): Channel[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const channels: Channel[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
      const infoLine = lines[i];
      const urlLine = lines[i + 1];
      
      if (urlLine && !urlLine.startsWith('#')) {
        const nameMatch = infoLine.match(/,(.+)$/);
        const logoMatch = infoLine.match(/tvg-logo="([^"]*)"/);
        const groupMatch = infoLine.match(/group-title="([^"]*)"/);
        const name = nameMatch?.[1]?.trim() || `Channel ${channels.length + 1}`;
        const logo = logoMatch?.[1] || undefined;
        const group = groupMatch?.[1] || 'General';
        const id = hashString(`${name}|${urlLine}|${logo || ''}|${group}`);
        
        channels.push({
          id,
          name,
          url: urlLine,
          logo,
          group,
          isFavorite: false,
        });
        i++;
      }
    }
  }
  
  return channels;
}

export function buildXtreamUrl(server: string, username: string, password: string): string {
  const base = server.replace(/\/$/, '');
  return `${base}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;
}
