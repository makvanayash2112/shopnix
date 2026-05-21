import { displayStatus } from "@/lib/order-status";

const styles: Record<string, string> = {
  Created: "bg-amber-100 text-amber-800",
  Accepted: "bg-blue-100 text-blue-800",
  Packed: "bg-indigo-100 text-indigo-800",
  Delivering: "bg-violet-100 text-violet-800",
  Delivered: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-red-100 text-red-800",
  "Return-Requested": "bg-orange-100 text-orange-800",
  "Return-Approved": "bg-yellow-100 text-yellow-800",
  Returned: "bg-slate-200 text-slate-800",
  "In-progress": "bg-indigo-100 text-indigo-800",
  Completed: "bg-emerald-100 text-emerald-800",
  default: "bg-slate-100 text-slate-700",
};

export function Badge({ status }: { status: string }) {
  const key =
    status in styles ? status : status === "In-progress" ? "In-progress" : "default";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[key] ?? styles.default}`}
    >
      {displayStatus(status)}
    </span>
  );
}
