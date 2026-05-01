import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("em-dark");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("em-dark", dark);
  }, [dark]);

  return <Dashboard dark={dark} onToggleDark={() => setDark((d) => !d)} />;
}
