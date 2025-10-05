import { VehicleUpsertEventSchema, VehicleRemoveEventSchema, EventEnvelopeSchema } from '@open-transit-map/types';
import type { EventValidator, EventValidationResult } from '../processor-types.js';
import type { Logger } from 'pino';

/**
 * Default implementation of event validation.
 * 
 * Validates incoming event envelopes and parses them into typed events.
 * Provides detailed validation error messages for debugging.
 * 
 * @class DefaultEventValidator
 * @implements {EventValidator}
 * @since 1.0.0
 */
export class DefaultEventValidator implements EventValidator {
  private readonly logger: Logger;

  /**
   * Creates a new event validator.
   * 
   * @param logger - Logger for validation events
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validates an event envelope.
   * 
   * @param envelope - Event envelope to validate
   * @returns Validation result
   */
  validateEnvelope(envelope: unknown): EventValidationResult {
    try {
      // First, validate the envelope structure
      const parsedEnvelope = EventEnvelopeSchema.parse(envelope);
      
      // Then validate the specific event type
      const eventType = parsedEnvelope.data?.kind;
      
      if (!eventType) {
        return {
          isValid: false,
          errors: ['Event envelope missing data.kind field']
        };
      }

      // Validate based on event type
      let eventValidation;
      switch (eventType) {
        case 'vehicle.upsert':
          eventValidation = VehicleUpsertEventSchema.safeParse(parsedEnvelope.data);
          break;
        case 'vehicle.remove':
          eventValidation = VehicleRemoveEventSchema.safeParse(parsedEnvelope.data);
          break;
        default:
          return {
            isValid: false,
            errors: [`Unsupported event type: ${eventType}`]
          };
      }

      if (eventValidation.success) {
        this.logger.debug({
          eventType,
          cityId: parsedEnvelope.data?.cityId,
          vehicleId: parsedEnvelope.data?.payload?.id
        }, 'Event validation successful');

        return {
          isValid: true,
          event: parsedEnvelope
        };
      } else {
        const errors = eventValidation.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        );

        this.logger.warn({
          eventType,
          errors,
          envelope: parsedEnvelope
        }, 'Event validation failed');

        return {
          isValid: false,
          errors
        };
      }

    } catch (error) {
      const errorMessage = `Envelope validation failed: ${error}`;
      
      this.logger.error({
        error,
        envelope
      }, errorMessage);

      return {
        isValid: false,
        errors: [errorMessage]
      };
    }
  }
}
