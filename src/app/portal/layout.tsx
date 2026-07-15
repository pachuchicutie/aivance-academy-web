import type { ReactNode } from "react";
import "./portal.css";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <div className="pt-root">{children}</div>;
}
