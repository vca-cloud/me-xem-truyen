"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ConfirmOptions = { title: string; description?: string; confirmText?: string; destructive?: boolean };
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// App-wide replacement for window.confirm(): `const confirm = useConfirm(); if (await confirm({ title })) ...`
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => new Promise((resolve) => {
    resolver.current = resolve;
    setOptions(next);
  }), []);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  return <ConfirmContext.Provider value={confirm}>
    {children}
    <AlertDialog open={!!options} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {options?.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Hủy</AlertDialogCancel>
          <AlertDialogAction variant={options?.destructive ? "destructive" : "default"} onClick={() => close(true)}>{options?.confirmText ?? "Đồng ý"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </ConfirmContext.Provider>;
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}
