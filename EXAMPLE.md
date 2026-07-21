# ArtyMD Capabilities Verification File

This document contains complex elements (advanced **Mermaid diagrams** and **KaTeX math formulas**) designed to verify the status and correctness of the rendering pipelines within the application.

---

## 1. Mathematical Rendering (KaTeX)

Here we test both **inline** math formulas and **display block** equations.

### 1.1 Inline Mathematics
The normal distribution probability density function is represented by $f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{1}{2}\left(\frac{x-\mu}{\sigma}\right)^2}$. 
Euler's famous identity combining five fundamental mathematical constants is: $e^{i\pi} + 1 = 0$.

### 1.2 Complex Display Block Equation
The following block demonstrates multiline systems, matrices, integrals, and limits:

$$\begin{aligned}
\mathbf{A} &= \begin{pmatrix} 
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn} 
\end{pmatrix} \\
\int_{a}^{b} f(x) \, dx &= \lim_{n \to \infty} \sum_{i=1}^{n} f(x_i^*) \Delta x_i \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t}
\end{aligned}$$

---

## 2. Advanced Mermaid Diagram

This system architecture flowchart tests subgraphs, node boundaries, and custom link styling:

```mermaid
flowchart TB
    subgraph Dev [1. Development & Local Verification]
        Code[Write Code] --> Lint[Run Linter]
        Lint --> TestLocal[Unit Tests]
        TestLocal -- Pass --> Commit[Git Commit & Push]
    end

    subgraph CI [2. Continuous Integration Pipeline]
        direction TB
        Hook[GitHub Webhook] --> Checkout[Checkout Code]
        Checkout --> Cache[Restore Dependency Cache]
        Cache --> Build[Production Build & Compiles]
        Build -- Build Error --> NotifySlack[Notify Developers]
        Build -- Build OK --> Static[Static Analysis]
        Static --> Security[OWASP Dependency Scan]
    end

    subgraph QA [3. Automated Testing Suite]
        direction LR
        Security -- Scan Passed --> BrowserTests[[Playwright E2E]]
        BrowserTests --> ApiTests[[Integration REST API]]
        ApiTests -- Tests Failed --> RollbackHook[Auto-Rollback Trigger]
    end

    subgraph CD [4. Continuous Deployment Staging]
        direction TB
        ApiTests -- Tests Passed --> Docker[Dockerize App]
        Docker --> PushRegistry[(Docker Hub Registry)]
        PushRegistry --> DeployStaging[Deploy to Staging K8s]
        DeployStaging --> HealthCheck[Automated Health Checks]
    end

    subgraph Prod [5. Production Release]
        direction LR
        HealthCheck -- Healthy --> ManualApproval{Manual Release Gate}
        ManualApproval -- Approve --> DeployProd[Deploy to Production K8s]
        DeployProd --> Canary[Canary Routing 10%]
        Canary --> FullRelease[100% Traffic Rollout]
    end

    %% Global Flows
    Commit ==> Hook
    NotifySlack -. Fix Code .-> Code
    RollbackHook ==> Dev

    %% Custom Styles
    style Code fill:#bbdefb,stroke:#0d47a1,stroke-width:2px,color:#000
    style Docker fill:#e0f7fa,stroke:#006064,stroke-width:2px,color:#000
    style PushRegistry fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#000
    style DeployProd fill:#ffe0b2,stroke:#e65100,stroke-width:3px,color:#000
    style RollbackHook fill:#ffebee,stroke:#b71c1c,stroke-width:2px,color:#000
    style ManualApproval fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000

    %% Customize subgraph backgrounds
    classDef stage fill:#f9f9f9,stroke:#e0e0e0,stroke-width:1px,stroke-dasharray: 5 5;
    class Dev,CI,QA,CD,Prod stage;
```

---

## 3. Standard Layout Verification

Check table layouts and list nesting:

| Component | Technology | Role |
| :--- | :---: | :--- |
| **View UI** | Svelte 5 | Layout, Zoom/Pan & File Watchers |
| **Math Renderer** | KaTeX | High-performance LaTeX formatting |
| **Diagram Engine** | Mermaid.js | Declarative text-to-diagram converter |

- Supported Features:
  - Custom tabs for multiple concurrent open documents.
  - Debounced auto-reload when the active file is modified externally.
  - Styled Print / PDF exporting system.
