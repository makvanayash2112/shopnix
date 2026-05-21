"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useBuyerAuth } from "@/lib/buyer-auth";
import { buyerAuthFetch } from "@/lib/buyer-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BUYER_ORDER_STEPS, displayStatus, normalizeStatus } from "@/lib/order-status";
import type { OrderTrackResponse } from "@/types";

export default function BuyerOrderTrackPage() {
  const params = useParams();
  const orderId = params?.orderId as string;
  const router = useRouter();
  const { isLoggedIn, loading } = useBuyerAuth();
  const [order, setOrder] = useState<OrderTrackResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [message, setMessage] = useState("");

  function load() {
    if (orderId) {
      buyerAuthFetch<OrderTrackResponse>(`/orders/track/${orderId}`).then(setOrder);
    }
  }

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace(`/shop/login?redirect=/shop/orders/${orderId}`);
      return;
    }
    if (isLoggedIn) load();
  }, [loading, isLoggedIn, orderId, router]);

  async function cancelOrder() {
    if (!confirm("Cancel this order?")) return;
    setActionLoading(true);
    setMessage("");
    try {
      await buyerAuthFetch(`/orders/${orderId}/cancel`, { method: "POST" });
      setMessage("Order cancelled.");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function requestReturn() {
    if (!returnReason.trim()) {
      setMessage("Please enter a return reason");
      return;
    }
    setActionLoading(true);
    setMessage("");
    try {
      await buyerAuthFetch(`/orders/${orderId}/return`, {
        method: "POST",
        body: JSON.stringify({ reason: returnReason }),
      });
      setMessage("Return request submitted. Seller will review within 48 hours.");
      setReturnReason("");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Return failed");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <main className="p-16 text-center">Loading…</main>;
  if (!order) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-500">Order not found.</p>
        <Link href="/shop/orders" className="mt-4 text-indigo-600 hover:underline">
          Back to orders
        </Link>
      </main>
    );
  }

  const status = normalizeStatus(order.status);
  const stepIndex = BUYER_ORDER_STEPS.indexOf(
    status as (typeof BUYER_ORDER_STEPS)[number]
  );
  const isCancelled = status === "Cancelled";
  const isReturn =
    status === "Return-Requested" ||
    status === "Return-Approved" ||
    status === "Returned";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/shop/orders" className="text-sm text-indigo-600 hover:underline">
        ← My orders
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Order {order.orderId}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Badge status={order.status} />
        <span className="text-sm text-slate-500">
          Placed {new Date(order.createdAt).toLocaleString()}
        </span>
      </div>

      {!isCancelled && !isReturn && (
        <Card title="Delivery progress" className="mt-8">
          <div className="flex justify-between gap-1">
            {BUYER_ORDER_STEPS.map((step, i) => (
              <div
                key={step}
                className="flex flex-1 flex-col items-center text-center"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    stepIndex >= 0 && i <= stepIndex
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {i + 1}
                </div>
                <p className="mt-2 text-[10px] font-medium leading-tight text-slate-700 sm:text-xs">
                  {displayStatus(step)}
                </p>
              </div>
            ))}
          </div>
          {status === "Delivering" && (
            <p className="mt-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
              Your order is out for delivery. Cancellation is not available at this
              stage.
            </p>
          )}
          {order.fulfillment?.tracking && (
            <p className="mt-3 text-sm text-slate-600">
              Tracking: <span className="font-mono">{order.fulfillment.tracking}</span>
            </p>
          )}
        </Card>
      )}

      {order.canCancel && (
        <Card title="Cancel order" className="mt-6">
          <p className="text-sm text-slate-600">
            You can cancel before the order is out for delivery.
          </p>
          <Button
            variant="danger"
            className="mt-3"
            disabled={actionLoading}
            onClick={cancelOrder}
          >
            Cancel order
          </Button>
        </Card>
      )}

      {status === "Delivered" && (
        <Card title="Returns (7-day policy)" className="mt-6">
          <p className="text-sm text-slate-600">
            {order.returnPolicy?.summary ??
              "Return within 7 days of delivery."}
          </p>
          {order.returnDeadline && (
            <p className="mt-2 text-xs text-slate-500">
              Return by: {new Date(order.returnDeadline).toLocaleDateString()}
            </p>
          )}
          <Link
            href="/shop/returns-policy"
            className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
          >
            Read full return policy
          </Link>

          {order.returnInfo?.requestedAt ? (
            <div className="mt-4 rounded-lg bg-orange-50 p-3 text-sm">
              <p className="font-medium text-orange-900">Return submitted</p>
              <p className="mt-1 text-orange-800">{order.returnInfo.reason}</p>
              <p className="mt-1 text-xs">Status: {displayStatus(order.status)}</p>
            </div>
          ) : order.canReturn ? (
            <div className="mt-4 space-y-3">
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Why are you returning? (required)"
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <Button
                variant="secondary"
                disabled={actionLoading}
                onClick={requestReturn}
              >
                Request return
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-red-600">
              {order.returnMessage ?? "Return not available"}
            </p>
          )}
        </Card>
      )}

      <Card title="Items" className="mt-6">
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
        <p className="mt-4 border-t pt-4 text-right font-bold">
          Total ₹{order.payment.amount} · Cash on delivery
        </p>
      </Card>

      {message && (
        <p
          className={`mt-4 text-sm ${message.includes("failed") || message.includes("not") ? "text-red-600" : "text-emerald-600"}`}
        >
          {message}
        </p>
      )}
    </main>
  );
}
