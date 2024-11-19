import { PreloadedUserSettings } from 'discord-protos';
import lyricsFinder from 'lyrics-finder';

interface StatusUpdaterConfig {
    discordToken: string;
    emojiId?: string;
    emojiName?: string;
    artist: string;
    title: string;
    updateInterval?: number;
    onLyricsLoaded?: (lyrics: string[]) => void;
    onStatusUpdate?: (lyric: string) => void;
}

export class StatusUpdater {
    private currentLyricIndex: number = 0;
    private lastUpdateTime: number = 0;
    private readonly updateInterval: number;
    private readonly discordToken: string;
    private readonly emojiId?: string;
    private readonly emojiName?: string;
    private currentLyrics: string[] = [];
    private updateIntervalId?: NodeJS.Timeout;
    private readonly artist: string;
    private readonly title: string;
    private readonly onLyricsLoaded?: (lyrics: string[]) => void;
    private readonly onStatusUpdate?: (lyric: string) => void;

    constructor(config: StatusUpdaterConfig) {
        this.discordToken = config.discordToken;
        this.emojiId = config.emojiId;
        this.emojiName = config.emojiName;
        this.artist = config.artist;
        this.title = config.title;
        this.updateInterval = config.updateInterval || 10000;
        this.onLyricsLoaded = config.onLyricsLoaded;
        this.onStatusUpdate = config.onStatusUpdate;
        this.fetchAndSetLyrics();
    }

    public stop(): void {
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = undefined;
        }
    }

    private async fetchAndSetLyrics(): Promise<void> {
        const lyrics = await this.fetchLyrics(this.title, this.artist);
        if (lyrics) {
            this.currentLyrics = this.splitLyrics(lyrics);
            console.log("Lyrics loaded:", this.currentLyrics);
            if (this.onLyricsLoaded) {
                this.onLyricsLoaded(this.currentLyrics);
            }
            this.startPeriodicUpdate();
        } else {
            throw new Error("Failed to fetch lyrics");
        }
    }

    private splitLyrics(lyrics: string): string[] {
        return lyrics.split('\n').flatMap(line => {
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
        });
    }

    private startPeriodicUpdate(): void {
        this.updateIntervalId = setInterval(() => this.updateDiscordStatus(), this.updateInterval);
    }

    private async fetchLyrics(title: string, artist: string): Promise<string | null> {
        try {
            const lyrics = await lyricsFinder(artist, title);
            return lyrics || null;
        } catch (error) {
            console.error("Error fetching lyrics:", error);
            return null;
        }
    }

    private async updateDiscordStatus(): Promise<void> {
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }

        const currentLyric = this.currentLyrics[this.currentLyricIndex];
        this.currentLyricIndex = (this.currentLyricIndex + 1) % this.currentLyrics.length;

        if (!currentLyric) {
            console.error("No lyric available for update");
            return;
        }

        if (this.onStatusUpdate) {
            this.onStatusUpdate(currentLyric);
        }

        const customStatus = {
            text: currentLyric,
            expiresAtMs: 0n,
        } as any;

        // Only add emoji if both ID and name are provided
        if (this.emojiId && this.emojiName) {
            customStatus.emojiId = BigInt(this.emojiId);
            customStatus.emojiName = this.emojiName;
        }

        const encoded = PreloadedUserSettings.toBase64({
            status: {
                status: { value: "online" },
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
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.lastUpdateTime = now;
            console.log(`Status updated to: ${currentLyric}`);
        } catch (error) {
            console.error("Error updating Discord status:", error);
        }
    }
}
