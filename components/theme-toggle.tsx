"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";


// Reads the "dark" class on <html> (set before paint by the script in app/layout.tsx).
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }

  return <Button variant="outline" size="icon" aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} title={dark ? "Giao diện sáng" : "Giao diện tối"} onClick={toggle} className={className}>{dark ? <Sun /> : <Moon />}</Button>;
}

export const headerButton = "border-header-foreground/30 bg-header-foreground/10 text-header-foreground hover:bg-header-foreground/20 hover:text-header-foreground dark:border-header-foreground/30 dark:bg-header-foreground/10 dark:hover:bg-header-foreground/20";
