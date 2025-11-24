# Lead & Appointment Flows: Visual Guide

This guide accompanies the two infographics to explain the distinct workflows for Lead Forwarding and Appointment Routing in the Buyerfound.ai system.

## Image 1: Lead Forwarding Flow
**Focus:** Distributing raw lead data to partners based on rules.

### The Journey (Team Explanation)
This visual represents the **"Firewall & Router"** pattern of our lead distribution system.

1.  **Provider (The Source):**
    *   Leads arrive via HTTP POST from providers like Profitise or Click Ventures.
    *   *System Action:* We normalize phone numbers (+1 format) and deduplicate contacts immediately upon ingestion.

2.  **Master Toggle (The Gatekeeper):**
    *   Located at the `webhook_config` level.
    *   *Function:* Acts as a master kill-switch. If disabled, **NO** rules are evaluated. This allows us to instantly stop all forwarding for a specific source without editing individual rules.

3.  **Rules Engine (The Brain):**
    *   **Logic:** Uses **AND** logic for filtering. A lead must match **Product** AND **Zip** AND **State** to trigger a rule.
    *   **Priority:** Rules are processed sequentially (1, 2, 3...).
    *   **Multi-Forwarding:** Crucially, the system does *not* stop at the first match (unless configured to). A single lead can trigger Rule #1 (Solar Partner A) and Rule #2 (Solar Partner B) if it matches both criteria.

4.  **Partner Webhook (The Destination):**
    *   **Delivery:** We send the *original* payload plus enriched metadata (headers like `X-Forwarded-From`, `X-Original-Lead-Id`).
    *   **Reliability:** Every attempt is logged in `lead_forwarding_log` with full request/response data for debugging.

---

## Image 2: Appointment Routing Flow
**Focus:** Assigning scheduled appointments to specific client workspaces.

### The Journey
1.  **Provider:** Sends a confirmed appointment (Calendar data).
2.  **Routing Logic:**
    *   **Path A (Direct):** If a `workspace_id` is provided in the payload, it bypasses rules and routes directly to that workspace.
    *   **Path B (Rule Match):** If no ID is provided, it searches for a matching workspace based on:
        *   **Product Type**
        *   **Zip Code**
3.  **Client Workspace:** The appointment is assigned to the matching Workspace (e.g., "Solar West Coast Team") and forwarded to their system.

---
*Watermark: Buyerfound.ai*

## Image 3: Appointment-as-a-Service Pipeline
**Focus:** End-to-End flow from Lead Ingestion to Billing.

### The Pipeline
1.  **Lead Ingestion:** Leads arrive from various providers (Solar, HVAC, etc.).
2.  **Processing:** Data is normalized and stored in the D1 Database.
3.  **Routing Engine:** The core brain matches appointments to workspaces based on rules.
4.  **Forwarding:** Appointments are delivered to client systems via webhooks.
5.  **Tracking:** The system tracks delivery success and generates billing events.

---

## Image 4: Appointment Data Relationships
**Focus:** How data entities are linked in the database.

### The Schema
*   **Providers** source **Contacts**.
*   **Contacts** have multiple **Leads**.
*   **Leads** convert into **Appointments**.
*   **Routing Rules** and **Workspaces** determine where **Appointments** go.
