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
        RateLimit -->|Validate| Schema[Schema Validation]
        Schema -->|Process| Logic[Business Logic]
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
    participant Val as Validator
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

    CF->>+Val: Validate Request
    Val-->>-CF: Valid Request

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
        API -->|Validate Schema| Parser[Data Parser]
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
    style Metrics fill:#fbb,stroke:#333,stroke-width:2px
```

## Component Interactions

```mermaid
graph TD
    subgraph External Services
        IDB[InfluxDB]
        KV[KV Store]
    end

    subgraph Core Services
        MS[Metrics Service]
        HS[Health Service]
        LS[Logger Service]
        VS[Validation Service]
    end

    subgraph Middleware
        Auth[Authentication]
        RL[Rate Limiter]
        Val[Validator]
    end

    subgraph Handlers
        MH[Measurement Handler]
        HH[Health Handler]
        MetH[Metrics Handler]
        TH[Time Handler]
        VH[Version Handler]
    end

    MH & MetH & HH & TH & VH -->|Use| Auth
    Auth -->|Check| KV
    Auth -->|Next| RL
    RL -->|Check| KV
    RL -->|Next| Val
    Val -->|Validate| VS
    
    MH -->|Write| IDB
    MH & MetH & HH -->|Use| MS
    MS -->|Check| IDB
    MS -->|Check| KV
    HS -->|Use| MS
    
    All -->|Log| LS

    style IDB fill:#bfb,stroke:#333,stroke-width:2px
    style KV fill:#fbb,stroke:#333,stroke-width:2px
    style MS fill:#bbf,stroke:#333,stroke-width:2px
    style LS fill:#fbf,stroke:#333,stroke-width:2px
```

## System States

```mermaid
stateDiagram-v2
    [*] --> Initializing
    Initializing --> Ready: All Components Healthy
    Initializing --> Degraded: Some Components Failed
    
    Ready --> Degraded: Component Failure
    Degraded --> Ready: Components Recovered
    
    Ready --> RateLimited: Too Many Requests
    RateLimited --> Ready: Window Reset
    
    Ready --> Processing: Request Received
    Processing --> Ready: Request Complete
    Processing --> Failed: Request Error
    Failed --> Ready: Error Logged
    
    Ready --> Maintenance: Update Started
    Maintenance --> Ready: Update Complete
    
    Degraded --> Down: Critical Failure
    Down --> Initializing: System Restart
```

## Validation Flow

```mermaid
graph TD
    Request[Request] -->|Extract| Data[Request Data]
    Data -->|Parse| JSON[JSON Data]
    JSON -->|Validate| Schema[Schema Validation]
    
    subgraph Schema Validation
        Required[Check Required Fields]
        Types[Validate Types]
        Ranges[Check Ranges]
        Extra[Check Extra Fields]
    end
    
    Schema -->|Valid| Process[Process Request]
    Schema -->|Invalid| Error[Return Error]
    
    style Request fill:#f9f,stroke:#333,stroke-width:2px
    style Schema fill:#bbf,stroke:#333,stroke-width:2px
    style Process fill:#bfb,stroke:#333,stroke-width:2px
    style Error fill:#fbb,stroke:#333,stroke-width:2px
