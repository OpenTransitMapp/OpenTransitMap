import { describe, it, expect } from 'vitest';
import { MovementPatterns, type Coordinate } from '../../simulator/movement-patterns.js';

describe('MovementPatterns', () => {
  const center: Coordinate = { lat: 40.75, lng: -73.98 };
  const radius = 0.01;

  describe('circular', () => {
    it('should generate circular movement around center', () => {
      const t1 = 0;
      const t2 = Math.PI / 2; // 90 degrees
      const t3 = Math.PI; // 180 degrees
      const t4 = 3 * Math.PI / 2; // 270 degrees

      const pos1 = MovementPatterns.circular(center, radius, t1, 0);
      const pos2 = MovementPatterns.circular(center, radius, t2, 0);
      const pos3 = MovementPatterns.circular(center, radius, t3, 0);
      const pos4 = MovementPatterns.circular(center, radius, t4, 0);

      // Check that positions form a circle
      expect(pos1.lat).toBeCloseTo(center.lat, 5);
      expect(pos1.lng).toBeCloseTo(center.lng + radius, 5);

      expect(pos2.lat).toBeCloseTo(center.lat + radius, 5);
      expect(pos2.lng).toBeCloseTo(center.lng, 5);

      expect(pos3.lat).toBeCloseTo(center.lat, 5);
      expect(pos3.lng).toBeCloseTo(center.lng - radius, 5);

      expect(pos4.lat).toBeCloseTo(center.lat - radius, 5);
      expect(pos4.lng).toBeCloseTo(center.lng, 5);
    });

    it('should offset vehicles by vehicleId', () => {
      const t = 0;
      const pos1 = MovementPatterns.circular(center, radius, t, 0);
      const pos2 = MovementPatterns.circular(center, radius, t, 1);

      // Different vehicles should have different positions
      expect(pos1).not.toEqual(pos2);
    });

    it('should stay within radius of center', () => {
      const positions = Array.from({ length: 100 }, (_, i) => 
        MovementPatterns.circular(center, radius, i * 0.1, 0)
      );

      positions.forEach(pos => {
        const distance = Math.sqrt(
          Math.pow(pos.lat - center.lat, 2) + Math.pow(pos.lng - center.lng, 2)
        );
        expect(distance).toBeLessThanOrEqual(radius + 0.001); // Small tolerance for floating point
      });
    });
  });

  describe('random', () => {
    it('should generate random movement within radius', () => {
      const positions = Array.from({ length: 100 }, (_, i) => 
        MovementPatterns.random(center, radius, i * 0.1, 0)
      );

      positions.forEach(pos => {
        const distance = Math.sqrt(
          Math.pow(pos.lat - center.lat, 2) + Math.pow(pos.lng - center.lng, 2)
        );
        expect(distance).toBeLessThanOrEqual(radius + 0.001);
      });
    });

    it('should produce different patterns for different vehicles', () => {
      const positions1 = Array.from({ length: 10 }, (_, i) => 
        MovementPatterns.random(center, radius, i * 0.1, 0)
      );
      const positions2 = Array.from({ length: 10 }, (_, i) => 
        MovementPatterns.random(center, radius, i * 0.1, 1)
      );

      // Should be different patterns
      expect(positions1).not.toEqual(positions2);
    });

    it('should vary distance from center', () => {
      const positions = Array.from({ length: 50 }, (_, i) => 
        MovementPatterns.random(center, radius, i * 0.1, 0)
      );

      const distances = positions.map(pos => 
        Math.sqrt(
          Math.pow(pos.lat - center.lat, 2) + Math.pow(pos.lng - center.lng, 2)
        )
      );

      // Should have variation in distances
      const minDistance = Math.min(...distances);
      const maxDistance = Math.max(...distances);
      expect(maxDistance - minDistance).toBeGreaterThan(0);
    });
  });

  describe('realistic', () => {
    it('should generate realistic movement with speed variations', () => {
      const positions = Array.from({ length: 100 }, (_, i) => 
        MovementPatterns.realistic(center, radius, i * 0.1, 0)
      );

      positions.forEach(pos => {
        const distance = Math.sqrt(
          Math.pow(pos.lat - center.lat, 2) + Math.pow(pos.lng - center.lng, 2)
        );
        expect(distance).toBeLessThanOrEqual(radius + 0.001);
      });
    });

    it('should have different behavior than circular', () => {
      // We'll check multiple times to be sure
      const circularPositions = Array.from({ length: 10 }, (_, i) => 
        MovementPatterns.circular(center, radius, i * 0.1, 0)
      );
      const realisticPositions = Array.from({ length: 10 }, (_, i) => 
        MovementPatterns.realistic(center, radius, i * 0.1, 0)
      );

      expect(circularPositions).not.toEqual(realisticPositions);
    });

    it('should show speed variations over time', () => {
      const positions = Array.from({ length: 100 }, (_, i) => 
        MovementPatterns.realistic(center, radius, i * 0.1, 0)
      );

      // Calculate distances between consecutive positions
      const distances = [];
      for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1];
        const curr = positions[i];
        const distance = Math.sqrt(
          Math.pow(curr.lat - prev.lat, 2) + Math.pow(curr.lng - prev.lng, 2)
        );
        distances.push(distance);
      }

      // Should have variation in movement speed
      const minDistance = Math.min(...distances);
      const maxDistance = Math.max(...distances);
      expect(maxDistance - minDistance).toBeGreaterThan(0);
    });
  });

  describe('all patterns', () => {
    it('should return valid coordinates', () => {
      const patterns = ['circular', 'random', 'realistic'] as const;
      
      patterns.forEach(pattern => {
        const pos = MovementPatterns[pattern](center, radius, 0, 0);
        
        expect(pos).toHaveProperty('lat');
        expect(pos).toHaveProperty('lng');
        expect(typeof pos.lat).toBe('number');
        expect(typeof pos.lng).toBe('number');
        expect(Number.isFinite(pos.lat)).toBe(true);
        expect(Number.isFinite(pos.lng)).toBe(true);
      });
    });

    it('should handle zero radius', () => {
      const patterns = ['circular', 'random', 'realistic'] as const;
      
      patterns.forEach(pattern => {
        const pos = MovementPatterns[pattern](center, 0, 0, 0);
        
        expect(pos.lat).toBe(center.lat);
        expect(pos.lng).toBe(center.lng);
      });
    });

    it('should handle large radius', () => {
      const largeRadius = 1.0; // 1 degree
      const patterns = ['circular', 'random', 'realistic'] as const;
      
      patterns.forEach(pattern => {
        const pos = MovementPatterns[pattern](center, largeRadius, 0, 0);
        
        const distance = Math.sqrt(
          Math.pow(pos.lat - center.lat, 2) + Math.pow(pos.lng - center.lng, 2)
        );
        expect(distance).toBeLessThanOrEqual(largeRadius + 0.001);
      });
    });
  });
});
