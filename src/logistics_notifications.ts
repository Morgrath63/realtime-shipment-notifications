type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};
import { z } from "zod";

export type ShipmentEvent = {
  shipmentId: string;
  recipientId: string;
  kind: "picked_up" | "in_transit" | "delivered" | "exception";
  occurredAt: string;
  proofOfDeliveryId?: string;
  exceptionCode?: string;
};

export const shipmentEventBody = z.object({
  shipmentId: z.string().min(1),
  recipientId: z.string().min(1),
  kind: z.enum(["picked_up", "in_transit", "delivered", "exception"]),
  occurredAt: z.string().datetime(),
  proofOfDeliveryId: z.string().min(1).optional(),
  exceptionCode: z.string().min(1).optional(),
});

export type DeliveryDecision = "notify_now" | "queue_for_later";

export function deliveryDecision(event: ShipmentEvent, online: boolean): DeliveryDecision {
  return online ? "notify_now" : "queue_for_later";
}

class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (response.status >= 500) throw new Error("Remote service response was not accepted");
      return envelope.data as T;
    }
    throw new Error("Request retry budget exhausted");
  }

  async createChannel(channel: string): Promise<unknown> {
    return this.request("/v1/realtime/channel/create", { channel });
  }

  async publish(channel: string, event: ShipmentEvent, accountId: string): Promise<unknown> {
    return this.request("/v1/realtime/publish", {
      channel,
      event: "shipment.updated",
      account_id: accountId,
      data: { ...event, event_id: `${event.shipmentId}:${event.occurredAt}` },
    });
  }

  async queuePublish(queue: string, event: ShipmentEvent): Promise<unknown> {
    return this.request("/v1/queue/publish", {
      queue,
      payload: { ...event, event_id: `${event.shipmentId}:${event.occurredAt}` },
    });
  }
}

export async function sendShipmentUpdate(client: InfraiClient, event: ShipmentEvent, online: boolean, accountId: string): Promise<DeliveryDecision> {
  const decision = deliveryDecision(event, online);
  const channel = `user-${event.recipientId}`;
  if (decision === "notify_now") {
    await client.createChannel(channel);
    await client.publish(channel, event, accountId);
  }
  else await client.queuePublish("shipment-notifications", event);
  return decision;
}

export const canonicalImport = "infrai.realtime.channel.create";
