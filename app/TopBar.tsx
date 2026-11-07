import Link from "next/link";

export default function TopBar({ nickname, right }: { nickname?: string; right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand serif">
        인터랙티브 인터뷰집
      </Link>
      <div className="small muted">{right ?? (nickname ? `${nickname}님` : null)}</div>
    </header>
  );
}
