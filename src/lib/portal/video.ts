export type VideoEmbed =
  | { kind: "youtube"; src: string }
  | { kind: "vimeo"; src: string }
  | { kind: "file"; src: string }
  | { kind: "link"; href: string };

/** Resolve a lesson video URL into a safe embed strategy. */
export function resolveVideo(url: string | null | undefined): VideoEmbed | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id =
      parsed.pathname.startsWith("/embed/")
        ? parsed.pathname.split("/")[2]
        : parsed.searchParams.get("v");
    if (id && /^[\w-]{5,20}$/.test(id)) {
      return {
        kind: "youtube",
        src: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    if (id && /^[\w-]{5,20}$/.test(id)) {
      return {
        kind: "youtube",
        src: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean).pop();
    if (id && /^\d{6,12}$/.test(id)) {
      return { kind: "vimeo", src: `https://player.vimeo.com/video/${id}` };
    }
  }

  if (/\.(mp4|webm|m4v|mov|ogg)(\?.*)?$/i.test(raw)) {
    return { kind: "file", src: raw };
  }

  return { kind: "link", href: raw };
}
