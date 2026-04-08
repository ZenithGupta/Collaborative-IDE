# Soft Goal Interdependency (SIG) Diagram - Collaborative IDE

## Overview
This diagram shows the relationships between non-functional requirements (soft goals) for the Collaborative IDE system.

## Legend
- `++` = Strong positive contribution (MAKE)
- `+` = Positive contribution (HELP)
- `-` = Negative contribution (HURT)
- `--` = Strong negative contribution (BREAK)
- `AND` = All sub-goals must be satisfied
- `OR` = At least one sub-goal must be satisfied

---

## SIG Diagram

```mermaid
flowchart TB
    %% Main Quality Goals
    UserSatisfaction([☁️ <b>User Satisfaction</b>])
    
    %% Primary Soft Goals
    Usability([☁️ Usability])
    Performance([☁️ Performance])
    Security([☁️ Security])
    Reliability([☁️ Reliability])
    Collaboration([☁️ Real-time Collaboration])
    Maintainability([☁️ Maintainability])
    
    %% Sub-goals
    EaseOfUse([☁️ Ease of Use])
    Learnability([☁️ Learnability])
    ResponseTime([☁️ Fast Response Time])
    CodeExecution([☁️ Fast Code Execution])
    DataProtection([☁️ Data Protection])
    Authentication([☁️ Secure Authentication])
    SystemUptime([☁️ System Uptime])
    ErrorHandling([☁️ Error Handling])
    LiveSync([☁️ Live Code Sync])
    UserPresence([☁️ User Presence Awareness])
    CodeQuality([☁️ Code Quality])
    Modularity([☁️ Modularity])

    %% Decomposition (AND/OR relationships)
    Usability -.->|AND| EaseOfUse
    Usability -.->|AND| Learnability
    
    Performance -.->|AND| ResponseTime
    Performance -.->|AND| CodeExecution
    
    Security -.->|AND| DataProtection
    Security -.->|AND| Authentication
    
    Reliability -.->|AND| SystemUptime
    Reliability -.->|AND| ErrorHandling
    
    Collaboration -.->|AND| LiveSync
    Collaboration -.->|AND| UserPresence
    
    Maintainability -.->|AND| CodeQuality
    Maintainability -.->|AND| Modularity

    %% Contribution Links to User Satisfaction
    Usability -->|++| UserSatisfaction
    Performance -->|+| UserSatisfaction
    Security -->|+| UserSatisfaction
    Reliability -->|++| UserSatisfaction
    Collaboration -->|++| UserSatisfaction
    
    %% Inter-goal Contributions
    Collaboration -->|++| Usability
    Performance -->|+| Collaboration
    LiveSync -->|+| ResponseTime
    
    %% Negative Contributions (Trade-offs)
    Security -->|-| Performance
    Authentication -->|-| EaseOfUse
    DataProtection -->|-| ResponseTime
    
    %% Positive Contributions
    ErrorHandling -->|+| Usability
    Modularity -->|+| Reliability
    CodeQuality -->|+| Reliability

    %% Styling
    style UserSatisfaction fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Usability fill:#2196F3,stroke:#1565C0,color:#fff
    style Performance fill:#FF9800,stroke:#EF6C00,color:#fff
    style Security fill:#F44336,stroke:#C62828,color:#fff
    style Reliability fill:#9C27B0,stroke:#6A1B9A,color:#fff
    style Collaboration fill:#00BCD4,stroke:#00838F,color:#fff
    style Maintainability fill:#795548,stroke:#4E342E,color:#fff
```

---

## Soft Goals Summary Table

| Soft Goal | Type | Description |
|-----------|------|-------------|
| **User Satisfaction** | Top Goal | Ultimate quality objective |
| **Usability** | Primary | System is easy to use and learn |
| **Performance** | Primary | System responds quickly |
| **Security** | Primary | User data and code is protected |
| **Reliability** | Primary | System is stable and available |
| **Real-time Collaboration** | Primary | Multiple users can work together |
| **Maintainability** | Primary | System is easy to maintain/extend |

---

## Key Trade-offs

1. **Security vs Performance**: Strong encryption and authentication add latency
2. **Authentication vs Ease of Use**: More secure login = more steps for users
3. **Data Protection vs Response Time**: Encrypting data slows down sync

---

## How to Recreate in StarUML

1. **Create oval/ellipse shapes** for each soft goal (use UseCase elements)
2. **Use Dependency arrows** for contribution links
3. **Label arrows** with `++`, `+`, `-`, `--`
4. **Use dashed lines** for AND/OR decomposition
5. **Color code** by category (optional)

### Element Count:
- **6 Primary Soft Goals** (blue/colored ovals)
- **12 Sub-goals** (smaller ovals)
- **~20 Contribution links** (arrows with labels)
