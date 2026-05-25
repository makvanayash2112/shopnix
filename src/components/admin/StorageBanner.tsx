"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { ImageStorageStatus } from "@/types";

export function StorageBanner() {
  const [status, setStatus] = useState<ImageStorageStatus | null>(null);

  useEffect(() => {
    apiFetch<ImageStorageStatus>("/seller/storage-status")
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  if (!status || status.mode === "vercel-blob" || status.mode === "local-disk") {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">Image uploads on Vercel need Blob storage</p>
      <p className="mt-1 text-amber-800">{status.hint}</p>
      <p className="mt-2 text-xs text-amber-700">
        Until then, paste <strong>HTTPS image URLs</strong> when adding products (e.g. from
        Imgur, your CDN, or Vercel Blob after setup). Public base: {status.publicBaseUrl}
      </p>
    </div>
  );
}
