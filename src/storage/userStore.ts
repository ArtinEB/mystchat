import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { logger } from '../utils/logger.js';

export interface BotStats {
  totalUsers: number;
  totalMessagesSent: number;
  uptimeSeconds: number;
}

export class UserStore {
  private static instance: UserStore | null = null;
  private usersSet: Set<number> = new Set();
  private messagesCount: number = 0;
  private startTime: number = Date.now();
  private filePath: string;
  private kvUrl?: string;
  private kvToken?: string;
  private isLoaded: boolean = false;

  constructor() {
    const dataDir = process.env.DATA_DIR || (process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), 'data'));
    this.filePath = path.join(dataDir, 'mystchat_users.json');

    this.kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    this.kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  static getInstance(): UserStore {
    if (!UserStore.instance) {
      UserStore.instance = new UserStore();
    }
    return UserStore.instance;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    this.isLoaded = true;

    // 1. Try Upstash KV if configured
    if (this.kvUrl && this.kvToken) {
      try {
        const res = await fetch(`${this.kvUrl}/smembers/mystchat:users`, {
          headers: { Authorization: `Bearer ${this.kvToken}` }
        });
        if (res.ok) {
          const data = (await res.json()) as { result?: string[] };
          if (Array.isArray(data.result)) {
            for (const id of data.result) {
              const num = Number(id);
              if (num > 0) this.usersSet.add(num);
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to load users from Upstash KV', { err });
      }
    }

    // 2. Try Local File Storage
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data.users)) {
        for (const id of data.users) {
          if (typeof id === 'number' && id > 0) {
            this.usersSet.add(id);
          }
        }
      }
      if (typeof data.messagesCount === 'number') {
        this.messagesCount = data.messagesCount;
      }
    } catch {
      // File doesn't exist yet or not readable
    }
  }

  private async persist(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const payload = JSON.stringify(
        {
          users: Array.from(this.usersSet),
          messagesCount: this.messagesCount,
          lastUpdated: new Date().toISOString()
        },
        null,
        2
      );
      await fs.writeFile(this.filePath, payload, 'utf-8');
    } catch (err) {
      logger.warn('Could not write users to local storage', { err });
    }
  }

  async trackUser(userId: number): Promise<void> {
    if (!userId || typeof userId !== 'number' || userId <= 0) return;

    await this.ensureLoaded();

    if (!this.usersSet.has(userId)) {
      this.usersSet.add(userId);

      // Async write to KV if configured
      if (this.kvUrl && this.kvToken) {
        fetch(`${this.kvUrl}/sadd/mystchat:users/${userId}`, {
          headers: { Authorization: `Bearer ${this.kvToken}` }
        }).catch((err) => logger.warn('Failed to add user to KV', { err }));
      }

      await this.persist();
    }
  }

  async recordMessageSent(): Promise<void> {
    await this.ensureLoaded();
    this.messagesCount++;

    if (this.kvUrl && this.kvToken) {
      fetch(`${this.kvUrl}/incr/mystchat:messages_count`, {
        headers: { Authorization: `Bearer ${this.kvToken}` }
      }).catch(() => {});
    }

    await this.persist();
  }

  async getAllUserIds(): Promise<number[]> {
    await this.ensureLoaded();
    return Array.from(this.usersSet);
  }

  async getStats(): Promise<BotStats> {
    await this.ensureLoaded();
    return {
      totalUsers: this.usersSet.size,
      totalMessagesSent: this.messagesCount,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}
