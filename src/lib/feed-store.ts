// Network camera feed registry. localStorage only.
import { useEffect, useState } from "react";

export type FeedKind = "local" | "mjpeg" | "hls" | "webrtc";

export type Feed = {
  id: string;
  name: string;
  kind: FeedKind;
  url: string; // for local: "front" | "back"
  description?: string;
  createdAt: number;
};

const KEY = "lens.feeds.v1";

export function loadFeeds(): Feed[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Feed[];
  } catch {
    return [];
  }
}

export function saveFeeds(f: Feed[]) {
  localStorage.setItem(KEY, JSON.stringify(f));
  window.dispatchEvent(new Event("lens:feeds"));
}

export function addFeed(f: Omit<Feed, "id" | "createdAt">): Feed {
  const all = loadFeeds();
  if (all.length >= 6) throw new Error("Maximum 6 feeds.");
  const item: Feed = {
    ...f,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  };
  all.push(item);
  saveFeeds(all);
  return item;
}

export function removeFeed(id: string) {
  saveFeeds(loadFeeds().filter((f) => f.id !== id));
}

export function useFeeds(): Feed[] {
  const [list, setList] = useState<Feed[]>(() => loadFeeds());
  useEffect(() => {
    const sync = () => setList(loadFeeds());
    window.addEventListener("lens:feeds", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lens:feeds", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return list;
}
