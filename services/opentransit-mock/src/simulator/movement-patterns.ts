/**
 * Geographic coordinate (WGS84 degrees).
 */
export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Movement pattern implementations for different vehicle behaviors.
 */
export class MovementPatterns {
  /**
   * Circular movement around a center point.
   * Vehicles move in smooth circular paths with individual offsets.
   * 
   * @param center - Center point for the circular movement
   * @param radius - Radius of the circle in degrees
   * @param t - Time parameter for animation
   * @param vehicleId - Unique identifier for vehicle-specific offset
   * @returns New coordinate position
   */
  static circular(center: Coordinate, radius: number, t: number, vehicleId: number): Coordinate {
    const angle = t + vehicleId * 0.5; // Offset each vehicle
    return {
      lat: center.lat + Math.sin(angle) * radius,
      lng: center.lng + Math.cos(angle) * radius,
    };
  }

  /**
   * Random walk movement within a radius.
   * Vehicles perform pseudo-random walks with smooth transitions.
   * 
   * @param center - Center point for the random walk
   * @param radius - Maximum distance from center
   * @param t - Time parameter for animation
   * @param vehicleId - Unique identifier for vehicle-specific behavior
   * @returns New coordinate position
   */
  static random(center: Coordinate, radius: number, t: number, vehicleId: number): Coordinate {
    const randomFactor = Math.sin(t * 0.1 + vehicleId) * 0.5 + 0.5;
    const angle = (t + vehicleId) * randomFactor;
    const distance = radius * (0.3 + randomFactor * 0.7);
    
    return {
      lat: center.lat + Math.sin(angle) * distance,
      lng: center.lng + Math.cos(angle) * distance,
    };
  }

  /**
   * More realistic movement with stops and direction changes.
   * Simulates real vehicle behavior with speed variations and stops.
   * 
   * @param center - Center point for the movement area
   * @param radius - Maximum distance from center
   * @param t - Time parameter for animation
   * @param vehicleId - Unique identifier for vehicle-specific behavior
   * @returns New coordinate position
   */
  static realistic(center: Coordinate, radius: number, t: number, vehicleId: number): Coordinate {
    const baseAngle = t * 0.1 + vehicleId;
    const speedVariation = Math.sin(t * 0.05 + vehicleId) * 0.3 + 0.7;
    const directionChange = Math.sin(t * 0.02 + vehicleId * 2) * 0.5;
    
    const angle = baseAngle + directionChange;
    const distance = radius * speedVariation;
    
    return {
      lat: center.lat + Math.sin(angle) * distance,
      lng: center.lng + Math.cos(angle) * distance,
    };
  }
}
