import { PreloadedUserSettings } from 'discord-protos';
import { Client as GeniusClient } from 'genius-lyrics';

interface StatusUpdaterConfig {
    discordToken: string;
    emojiId?: string;
    emojiName?: string;
    discordStatus?: string;
    artist: string;
    title: string;
    updateInterval?: number;
    onLyricsLoaded?: (lyrics: string[]) => void;
    onStatusUpdate?: (lyric: string) => void;
    onError?: (message: string, fatal: boolean) => void;
    geniusApiKey?: string;
}

export class StatusUpdater {
    private currentLyricIndex: number = 0;
    private readonly updateInterval: number;
    private readonly discordToken: string;
    private readonly emojiId?: string;
    private readonly emojiName?: string;
    private readonly discordStatus: string;
    private currentLyrics: string[] = [];
    private updateIntervalId?: NodeJS.Timeout;
    private readonly artist: string;
    private readonly title: string;
    private readonly onLyricsLoaded?: (lyrics: string[]) => void;
    private readonly onStatusUpdate?: (lyric: string) => void;
    private readonly onError?: (message: string, fatal: boolean) => void;
    private readonly geniusApiKey?: string;
    private stopped: boolean = false;
    private pausedUntil: number = 0;

    // Discord heavily rate-limits the settings-proto endpoint. Updating faster
    // than this reliably triggers HTTP 429, so clamp the interval to a safe floor.
    public static readonly MIN_UPDATE_INTERVAL = 15000;

    constructor(config: StatusUpdaterConfig) {
        this.discordToken = config.discordToken;
        this.emojiId = config.emojiId;
        this.emojiName = config.emojiName;
        this.discordStatus = config.discordStatus || 'online';
        this.artist = config.artist;
        this.title = config.title;
        this.updateInterval = Math.max(config.updateInterval || 15000, StatusUpdater.MIN_UPDATE_INTERVAL);
        this.onLyricsLoaded = config.onLyricsLoaded;
        this.onStatusUpdate = config.onStatusUpdate;
        this.onError = config.onError;
        this.geniusApiKey = config.geniusApiKey;
        this.fetchAndSetLyrics();
    }

