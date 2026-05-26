"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { displayStatus, normalizeStatus } from "@/lib/order-status";
import type { Order } from "@/types";

const SELLER_ACTIONS: Record<string, { status: string; label: string; variant?: "danger" }[]> = {
  Created: [
    { status: "Accepted", label: "Confirm order" },
    { status: "Cancelled", label: "Cancel order", variant: "danger" },
  ],
  Accepted: [
    { status: "Packed", label: "Mark as packed" },
    { status: "Cancelled", label: "Cancel order", variant: "danger" },
  ],
  Packed: [
    { status: "Delivering", label: "Out for delivery" },
    { status: "Cancelled", label: "Cancel order", variant: "danger" },
  ],
  Delivering: [{ status: "Delivered", label: "Mark delivered (COD collected)" }],
  "Return-Requested": [
    { status: "Return-Approved", label: "Approve return" },
    { status: "Returned", label: "Complete return & restock" },
  ],
  "Return-Approved": [
    { status: "Returned", label: "Complete return & restock" },
  ],
  "In-progress": [
    { status: "Delivering", label: "Out for delivery" },
    { status: "Cancelled", label: "Cancel", variant: "danger" },
  ],
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [nextStatuses, setNextStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ order: Order; nextStatuses: string[] }>(`/orders/${id}`).then(
      (d) => {
        setOrder(d.order);
        setNextStatuses(d.nextStatuses);
      }
    );
  }, [id]);

  async function updateStatus(status: string) {
    setLoading(true);
    try {
      await apiFetch<Order>(`/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const refreshed = await apiFetch<{ order: Order; nextStatuses: string[] }>(
        `/orders/${id}`
      );
      setOrder(refreshed.order);
      setNextStatuses(refreshed.nextStatuses);
    } finally {
      setLoading(false);
    }
  }

  if (!order) return <p className="text-slate-500">Loading…</p>;

  const norm = normalizeStatus(order.status);
  const actions =
    SELLER_ACTIONS[norm] ??
    SELLER_ACTIONS[order.status] ??
    nextStatuses.map((s) => ({
      status: s,
      label: `Set ${displayStatus(s)}`,
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{order.orderId}</h1>
          <p className="text-sm text-slate-500">
            ONDC order · {order.customer?.email ?? "-"}
          </p>
        </div>
        <Badge status={order.status} />
      </div>

      <Card title="Customer & delivery">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Name</dt>
            <dd>{order.customer?.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd>{order.customer?.phone}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd>{order.customer?.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Payment</dt>
            <dd>
              Cash ₹{order.payment.amount} ({order.payment.status})
            </dd>
          </div>
          {order.fulfillment?.tracking && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Tracking</dt>
              <dd className="font-mono">{order.fulfillment.tracking}</dd>
            </div>
          )}
          {order.deliveredAt && (
            <div>
              <dt className="text-slate-500">Delivered at</dt>
              <dd>{new Date(order.deliveredAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 text-sm text-slate-600">
          {order.customer?.address?.building},{" "}
          {order.customer?.address?.locality},{" "}
          {order.customer?.address?.city},{" "}
          {order.customer?.address?.state} -{" "}
          {order.customer?.address?.area_code}
        </p>
      </Card>

      {order.returnInfo?.requestedAt && (
        <Card title="Return request">
          <p className="text-sm">
            <strong>Reason:</strong> {order.returnInfo.reason}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Requested {new Date(order.returnInfo.requestedAt).toLocaleString()}
          </p>
        </Card>
      )}

      <Card title="Items">
        <ul className="divide-y text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between py-2">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>₹{item.price * item.quantity}</span>
            </li>
          ))}
        </ul>
      </Card>

      {actions.length > 0 && (
        <Card title="Update order status">
          <p className="mb-4 text-sm text-slate-500">
            Move order through: Confirmed → Packed → Out for delivery → Delivered
          </p>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button
                key={a.status}
                variant={a.variant === "danger" ? "danger" : "primary"}
                disabled={loading}
                onClick={() => updateStatus(a.status)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {norm === "Delivered" && !order.returnInfo?.requestedAt && (
        <p className="text-sm text-slate-500">
          Return window is 7 days from delivery.
        </p>
      )}
    </div>
  );
}
