# Webhook TUI Integration Design

**Date:** 2025-12-15
**Status:** Approved

## Overview

Add webhook management UI to the TUI client with delivery tracking and retry logic. This brings feature parity closer to UptimeKuma for notifications.

## Scope

- **In scope:** TUI webhook CRUD, delivery logging, retry system, expanded event types
- **Out of scope:** Signing secrets, custom headers (deferred to future iteration)

---

## Event Types

### Current
- `up`, `down`, `created`, `updated`, `deleted`

### New Status Variants
- `degraded` - Response time exceeds threshold but still responding
- `timeout` - No response within configured timeout
- `error` - Connection/DNS/SSL errors

### New Lifecycle Events
- `paused` - Monitoring disabled for target
- `resumed` - Monitoring re-enabled for target
- `certificate_expiring` - SSL cert expires within 14 days (HTTP targets only)

---

## Database Changes

### New Table: `webhook_deliveries`

```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  response_code INTEGER,
  response_body TEXT,  -- truncated to 1KB
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX webhook_deliveries_webhook_id_idx ON webhook_deliveries(webhook_id);
CREATE INDEX webhook_deliveries_pending_retry_idx ON webhook_deliveries(status, next_retry_at)
  WHERE status = 'pending';
```

### Schema Updates

Update `eventTypeSchema` in shared package to include new event types.

---

## Retry Logic

### Configuration
- Max attempts: 4 (1 initial + 3 retries)
- Backoff: 10s, 30s, 90s (exponential)

### Flow
1. Event created → Insert delivery row with `status: 'pending'`
2. Attempt delivery immediately
3. On success → `status: 'success'`, store response code/time
4. On failure → `attempts++`, calculate `next_retry_at`, store error
5. After attempt 4 fails → `status: 'failed'`

### Retry Scheduler
- Polls every 5 seconds for deliveries where:
  - `status = 'pending'`
  - `next_retry_at <= NOW()`
  - `attempts < 4`

### Cleanup
- Delete delivery records older than 7 days
- Run on server startup and daily

---

## TUI Navigation

### Tab Structure
```
[Targets] [Webhooks]
```

- `Tab` key or `1`/`2` to switch
- Each tab maintains independent selection state

---

## Webhooks List View

```
┌─ Downtime Monitor ─────────────────────────────────────────┐
│ [Targets] [Webhooks]                                       │
├────────────────────────────────────────────────────────────┤
│ ● Discord Alerts          https://discord.com/api/we...    │
│   Slack Notifications     https://hooks.slack.com/se...    │
│ ○ PagerDuty (disabled)    https://events.pagerduty.c...    │
├────────────────────────────────────────────────────────────┤
│ Events: up, down, error                                    │
│ Last delivery: 2 min ago (success)                         │
│ Recent: ✓✓✓✗✓ (last 5 deliveries)                         │
├────────────────────────────────────────────────────────────┤
│ (a)dd  (e)dit  (d)elete  (t)est  (enter) details          │
└────────────────────────────────────────────────────────────┘
```

### List Columns
- Status indicator: `●` enabled, `○` disabled
- Name (truncated if needed)
- URL (truncated, showing domain)

### Bottom Panel (selected webhook)
- Subscribed events as tags
- Last delivery timestamp + status
- Mini success/fail indicator for last 5 deliveries

---

## Webhook Detail View

Press `Enter` on a webhook:

```
┌─ Webhook: Discord Alerts ──────────────────────────────────┐
│                                                            │
│ URL:      https://discord.com/api/webhooks/1234.../abc     │
│ Status:   ● Enabled                                        │
│ Events:   [up] [down] [error] [timeout]                    │
│ Created:  2024-01-15 10:30                                 │
│                                                            │
├─ Recent Deliveries ────────────────────────────────────────┤
│ ✓ 2 min ago    down     api.example.com       200   12ms  │
│ ✓ 15 min ago   up       api.example.com       200   45ms  │
│ ✗ 1 hour ago   error    db.example.com        500   --    │
│   └─ Retried 3x, last error: Connection refused           │
│ ✓ 2 hours ago  down     cache.example.com     200   23ms  │
│                                                            │
│ Showing 4 of 47 deliveries                                 │
├────────────────────────────────────────────────────────────┤
│ (e)dit  (t)est  (backspace) back  (↑↓) scroll deliveries  │
└────────────────────────────────────────────────────────────┘
```

