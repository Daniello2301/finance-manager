"use client";

import { Button } from "@/components/ui/button";
import { useAccountModalStore } from "@/stores/accountModal.store";
import { AccountForm } from "./components/AccountForm";
import { AccountList } from "./components/AccountList";

export default function AccountsPage() {
  const openCreate = useAccountModalStore((state) => state.openCreate);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Cuentas</h1>
        <Button onClick={openCreate}>Nueva cuenta</Button>
      </div>
      <AccountList />
      <AccountForm />
    </div>
  );
}
