"use client";

import { useEffect, useRef, useState } from "react";
import type { AssetStatus } from "@/lib/types";
import {
  chipClasses,
  OPTIONAL_STATUS_LABEL,
  STATUS_LABEL,
} from "@/lib/assets";

export interface ChipProps {
  short: string;
  label: string;
  status: AssetStatus;
  optional: boolean;
  finalUrl: string | null;
  onCycle: () => void;
  onSetStatus: (s: AssetStatus) => void;
  onSaveLink: (url: string, markReady: boolean) => void;
  onRemoveLink: () => void;
}

const STATUSES: AssetStatus[] = ["not_started", "in_progress", "ready"];

export function Chip(props: ChipProps) {
  const {
    short,
    label,
    status,
    optional,
    finalUrl,
    onCycle,
    onSetStatus,
    onSaveLink,
    onRemoveLink,
  } = props;

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(finalUrl ?? "");
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => setUrl(finalUrl ?? ""), [finalUrl]);

  // Close the popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const statusLabel = (optional ? OPTIONAL_STATUS_LABEL : STATUS_LABEL)[status];
  const title = `${label}: ${statusLabel}${finalUrl ? " · linked" : ""}`;
  const linked = !!finalUrl;

  // Chip body click: if linked, open the asset; otherwise cycle status.
  const handleBody = () => {
    if (linked) window.open(finalUrl!, "_blank", "noopener,noreferrer");
    else onCycle();
  };

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <span
        role="button"
        tabIndex={0}
        title={title}
        onClick={handleBody}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleBody();
          }
        }}
        className={`chip ${chipClasses(status, optional)}`}
      >
        {short}
      </span>

      {/* Link trigger — opens the popover to attach/edit the final asset URL. */}
      <button
        type="button"
        aria-label={`Edit link for ${label}`}
        title={linked ? "Edit / open link" : "Attach final link"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border
          text-[7px] leading-none flex items-center justify-center
          ${
            linked
              ? "bg-gold border-gold text-ink"
              : "bg-white border-line text-muted hover:border-gold"
          }`}
      >
        {linked ? "↗" : "+"}
      </button>

      {open && (
        <div
          className="absolute z-30 top-6 left-0 w-60 bg-white border border-line
            rounded-md shadow-lg p-3 text-left cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted mb-1">
            {label} — final link
          </p>
          <input
            type="url"
            value={url}
            placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
            className="w-full border border-line rounded px-2 py-1 text-[12px]
              focus:outline-none focus:border-gold"
          />

          {/* Explicit status control so even a linked chip stays editable. */}
          <div className="flex gap-1 mt-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetStatus(s)}
                className={`flex-1 font-mono text-[9px] uppercase rounded px-1 py-1 border
                  ${
                    status === s
                      ? "bg-ink text-paper border-ink"
                      : "bg-white text-muted border-line hover:border-gold"
                  }`}
              >
                {s === "not_started" ? "None" : s === "in_progress" ? "WIP" : "Ready"}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => {
                onSaveLink(url.trim(), false);
                setOpen(false);
              }}
              className="font-mono text-[10px] uppercase rounded px-2 py-1 bg-ink
                text-paper hover:bg-black"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveLink(url.trim(), true);
                setOpen(false);
              }}
              className="font-mono text-[10px] uppercase rounded px-2 py-1 border
                border-gold text-ink hover:bg-gold/20"
            >
              Save &amp; Ready
            </button>
            {linked && (
              <>
                <a
                  href={finalUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] uppercase rounded px-2 py-1 border
                    border-line text-muted hover:border-gold"
                >
                  Open ↗
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onRemoveLink();
                    setUrl("");
                    setOpen(false);
                  }}
                  className="font-mono text-[10px] uppercase rounded px-2 py-1 border
                    border-line text-bad hover:border-bad"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
