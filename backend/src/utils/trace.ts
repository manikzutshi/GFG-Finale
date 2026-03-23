import type { TraceStep } from "@veritas/shared";

export class TraceCollector {
  private readonly steps: TraceStep[] = [];

  async run<T>(
    stage: string,
    action: () => Promise<T> | T,
    meta?: Record<string, unknown> | ((result: T) => Record<string, unknown> | undefined)
  ): Promise<T> {
    const startedAt = new Date();
    const startedMs = Date.now();
    const result = await action();
    const completedAt = new Date();

    this.steps.push({
      stage,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_ms: completedAt.getTime() - startedMs,
      meta: typeof meta === "function" ? meta(result) : meta
    });

    return result;
  }

  list(): TraceStep[] {
    return this.steps;
  }
}
