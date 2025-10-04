/**
 * Stream/bus topic names used across the ingest/processing pipeline.
 *
 * Aligns with ADR‑0002. These constants are implementation‑agnostic so we can
 * back them with Valkey Streams or any other transport without touching
 * business logic.
 *
 * @public
 */
export const Topics = {
  // Canonical normalized events (vehicle upserts/removes)
  EventsNormalized: 'events.normalized',
  // Reduced changes for clients (optional)
  StateDelta: 'state.delta',
} as const;

export type Topic = typeof Topics[keyof typeof Topics];

/**
 * Default consumer group names for stream transports.
 *
 * @remarks
 * Groups reflect pipeline stages: normalizer → processor → broadcaster.
 */
export const ConsumerGroups = {
  Normalizer: 'normalizer',
  Processor: 'processor',
  Broadcaster: 'broadcaster',
} as const;
