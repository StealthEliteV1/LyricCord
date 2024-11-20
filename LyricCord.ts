import { PreloadedUserSettings } from 'discord-protos';
import lyricsFinder from 'lyrics-finder';
import { Client as GeniusClient } from 'genius-lyrics';

interface StatusUpdaterConfig {
    discordToken: string;
    emojiId?: string;
    emojiName?: string;
    artist: string;
    title: string;
    updateInterval?: number;
    onLyricsLoaded?: (lyrics: string[]) => void;
    onStatusUpdate?: (lyric: string) => void;
    geniusApiKey?: string;
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
    private readonly geniusApiKey?: string;

    constructor(config: StatusUpdaterConfig) {
        this.discordToken = config.discordToken;
        this.emojiId = config.emojiId;
        this.emojiName = config.emojiName;
        this.artist = config.artist;
        this.title = config.title;
        this.updateInterval = config.updateInterval || 10000;
        this.onLyricsLoaded = config.onLyricsLoaded;
        this.onStatusUpdate = config.onStatusUpdate;
        this.geniusApiKey = config.geniusApiKey;
        this.fetchAndSetLyrics();
    }

    public stop(): void {
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = undefined;
        }
    }

    private async fetchAndSetLyrics(): Promise<void> {
        try {
            // Try Google lyrics first
            let lyrics = await this.fetchGoogleLyrics();
            
            // If Google fails and we have a Genius API key, try Genius
            if (!lyrics && this.geniusApiKey) {
                console.log("Google lyrics not found, trying Genius...");
                lyrics = await this.fetchGeniusLyrics();
            }

            if (lyrics) {
                this.currentLyrics = this.splitLyrics(lyrics);
                console.log("Lyrics loaded:", this.currentLyrics);
                
                // Make sure we call onLyricsLoaded with the processed lyrics
                if (this.onLyricsLoaded && this.currentLyrics.length > 0) {
                    this.onLyricsLoaded(this.currentLyrics);
                }
                
                this.startPeriodicUpdate();
            } else {
                throw new Error("Failed to fetch lyrics from both Google and Genius");
            }
        } catch (error) {
            console.error("Error in fetchAndSetLyrics:", error);
            throw error;
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

    private async fetchGoogleLyrics(): Promise<string | null> {
        try {
            const lyrics = await lyricsFinder(this.artist, this.title);
            return lyrics || null;
        } catch (error) {
            console.error("Error fetching Google lyrics:", error);
            return null;
        }
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
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }

        if (this.currentLyrics.length === 0) {
            console.error("No lyrics available for update");
            return;
        }

        const currentLyric = this.currentLyrics[this.currentLyricIndex];
        this.currentLyricIndex = (this.currentLyricIndex + 1) % this.currentLyrics.length;

        // Make sure we call onStatusUpdate with the current lyric
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
