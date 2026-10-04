/**
 * Small token-bucket rate limiter. In-memory only, one bucket per key.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMinute: number,
    now = Date.now(),
  ) {
    this.tokens = capacity;
    this.last = now;
  }

  take(cost = 1, now = Date.now()): boolean {
    const elapsed = Math.max(0, now - this.last) / 60_000;
    this.last = now;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillPerMinute,
    );
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

export class RateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly seenAt = new Map<string, number>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerMinute: number,
    private readonly ttlMs = 15 * 60_000,
  ) {}

  allow(key: string, cost = 1, now = Date.now()): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillPerMinute, now);
      this.buckets.set(key, bucket);
    }
    this.seenAt.set(key, now);
    return bucket.take(cost, now);
  }

  cleanup(now = Date.now()): void {
    for (const [key, seen] of this.seenAt) {
      if (now - seen > this.ttlMs) {
        this.seenAt.delete(key);
        this.buckets.delete(key);
      }
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
