# OpenTransit Mock Service

A sophisticated vehicle event simulator for the Open Transit Map system that generates realistic vehicle position data and publishes it to Valkey streams for testing and development purposes.

## 🚀 **Features**

### **Core Functionality**
- **Realistic Vehicle Simulation**: Multiple movement patterns (circular, random, realistic)
- **Event Publishing**: Publishes both vehicle upsert and removal events
- **Configurable Behavior**: Extensive configuration options via environment variables
- **Health Monitoring**: Built-in health check and metrics endpoints
- **Graceful Shutdown**: Proper cleanup and resource management

### **Movement Patterns**
- **Circular**: Vehicles move in circular patterns around a center point
- **Random**: Vehicles perform random walks within a defined radius
- **Realistic**: Vehicles with variable speeds, stops, and direction changes

### **Event Types**
- **Vehicle Upsert**: Position updates for active vehicles
- **Vehicle Removal**: Random removal of vehicles based on configurable probability

## 📋 **Configuration**

The service is configured through environment variables with comprehensive validation:

### **Core Settings**
| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VALKEY_URL` | Valkey/Redis connection URL | `redis://valkey:6379` | `redis://localhost:6379` |
| `CITY_ID` | City identifier for events | `nyc` | `san-francisco` |
| `STREAM` | Valkey stream name | `events.normalized` | `events.test` |

### **Simulation Settings**
| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `VEHICLES` | Number of vehicles to simulate | `12` | 1-1000 |
| `INTERVAL_MS` | Publish interval in milliseconds | `1000` | 200-10000 |
| `MOVEMENT_PATTERN` | Movement pattern type | `circular` | `circular`, `random`, `realistic` |
| `VEHICLE_REMOVAL_PROBABILITY` | Probability of vehicle removal per tick | `0.1` | 0.0-1.0 |

### **Movement Area**
| Variable | Description | Default | Range |
|----------|-------------|---------|-------|
| `CENTER_LAT` | Center latitude for movement | `40.75` | -90 to 90 |
| `CENTER_LNG` | Center longitude for movement | `-73.98` | -180 to 180 |
| `RADIUS` | Movement radius in degrees | `0.02` | > 0 |

### **System Settings**
| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `HEALTH_PORT` | Health check server port | `8080` |

## 🏃 **Usage**

### **Development**
```bash
# Install dependencies
corepack yarn install

# Run in development mode
corepack yarn workspace @open-transit-map/opentransit-mock start:dev
```

### **Production**
```bash
# Build the service
corepack yarn workspace @open-transit-map/opentransit-mock build

# Run the service
corepack yarn workspace @open-transit-map/opentransit-mock start
```

### **Docker**
```bash
# Build Docker image
docker build -t opentransit-mock .

# Run with custom configuration
docker run -e VEHICLES=50 -e MOVEMENT_PATTERN=realistic opentransit-mock
```

## 🔧 **Environment Examples**

### **High-Volume Testing**
```bash
export VEHICLES=100
export INTERVAL_MS=500
export MOVEMENT_PATTERN=realistic
export VEHICLE_REMOVAL_PROBABILITY=0.05
export LOG_LEVEL=warn
```

### **Realistic Simulation**
```bash
export VEHICLES=25
export INTERVAL_MS=2000
export MOVEMENT_PATTERN=realistic
export VEHICLE_REMOVAL_PROBABILITY=0.15
export CENTER_LAT=37.7749
export CENTER_LNG=-122.4194
export RADIUS=0.05
```

### **Development Testing**
```bash
export VEHICLES=5
export INTERVAL_MS=1000
export MOVEMENT_PATTERN=circular
export LOG_LEVEL=debug
```

## 📊 **Monitoring**

### **Health Check**
```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "simulator": {
    "isRunning": true,
    "activeVehicles": 12,
    "tick": 150
  }
}
```

### **Metrics**
```bash
curl http://localhost:8080/metrics
```

Response:
```json
{
  "eventsPublished": 1500,
  "eventsFailed": 0,
  "vehiclesActive": 12,
  "vehiclesRemoved": 8,
  "startTime": "2023-01-01T00:00:00.000Z",
  "lastPublishTime": "2023-01-01T00:02:30.000Z"
}
```

