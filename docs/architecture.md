# System Architecture

## High-Level Architecture

```mermaid
graph TD
    Client[Client Devices] -->|HTTPS| CF[Cloudflare Workers]
    CF -->|Rate Limit Check| KV1[KV Store: METRICS]
    CF -->|Auth Check| KV2[KV Store: API_KEYS]
    CF -->|Write Data| IDB[InfluxDB]
    
    subgraph Cloudflare Workers
        Handler[Request Handler] -->|Validate| Auth[Authentication]
        Auth -->|Check| RateLimit[Rate Limiter]
        RateLimit -->|Process| Logic[Business Logic]
        Logic -->|Log| Logger[Logger Service]
        Logic -->|Store| MetricsService[Metrics Service]
        Logic -->|Check| Health[Health Service]
    end

    style Client fill:#f9f,stroke:#333,stroke-width:2px
    style CF fill:#bbf,stroke:#333,stroke-width:2px
    style IDB fill:#bfb,stroke:#333,stroke-width:2px
    style KV1 fill:#fbb,stroke:#333,stroke-width:2px
    style KV2 fill:#fbb,stroke:#333,stroke-width:2px
```

## Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant CF as Cloudflare Worker
    participant Auth as Auth Service
    participant RL as Rate Limiter
    participant KV as KV Store
    participant IDB as InfluxDB
    participant Log as Logger

    C->>+CF: HTTP Request
    CF->>+Auth: Validate API Key
    Auth->>+KV: Check API Key
    KV-->>-Auth: Key Valid
    Auth-->>-CF: Authenticated

    CF->>+RL: Check Rate Limit
    RL->>+KV: Get Current Count
    KV-->>-RL: Count
    RL-->>-CF: Within Limit

    CF->>+IDB: Process Request
    IDB-->>-CF: Success

    CF->>+Log: Log Request
    Log-->>-CF: Logged

    CF-->>-C: HTTP Response
```

## Rate Limiting Design

```mermaid
graph LR
    Request[New Request] -->|Check| Window[Current Window]
    Window -->|Calculate| Weight[Window Weight]
    
    subgraph Sliding Window
        Weight -->|Sum| Total[Total Requests]
        Previous[Previous Window] -->|Weight * Overlap| Total
    end
    
    Total -->|Compare| Limit[Rate Limit]
    Limit -->|Yes| Allow[Allow Request]
    Limit -->|No| Block[Block Request]

    style Request fill:#f9f,stroke:#333,stroke-width:2px
    style Window fill:#bbf,stroke:#333,stroke-width:2px
    style Allow fill:#bfb,stroke:#333,stroke-width:2px
    style Block fill:#fbb,stroke:#333,stroke-width:2px
```

## Data Flow

```mermaid
graph TD
    Device[IoT Device] -->|Send Data| API[API Endpoint]
    
    subgraph Data Processing
        API -->|Validate| Parser[Data Parser]
        Parser -->|Transform| Protocol[Line Protocol]
        Protocol -->|Write| Buffer[Write Buffer]
    end
    
    Buffer -->|Batch Write| IDB[InfluxDB]
    
    subgraph Monitoring
        API -->|Record| Metrics[Metrics Service]
        API -->|Log| Logger[Logger Service]
        Metrics --> Health[Health Check]
    end

    style Device fill:#f9f,stroke:#333,stroke-width:2px
    style API fill:#bbf,stroke:#333,stroke-width:2px
    style IDB fill:#bfb,stroke:#333,stroke-width:2px
    style Health fill:#fbb,stroke:#333,stroke-width:2px
```

## Component Interaction

```mermaid
graph TD
    subgraph External Services
        IDB[InfluxDB]
        KV[KV Store]
    end
    
    subgraph Core Services
        Health[Health Service]
        Metrics[Metrics Service]
        Logger[Logger Service]
        RateLimit[Rate Limiter]
    end
    
    subgraph Request Handling
        Router[Request Router]
        Auth[Authentication]
        Validation[Request Validation]
        Handler[Request Handler]
    end
    
    Router -->|Route| Handler
    Handler -->|Check| Auth
    Handler -->|Validate| Validation
    Handler -->|Check| RateLimit
    Handler -->|Use| Core Services
    Core Services -->|Use| External Services

    style External Services fill:#f9f,stroke:#333,stroke-width:4px
    style Core Services fill:#bbf,stroke:#333,stroke-width:4px
    style Request Handling fill:#bfb,stroke:#333,stroke-width:4px
```

## System States

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: Receive Request
    
    state Processing {
        [*] --> Authentication
        Authentication --> RateLimitCheck
        RateLimitCheck --> DataValidation
        DataValidation --> DataProcessing
        DataProcessing --> ResponsePreparation
    }
    
    Processing --> Idle: Send Response
    Processing --> Error: Failure
    Error --> Idle: Error Response
    
    state Error {
        [*] --> LogError
        LogError --> PrepareErrorResponse
    }
```
