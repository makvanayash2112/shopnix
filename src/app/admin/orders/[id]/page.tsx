"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
    { status: "Agent-assigned", label: "Assign delivery agent" },
    { status: "Delivering", label: "Out for delivery (skip)" },
    { status: "Cancelled", label: "Cancel order", variant: "danger" },
  ],
  "Agent-assigned": [
    { status: "Order-picked-up", label: "Mark as picked up" },
    { status: "Delivering", label: "Out for delivery (skip)" },
    { status: "Cancelled", label: "Cancel order", variant: "danger" },
  ],
  "Order-picked-up": [
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
    { status: "Agent-assigned", label: "Assign delivery agent" },
    { status: "Delivering", label: "Out for delivery (skip)" },
    { status: "Cancelled", label: "Cancel", variant: "danger" },
  ],
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [nextStatuses, setNextStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelItems, setCancelItems] = useState<Record<string, number>>({});
  const [cancelReason, setCancelReason] = useState("002");
  const [igmResolution, setIgmResolution] = useState("");
  const [igmAction, setIgmAction] = useState<"REFUND" | "REPLACEMENT" | "CANCEL" | "NO_ACTION">("REFUND");
  const [rtoReason, setRtoReason] = useState("004");
  const [rtoDesc, setRtoDesc] = useState("");
  const [showRtoDialog, setShowRtoDialog] = useState(false);

  useEffect(() => {
    apiFetch<{ order: Order; nextStatuses: string[] }>(`/orders/${id}`).then(
      (d) => {
        setOrder(d.order);
        setNextStatuses(d.nextStatuses);
      }
    );
  }, [id]);

  async function handlePartialCancel() {
    const itemsPayload = Object.entries(cancelItems)
      .filter(([_, qty]) => qty > 0)
      .map(([ondcItemId, quantity]) => ({ ondcItemId, quantity }));

    if (itemsPayload.length === 0) return alert("Select items to cancel");

    setLoading(true);
    try {
      await apiFetch(`/orders/${id}/partial-cancel`, {
        method: "PATCH",
        body: JSON.stringify({ items: itemsPayload, reasonId: cancelReason }),
      });
      alert("Partial cancel applied");
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to cancel");
    } finally {
      setLoading(false);
    }
  }

  async function handleRtoCancel() {
    if (!rtoDesc.trim()) return alert("Please enter cancellation reason");

    setLoading(true);
    try {
      await apiFetch(`/orders/${id}/rto-cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reasonId: rtoReason, reasonDesc: rtoDesc }),
      });
      alert("RTO cancellation initiated. Order will be returned to origin.");
      setShowRtoDialog(false);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to initiate RTO");
    } finally {
      setLoading(false);
    }
  }

  async function handleIgmResolve(issueId: string) {
    if (!igmResolution) return alert("Provide a resolution description");
    setLoading(true);
    try {
      await apiFetch(`/orders/${id}/igm/${issueId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "RESOLVED",
          resolution: igmResolution,
          resolutionAction: igmAction,
        }),
      });
      alert("Issue resolved");
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to resolve issue");
    } finally {
      setLoading(false);
    }
  }

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
          {order.items.map((item, i) => {
            const cancelledCount = order.cancelledItems?.filter(c => c.ondcItemId === item.ondcItemId).reduce((s, c) => s + c.quantity, 0) || 0;
            const availableToCancel = item.quantity - cancelledCount;
            const isCancelable = ["Accepted", "Packed"].includes(norm);

            return (
              <li key={i} className="flex flex-col py-3 gap-2">
                <div className="flex justify-between items-center">
                  <span className={cancelledCount === item.quantity ? "line-through text-slate-400" : ""}>
                    {item.name} × {item.quantity}
                  </span>
                  <span>₹{item.price * item.quantity}</span>
                </div>
                {cancelledCount > 0 && (
                  <div className="text-xs text-red-500">
                    Cancelled: {cancelledCount}
                  </div>
                )}
                {isCancelable && availableToCancel > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <label className="text-xs text-slate-500">Cancel Qty:</label>
                    <Input 
                      type="number" 
                      className="w-20 h-8" 
                      min="0" 
                      max={availableToCancel} 
                      value={cancelItems[item.ondcItemId] || 0}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCancelItems(prev => ({ ...prev, [item.ondcItemId]: Number(e.target.value) }))}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {["Accepted", "Packed"].includes(norm) && Object.values(cancelItems).some(v => v > 0) && (
          <div className="mt-4 pt-4 border-t flex flex-col gap-2">
            <select 
              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              value={cancelReason} 
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCancelReason(e.target.value)}
            >
              <option value="002">002 - Item out of stock</option>
              <option value="005">005 - Merchant rejected</option>
            </select>
            <Button onClick={handlePartialCancel} disabled={loading} variant="danger">
              Apply Partial Cancel
            </Button>
          </div>
        )}
      </Card>

      {/* RTO Cancel Card - Flow 3B */}
      {(order.fulfillment?.state === "Out-for-delivery" || order.fulfillment?.state === "Delivering") && order.status !== "Cancelled" && (
        <Card title="Return to Origin (RTO) - Flow 3B">
          <p className="mb-4 text-sm text-slate-600">
            Initiate return to origin for out-for-delivery orders. All items will be restocked.
          </p>
          {!showRtoDialog ? (
            <Button
              variant="danger"
              onClick={() => setShowRtoDialog(true)}
              disabled={loading}
            >
              Initiate RTO Cancel
            </Button>
          ) : (
            <div className="space-y-3 bg-slate-50 p-4 rounded-md">
              <p className="font-medium text-sm">Cancel Reason</p>
              <select
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                value={rtoReason}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRtoReason(e.target.value)}
              >
                <option value="002">002 - Item out of stock</option>
                <option value="004">004 - Merchant not available</option>
                <option value="005">005 - Out of stock</option>
                <option value="006">006 - Customer request</option>
                <option value="007">007 - Order failed</option>
                <option value="008">008 - Payment failed</option>
                <option value="009">009 - Merchant-initiated RTO</option>
              </select>
              <div className="mt-2">
                <p className="font-medium text-xs text-slate-500 mb-1">Description</p>
                <Input
                  placeholder="Why are you cancelling this delivery..."
                  value={rtoDesc}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRtoDesc(e.target.value)}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="danger"
                  onClick={handleRtoCancel}
                  disabled={loading}
                >
                  Confirm RTO Cancellation
                </Button>
                <Button
                  onClick={() => {
                    setShowRtoDialog(false);
                    setRtoDesc("");
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {order.rtoInfo && (
            <div className="mt-4 pt-4 border-t">
              <p className="font-medium text-sm mb-2">RTO Status: {order.rtoInfo.status}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Initiated</dt>
                  <dd>{new Date(order.rtoInfo.initiatedAt!).toLocaleString()}</dd>
                </div>
                {order.rtoInfo.pickedUpAt && (
                  <div>
                    <dt className="text-slate-500">Picked Up</dt>
                    <dd>{new Date(order.rtoInfo.pickedUpAt).toLocaleString()}</dd>
                  </div>
                )}
                {order.rtoInfo.deliveredToOriginAt && (
                  <div>
                    <dt className="text-slate-500">Delivered to Origin</dt>
                    <dd>{new Date(order.rtoInfo.deliveredToOriginAt).toLocaleString()}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Reason</dt>
                  <dd>{order.rtoInfo.reason}</dd>
                </div>
              </dl>
            </div>
          )}
        </Card>
      )}

      {/* IGM Management Card */}

      {order.igmIssues && order.igmIssues.length > 0 && (
        <Card title="Issue & Grievance (IGM)">
          <div className="space-y-4 text-sm">
            {order.igmIssues.map((issue, idx) => (
              <div key={idx} className="border p-3 rounded-md space-y-2">
                <div className="flex justify-between items-start">
                  <p className="font-semibold">{issue.category} Issue</p>
                  <Badge status={issue.status} />
                </div>
                <p className="text-slate-600">ID: {issue.issueId}</p>
                <p><strong>Description:</strong> {issue.description || "N/A"}</p>
                
                {issue.status !== "CLOSED" && issue.status !== "RESOLVED" && (
                  <div className="mt-4 space-y-2 bg-slate-50 p-3 rounded">
                    <p className="font-medium text-xs text-slate-500">Provide Resolution</p>
                    <Input 
                      placeholder="Resolution details..." 
                      value={igmResolution}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIgmResolution(e.target.value)}
                    />
                    <select 
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      value={igmAction}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIgmAction(e.target.value as any)}
                    >
                      <option value="REFUND">Refund</option>
                      <option value="REPLACEMENT">Replacement</option>
                      <option value="NO_ACTION">No Action</option>
                    </select>
                    <Button onClick={() => handleIgmResolve(issue.issueId)} disabled={loading}>
                      Resolve Issue
                    </Button>
                  </div>
                )}
                {issue.resolution && (
                  <div className="mt-2 text-xs bg-green-50 p-2 rounded text-green-800">
                    <strong>Resolved ({issue.resolutionAction}):</strong> {issue.resolution}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* RSF Settlement Card */}
      {order.settlementInfo && (
        <Card title="Settlement & Reconciliation (RSF)">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Recon Status</dt>
              <dd>{order.settlementInfo.recon_status === "01" ? "Reconciled" : order.settlementInfo.recon_status || "Pending"}</dd>
            </div>
            {order.settlementInfo.settlement_reference_no && (
              <div>
                <dt className="text-slate-500">Settlement Ref</dt>
                <dd className="font-mono">{order.settlementInfo.settlement_reference_no}</dd>
              </div>
            )}
            {order.settlementInfo.counterparty_diff_amount && (
              <div>
                <dt className="text-slate-500">Difference</dt>
                <dd>₹{order.settlementInfo.counterparty_diff_amount.value}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {actions.length > 0 && (
        <Card title="Update order status">
          <p className="mb-4 text-sm text-slate-500">
            Move order through: Confirmed → Packed → Agent-assigned → Picked up → Out for delivery → Delivered
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