## 🏗️ **Architecture**

The service is organized into focused, modular components:

### **Module Structure**
```
src/
├── config/           # Configuration management
│   └── index.ts      # Config schema and validation
├── events/           # Event generation
│   └── event-generator.ts
├── simulator/        # Vehicle simulation
│   ├── vehicle-simulator.ts
│   ├── movement-patterns.ts
│   └── index.ts
├── health/           # Health monitoring
│   ├── health-server.ts
│   └── index.ts
└── main.ts           # Application orchestration
```

### **Components**

#### **Configuration Module (`config/`)**
- Zod-based validation with comprehensive schemas
- Environment variable parsing and type coercion
- Type-safe configuration with defaults
- Centralized configuration management

#### **Event Generation (`events/`)**
- Vehicle upsert event creation
- Vehicle removal event creation
- Event validation and schema compliance
- Timestamp generation utilities

#### **Vehicle Simulator (`simulator/`)**
- **VehicleSimulator**: Core simulation logic and state management
- **MovementPatterns**: Configurable movement algorithms
- Metrics tracking and performance monitoring
- Vehicle lifecycle management (add/remove)

#### **Health Monitoring (`health/`)**
- HTTP health check endpoints
- Metrics collection and reporting
- Service status monitoring
- Graceful server lifecycle management

#### **Main Orchestration (`main.ts`)**
- Application bootstrap and initialization
- Dependency injection and wiring
- Graceful shutdown handling
- Error handling and logging setup

### **Event Flow**
1. **Initialization**: Create vehicles with initial positions
2. **Movement**: Update positions based on movement pattern
3. **Event Generation**: Create upsert events for all active vehicles
4. **Removal Logic**: Randomly remove vehicles based on probability
5. **Publishing**: Send events to Valkey stream
6. **Replenishment**: Add new vehicles to maintain target count

## 🔍 **Logging**

The service uses structured logging with Pino:

```typescript
// Configuration logging
logger.info({ config }, 'Starting OpenTransit Mock service');

// Progress updates
logger.info({
  tick: 150,
  activeVehicles: 12,
  eventsPublished: 1500,
  eventsFailed: 0
}, 'Simulator progress update');

// Error handling
logger.error({ vehicleId, error }, 'Failed to publish vehicle upsert event');
```

## 🧪 **Testing**

### **Unit Tests** (Coming Soon)
- Movement pattern validation
- Event generation testing
- Configuration validation
- Error handling scenarios

### **Integration Tests** (Coming Soon)
- End-to-end event flow
- Valkey stream integration
- Health check validation
- Metrics accuracy

## 🚨 **Error Handling**

### **Connection Errors**
- Automatic retry logic for Valkey connection
- Graceful degradation on connection loss
- Proper error logging and metrics

### **Publishing Errors**
- Individual event failure handling
- Metrics tracking for failed events
- Continued operation despite failures

### **Graceful Shutdown**
- SIGINT/SIGTERM signal handling
- Resource cleanup on exit
- Proper connection closure

## 🔧 **Development**

### **Adding New Movement Patterns**
```typescript
// Add to MovementPatterns class
static customPattern(center: Coordinate, radius: number, t: number, vehicleId: number): Coordinate {
  // Implement custom movement logic
  return { lat: newLat, lng: newLng };
}
```

### **Adding New Event Types**
```typescript
// Create new event payload function
function makeCustomEventPayload(data: any, config: Config): EventEnvelope {
  const evt: CustomEvent = {
    kind: 'custom.event',
    at: nowIso(),
    cityId: config.cityId,
    source: config.source,
    payload: data
  };
  return EventEnvelopeSchema.parse({ schemaVersion: '1', data: evt });
}
```

## 📈 **Performance**

### **Optimizations**
- Parallel event publishing
- Efficient position calculations
- Minimal memory footprint
- Configurable batch sizes

### **Scalability**
- Supports up to 1000 vehicles
- Configurable publish intervals
- Efficient stream trimming
- Memory-conscious design

## 🔒 **Security**

- No sensitive data in logs
- Input validation on all configuration
- Safe error handling
- No external dependencies beyond Valkey

## 📝 **License**

This service is part of the Open Transit Map project and follows the same licensing terms.
