"use client";

import { useEffect, useRef, useState } from "react";

/** Reel thumbnail. Instagram CDN URLs expire, so a failed image falls back to a placeholder. */
export function Thumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // The image may have failed before React attached onError (server-rendered markup).
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) {
    return (
      <span className="thumb thumb--empty" role="img" aria-label={alt}>
        Reel
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} className="thumb" src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
