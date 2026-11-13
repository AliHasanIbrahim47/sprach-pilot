"use client";

import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface UnsavedGuard {
  isDirty: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
}

interface GuardEntry {
  read: () => UnsavedGuard;
  scope: string;
}

interface PendingLeave {
  resolve: (allowed: boolean) => void;
  proceed: () => void;
  scope: string | undefined;
}

interface UnsavedChangesContextValue {
  register: (id: string, read: () => UnsavedGuard, scope: string) => () => void;
  confirmLeave: (proceed?: () => void, scope?: string) => Promise<boolean>;
}

const StepScopeContext = createContext("page");

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  register: () => () => undefined,
  confirmLeave: async () => true,
});

/**
 * Marks the forms inside one settings step so leaving that step only saves those forms.
 */
export function UnsavedStepScope({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}): React.JSX.Element {
  return <StepScopeContext.Provider value={id}>{children}</StepScopeContext.Provider>;
}

/**
 * One dialog for every form that still has edits. Step changes and page links ask before leaving.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const t = useTranslations("Settings");
  const guards = useRef(new Map<string, GuardEntry>());
  const bypass = useRef(false);
  const pendingRef = useRef<PendingLeave | null>(null);
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function dirtyGuards(scope?: string): UnsavedGuard[] {
    return [...guards.current.values()]
      .filter((entry) => scope === undefined || entry.scope === scope)
      .map((entry) => entry.read())
      .filter((guard) => guard.isDirty);
  }

  function confirmLeave(proceed: () => void = () => undefined, scope?: string): Promise<boolean> {
    if (dirtyGuards(scope).length === 0) return Promise.resolve(true);
    return new Promise((resolve) => {
      const next = { resolve, proceed, scope };
      pendingRef.current = next;
      setPending(next);
    });
  }

  function continueLeave(leave: PendingLeave | null): void {
    // Run after the server action refreshes this page, or the step change is lost.
    globalThis.setTimeout(() => {
      leave?.proceed();
      leave?.resolve(true);
    }, 0);
  }

  function finish(allowed: boolean): void {
    const leave = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    setIsSaving(false);
    if (!allowed) {
      leave?.resolve(false);
      return;
    }
    leave?.proceed();
    leave?.resolve(true);
  }

  async function saveAndLeave(): Promise<void> {
    const leave = pendingRef.current;
    const saving = dirtyGuards(leave?.scope);
    pendingRef.current = null;
    setPending(null);
    setIsSaving(true);
    try {
      await Promise.all(saving.map((guard) => guard.save()));
    } catch {
      // The form shows the error. The step change still happens.
    } finally {
      setIsSaving(false);
    }
    continueLeave(leave);
  }

  function discardAndLeave(): void {
    const leave = pendingRef.current;
    for (const guard of dirtyGuards(leave?.scope)) guard.discard();
    finish(true);
  }

  const confirmLeaveRef = useRef(confirmLeave);
  const dirtyGuardsRef = useRef(dirtyGuards);
  confirmLeaveRef.current = confirmLeave;
  dirtyGuardsRef.current = dirtyGuards;

  const api = useRef<UnsavedChangesContextValue | null>(null);
  if (!api.current) {
    api.current = {
      register(id, read, scope) {
        guards.current.set(id, { read, scope });
        return () => {
          guards.current.delete(id);
        };
      },
      confirmLeave: (proceed, scope) => confirmLeave(proceed, scope),
    };
  }
  api.current.confirmLeave = (proceed, scope) => confirmLeave(proceed, scope);

  useEffect(() => {
    function onClick(event: MouseEvent): void {
      if (bypass.current || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }
      if (dirtyGuardsRef.current().length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void confirmLeaveRef.current(() => {
        bypass.current = true;
        window.location.assign(destination.href);
      });
    }

    function onBeforeUnload(event: BeforeUnloadEvent): void {
      if (bypass.current || dirtyGuardsRef.current().length === 0) return;
      event.preventDefault();
      event.returnValue = "";
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return (
    <UnsavedChangesContext.Provider value={api.current}>
      {children}
      <Modal
        open={pending !== null}
        title={t("unsavedTitle")}
        description={t("unsavedBody")}
        onClose={() => finish(false)}
      >
        <Button type="button" variant="outline" onClick={() => finish(false)} disabled={isSaving}>
          {t("keepEditing")}
        </Button>
        <Button type="button" variant="outline" onClick={discardAndLeave} disabled={isSaving}>
          {t("discardChanges")}
        </Button>
        <Button type="button" onClick={() => void saveAndLeave()} disabled={isSaving} autoFocus>
          {isSaving ? t("saving") : t("saveChanges")}
        </Button>
      </Modal>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges(id: string, guard: UnsavedGuard): void {
  const { register } = useContext(UnsavedChangesContext);
  const scope = useContext(StepScopeContext);
  const latest = useRef(guard);
  latest.current = guard;

  useEffect(() => {
    return register(id, () => latest.current, scope);
  }, [register, id, scope]);
}

export function useConfirmLeave(): (proceed?: () => void, scope?: string) => Promise<boolean> {
  return useContext(UnsavedChangesContext).confirmLeave;
}