    public stop(): void {
        this.stopped = true;
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = undefined;
        }
    }

    private async fetchAndSetLyrics(): Promise<void> {
        try {
            // Try LRCLIB first
            let lyrics = await this.fetchLrclibLyrics();

            // If LRCLIB fails and we have a Genius API key, try Genius
            if (!lyrics && this.geniusApiKey) {
                console.log("LRCLIB lyrics not found, trying Genius...");
                lyrics = await this.fetchGeniusLyrics();
            }

            // Stopped while the lyrics were loading
            if (this.stopped) return;

            if (lyrics) {
                this.currentLyrics = this.splitLyrics(lyrics);
                console.log("Lyrics loaded:", this.currentLyrics);
                
                // Make sure we call onLyricsLoaded with the processed lyrics
                if (this.onLyricsLoaded && this.currentLyrics.length > 0) {
                    this.onLyricsLoaded(this.currentLyrics);
                }
                
                this.startPeriodicUpdate();
            } else {
                const hint = this.geniusApiKey ? '' : ' Adding a Genius API key may help.';
                this.fail(`No lyrics found for "${this.title}" by ${this.artist}.${hint}`);
            }
        } catch (error) {
            console.error("Error in fetchAndSetLyrics:", error);
            this.fail("Failed to load lyrics");
        }
    }

    private async fetchGeniusLyrics(): Promise<string | null> {
        try {
            if (!this.geniusApiKey) return null;
            
            const genius = new GeniusClient(this.geniusApiKey);
            const searches = await genius.songs.search(`${this.artist} ${this.title}`);
            
            if (searches.length > 0) {
                const lyrics = await searches[0].lyrics();
                if (lyrics) {
                    // Clean up Genius lyrics
                    return lyrics
                        .replace(/\[.*?\]/g, '') // Remove [Verse], [Chorus], etc.
                        .replace(/\n\n+/g, '\n') // Replace multiple newlines with single
                        .replace(/^[\n\s]+|[\n\s]+$/g, '') // Trim start and end
                        .replace(/You might also like/g, '') // Remove "You might also like"
                        .split('\n')
                        .filter(line => 
                            line.trim() !== '' && 
                            !line.includes('Embed') &&
                            !line.includes('See') &&
                            !line.includes('Lyrics')
                        )
                        .join('\n');
                }
            }
            return null;
        } catch (error) {
            console.error("Error fetching Genius lyrics:", error);
            return null;
        }
    }

    // A real set of lyrics has multiple lines; reject one-line junk entries.
    private isUsableLyrics(text?: string | null): boolean {
        if (!text) return false;
        return text.trim().split('\n').filter(line => line.trim() !== '').length >= 2;
    }

    private async fetchLrclibLyrics(): Promise<string | null> {
        try {
            const params = new URLSearchParams({
                artist_name: this.artist,
                track_name: this.title
            });
            const options = {
                headers: { 'User-Agent': 'LyricCord (https://github.com/StealthEliteV1/LyricCord)' },
                signal: AbortSignal.timeout(15000)
            };

            const exact = await fetch(`https://lrclib.net/api/get?${params}`, options);
            if (exact.ok) {
                const song = await exact.json() as { plainLyrics?: string | null };
                // Some LRCLIB entries are junk/vandalized (e.g. a single word), so
                // only trust an exact match that actually looks like lyrics.
                if (this.isUsableLyrics(song.plainLyrics)) return song.plainLyrics!;
            }

            // No usable exact match; search and pick the richest result.
            const search = await fetch(`https://lrclib.net/api/search?${params}`, options);
            if (!search.ok) return null;
            const results = await search.json() as { plainLyrics?: string | null }[];
            const best = results
                .map(song => (song.plainLyrics || '').trim())
                .filter(text => this.isUsableLyrics(text))
                .sort((a, b) => b.length - a.length)[0];
            return best || null;
        } catch (error) {
            console.error("Error fetching LRCLIB lyrics:", error);
            return null;
        }
    }

    private fail(message: string): void {
        this.stop();
        this.onError?.(message, true);
    }

    // Discord reports how long to wait on a 429, in the JSON body (retry_after,
    // seconds) or the Retry-After header. Fall back to one interval, capped at 60s.
    private async getRetryAfterMs(response: Response): Promise<number> {
        let retryMs = this.updateInterval;
        try {
            const body = await response.clone().json() as { retry_after?: number };
            if (typeof body.retry_after === 'number') {
                retryMs = body.retry_after * 1000;
            } else {
                const header = response.headers.get('retry-after');
                if (header) retryMs = parseFloat(header) * 1000;
            }
        } catch {
            const header = response.headers.get('retry-after');
            if (header) retryMs = parseFloat(header) * 1000;
        }
        if (!(retryMs > 0)) retryMs = this.updateInterval;
        return Math.min(retryMs, 60000);
    }

    private splitLyrics(lyrics: string): string[] {
        if (!lyrics) return [];
        
        return lyrics.split('\n').flatMap(line => {
            // Skip empty lines
            if (!line.trim()) return [];
            
            const words = line.split(' ');
            const lines: string[] = [];
            let currentLine = '';

            for (const word of words) {
                if ((currentLine + ' ' + word).length <= 50) {
                    currentLine += (currentLine ? ' ' : '') + word;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            return lines;
        }).filter(line => line.trim() !== ''); // Remove any empty lines
    }

    private startPeriodicUpdate(): void {
        // Start the interval
        this.updateIntervalId = setInterval(() => this.updateDiscordStatus(), this.updateInterval);
        
        // Trigger first update immediately
        this.updateDiscordStatus();
    }

    private async updateDiscordStatus(): Promise<void> {
        if (this.currentLyrics.length === 0) {
            console.error("No lyrics available for update");
            return;
        }

        // Backing off from a Discord rate limit; skip this tick.
        if (Date.now() < this.pausedUntil) {
            return;
        }

        const lyricIndex = this.currentLyricIndex;
        const currentLyric = this.currentLyrics[lyricIndex];
        this.currentLyricIndex = (this.currentLyricIndex + 1) % this.currentLyrics.length;

        // The proto writer requires every custom status field to be set
        const customStatus = {
            text: currentLyric,
            emojiId: 0n,
            emojiName: '',
            expiresAtMs: 0n,
        };

        // Only add emoji if both ID and name are provided
        if (this.emojiId && this.emojiName) {
            if (!/^\d+$/.test(this.emojiId)) {
                this.fail("Emoji ID must contain only numbers");
                return;
            }
            customStatus.emojiId = BigInt(this.emojiId);
            customStatus.emojiName = this.emojiName;
        }

        const encoded = PreloadedUserSettings.toBase64({
            status: {
                status: { value: this.discordStatus },
                customStatus,
            },
        });

        const options: RequestInit = {
            method: 'PATCH',
            headers: {
                'Authorization': this.discordToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings: encoded })
        };

        try {
            const response = await fetch('https://discord.com/api/v9/users/@me/settings-proto/1', options);
            if (this.stopped) return;
            if (response.status === 401 || response.status === 403) {
                this.fail("Discord rejected your token. Update it under Update API Keys.");
                return;
            }
            if (response.status === 429) {
                const retryMs = await this.getRetryAfterMs(response);
                this.pausedUntil = Date.now() + retryMs;
                // Retry this same lyric once the pause is over, rather than skipping it.
                this.currentLyricIndex = lyricIndex;
                const secs = Math.ceil(retryMs / 1000);
                this.onError?.(`Discord is rate-limiting updates; pausing ${secs}s. Use a larger update interval to avoid this.`, false);
                return;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log(`Status updated to: ${currentLyric} (${this.discordStatus})`);
            if (this.onStatusUpdate) {
                this.onStatusUpdate(currentLyric);
            }
        } catch (error) {
            console.error("Error updating Discord status:", error);
            if (!this.stopped) {
                this.onError?.(`Could not update Discord status: ${(error as Error).message}`, false);
            }
        }
    }
}
