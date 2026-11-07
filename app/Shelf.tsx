"use client";
import Link from "next/link";
import { useState } from "react";

export interface ShelfItem {
  slug: string;
  name: string;
  role: string;
  tagline: string;
  tags: string[];
  talked: boolean;
}

export default function Shelf({ items }: { items: ShelfItem[] }) {
  const allTags = [...new Set(items.flatMap((i) => i.tags))];
  const [tag, setTag] = useState<string | null>(null);
  const shown = tag ? items.filter((i) => i.tags.includes(tag)) : items;
  return (
    <>
      {allTags.length > 0 && (
        <div className="tags" style={{ marginBottom: 14 }}>
          <button className={`tag ${tag === null ? "on" : ""}`} onClick={() => setTag(null)}>
            전체
          </button>
          {allTags.map((t) => (
            <button key={t} className={`tag ${tag === t ? "on" : ""}`} onClick={() => setTag(t === tag ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="shelf">
        {shown.map((p) => (
          <Link key={p.slug} href={`/p/${p.slug}`} className="card person">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="avatar">{p.name.slice(0, 1)}</div>
              <div>
                <div className="name">{p.name}</div>
                <div className="small muted">{p.role}</div>
              </div>
            </div>
            {p.tagline && <div className="serif">“{p.tagline}”</div>}
            <div className="tags">
              {p.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
              {p.talked && <span className="tag" style={{ color: "var(--accent)" }}>대화 중</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
