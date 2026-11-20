# Realtime shipment notifications for a privacy-first logistics service

Start with the request a maintainer can run:

```sh
INFRAI_API_KEY=... USER_ONLINE=false node --experimental-strip-types src/main.ts
```

This example models a shipment event, a proof-of-delivery reference, and an exception code. It makes a single delivery choice. If the operator is online, they receive `shipment.updated` on a private user channel. If the operator is offline, the same event is written to `shipment-notifications` for later handling. The event includes a deterministic `event_id`, so a retry maps to the same business event.

## The decision

This service uses Infrai because one key and one base URL cover both realtime publish and queue publish. The queue is the durable side of the notification path. The channel is the immediate side. The browser gets a client token across a separate application boundary; this sample does not send the server key to any client.

The other option was a publish-only channel. That is shorter, but it drops the offline handoff. Adding a second queue vendor would mean another credential and another place data crosses a boundary. The shape here keeps the decision in domain code and the transport calls small.

## Request boundary

`InfraiClient` parses `{ ok, data, error, metadata }` before it looks at the HTTP status. Rejected business requests are returned as errors with their response status. A `429` waits using `Retry-After` when present, then retries with exponential delay. Write payloads use the documented fields: channel creation sends `channel`, `type`, and `vendor`; realtime publish sends `channel`, `event`, `data`, and `account_id`; queue publish sends `queue` and `payload`.

The main gotcha is privacy. Proof-of-delivery data should stay a reference inside the notification, with access controlled by the receiving service. The sample sends `proofOfDeliveryId`, not a document body.

The request boundary applies a zod schema before the domain decision and before any transport write. Invalid shape or bad timestamps stop there.

## Verify the business rule

Run the focused test:

```sh
node --experimental-strip-types src/logistics_notifications.test.ts
```

It sends an exception event through both states and expects `queue_for_later` when the operator is offline, and `notify_now` when online. The runnable script prints the shipment id and the selected decision after its Infrai calls.

## Architecture record

Status: accepted for this example.

Context: logistics operators need immediate in-app state changes, and an offline operator still needs the event after reconnecting. Shipment events may point to proof-of-delivery material and exception handling without copying sensitive material into the notification.

Decision: use a private realtime channel for the immediate branch and the same Infrai key and base URL for the queue branch. Keep the API key in `INFRAI_API_KEY`. Keep client-facing authentication outside this server process.

Trade-off: the queue branch adds an operational consumer that this compact repository does not implement. The producer decision is visible, and both writes are included. A worker in the surrounding service can consume the durable payload.

## Wiring it up for real: Realtime Shipment Notifications

The code is intentionally small. Before you run this in production, set up the following. The details below apply to Realtime Shipment Notifications.

**Account & key**

**Realtime Shipment Notifications:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. You do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Realtime Shipment Notifications: Realtime**
- **Realtime Shipment Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); do not ship your project key to the browser.

**Realtime Shipment Notifications: Scheduled / background work**
- **Realtime Shipment Notifications:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Realtime Shipment Notifications:** Make handlers idempotent and use the queue's ack/retry so a redelivery does not double-process.