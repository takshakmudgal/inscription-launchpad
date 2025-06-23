import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = (then.getTime() - now.getTime()) / 1000;
  const diffInMinutes = diffInSeconds / 60;
  const diffInHours = diffInMinutes / 60;
  const diffInDays = diffInHours / 24;

  if (Math.abs(diffInSeconds) < 60) {
    return rtf.format(Math.round(diffInSeconds), "second");
  } else if (Math.abs(diffInMinutes) < 60) {
    return rtf.format(Math.round(diffInMinutes), "minute");
  } else if (Math.abs(diffInHours) < 24) {
    return rtf.format(Math.round(diffInHours), "hour");
  } else {
    return rtf.format(Math.round(diffInDays), "day");
  }
}

export function truncateAddress(address: string, start = 6, end = 4): string {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function getExplorerUrl(txid: string, network = "testnet"): string {
  const baseUrl =
    network === "mainnet"
      ? "https://blockstream.info/tx/"
      : "https://blockstream.info/testnet/tx/";
  return `${baseUrl}${txid}`;
}

export function getOrdinalsUrl(inscriptionId: string): string {
  return `https://ordinals.com/inscription/${inscriptionId}`;
}