### Delivery Columns
- Status icon: `✓` success, `✗` failed, `◌` pending
- Relative timestamp
- Event type
- Target name
- HTTP response code (or `--`)
- Response time

### Scrolling
- Arrow keys scroll delivery history
- Load last 50 deliveries, paginate if needed

---

## Create/Edit Modal

Press `a` to add, `e` to edit:

```
┌─ Create Webhook ───────────────────────────────────────────┐
│                                                            │
│ Name:  [Discord Alerts                    ]                │
│                                                            │
│ URL:   [https://discord.com/api/webhooks/...]              │
│                                                            │
│ Events:                                                    │
│   Status:    [✓] up  [✓] down  [ ] degraded  [✓] timeout  │
│              [✓] error                                     │
│   Lifecycle: [ ] paused  [ ] resumed  [ ] cert_expiring   │
│   CRUD:      [ ] created  [ ] updated  [ ] deleted        │
│                                                            │
│ Enabled:  (●) Yes  ( ) No                                  │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ (Tab) next field  (Space) toggle  (Enter) save  (Esc) cancel│
└────────────────────────────────────────────────────────────┘
```

### Form Behavior
- `Tab`/`Shift+Tab` moves between fields
- `Space` toggles checkboxes
- `Enter` validates and saves
- `Esc` cancels (confirm if unsaved changes)

### Validation
- Name: required, 1-100 chars
- URL: required, valid URL format
- Events: at least one selected

---

## Test Webhook Flow

Press `t` from list or detail view:

```
┌─ Test Webhook ─────────────────────────────────────────────┐
│                                                            │
│ Sending test to: Discord Alerts                            │
│                                                            │
│ ✓ Success                                                  │
│                                                            │
│ Status:        200 OK                                      │
│ Response time: 145ms                                       │
│ Response body: {"ok": true}                                │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ (Enter) close                                              │
└────────────────────────────────────────────────────────────┘
```

### Test Payload
```json
{
  "event": "test",
  "target": { "id": "test", "name": "Test Target", "type": "http" },
  "timestamp": "2024-01-15T10:30:00Z",
  "details": { "message": "Test webhook delivery" }
}
```

---

## tRPC Changes

### New Procedure
- `webhooks.deliveries` - Query deliveries for a webhook (paginated)
  - Input: `{ webhookId: uuid, limit?: number, cursor?: string }`
  - Output: `{ deliveries: WebhookDelivery[], nextCursor?: string }`

### Updated Procedure
- `webhooks.test` - Return full response details
  - Output: `{ success: boolean, statusCode?: number, responseTime?: number, body?: string, error?: string }`

---

## File Changes Summary

### Server Package
- `src/db/schema.ts` - Add `webhookDeliveries` table
- `src/webhooks/dispatcher.ts` - Integrate delivery tracking
- `src/webhooks/retry-scheduler.ts` - New retry processor
- `src/trpc/routers/webhooks.ts` - Add `deliveries` query, update `test`
- `src/index.ts` - Start retry scheduler

### Shared Package
- `src/schemas.ts` - Add new event types to `eventTypeSchema`
- `src/types.ts` - Add `WebhookDelivery` type

### TUI Client Package
- `src/stores/app.ts` - Add webhooks state, active tab
- `src/components/TabBar.tsx` - New tab navigation component
- `src/components/WebhookList.tsx` - Webhook list view
- `src/components/WebhookDetail.tsx` - Detail view with deliveries
- `src/components/WebhookForm.tsx` - Create/edit modal
- `src/components/WebhookTest.tsx` - Test result modal
- `src/hooks/useWebhooks.ts` - Webhook data fetching
- `src/App.tsx` - Integrate tab routing

---

## Future Considerations (Out of Scope)

- Webhook signing secrets (HMAC-SHA256)
- Custom headers per webhook
- Rate limiting per webhook
- Webhook templates for common services (Discord, Slack, PagerDuty)
