import Link from "next/link";
import { PropsWithChildren } from "react";

type ShellProps = PropsWithChildren<{
  active: "vector" | "day" | "notes" | "week" | "month";
}>;

export function Shell({ active, children }: ShellProps) {
  return (
    <>
      <header className="topbar">
        <div className="brand">Vector OS</div>
        <nav className="nav">
          <Link className={active === "vector" ? "active" : ""} href="/vector">
            Вектор
          </Link>
          <Link className={active === "day" ? "active" : ""} href="/today">
            День
          </Link>
          <Link className={active === "notes" ? "active" : ""} href="/notes">
            Заметки
          </Link>
          <Link className={active === "week" ? "active" : ""} href="/week">
            Неделя
          </Link>
          <Link className={active === "month" ? "active" : ""} href="/month">
            Месяц
          </Link>
        </nav>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
