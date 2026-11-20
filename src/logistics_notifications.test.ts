import { deliveryDecision, type ShipmentEvent } from "./logistics_notifications.ts";

const event: ShipmentEvent = {
  shipmentId: "SHP-1",
  recipientId: "operator-1",
  kind: "exception",
  occurredAt: "2026-10-24T02:00:00.000Z",
  exceptionCode: "ADDRESS_REVIEW",
};

if (deliveryDecision(event, false) !== "queue_for_later") throw new Error("offline users must receive durable delivery");
if (deliveryDecision(event, true) !== "notify_now") throw new Error("online users must receive realtime delivery");
console.log("delivery decision test passed");
