import { InfraiClient, sendShipmentUpdate, shipmentEventBody, type ShipmentEvent } from "./logistics_notifications.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before running the example");

const event: ShipmentEvent = {
  shipmentId: "SHP-2048",
  recipientId: process.env.USER_RECIPIENT_ID ?? "operator-17",
  kind: "delivered",
  occurredAt: "2026-10-24T02:00:00.000Z",
  proofOfDeliveryId: "pod-2048",
};
shipmentEventBody.parse(event);

const client = new InfraiClient(key);
const decision = await sendShipmentUpdate(client, event, process.env.USER_ONLINE === "true", "logistics-demo");
console.log(JSON.stringify({ shipmentId: event.shipmentId, decision }));
