"use client";

import { Button } from "@/components/ui/button";
import { useAccountModalStore } from "@/stores/accountModal.store";
import { useTransferModalStore } from "@/stores/transferModal.store";
import { AccountForm } from "./components/AccountForm";
import { AccountList } from "./components/AccountList";
import { TransferForm } from "./components/TransferForm";

export default function AccountsPage() {
  const openCreate = useAccountModalStore((state) => state.openCreate);
  const transfer = useTransferModalStore();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Cuentas</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => transfer.open()}>
            Transferir
          </Button>
          <Button onClick={openCreate}>Nueva cuenta</Button>
        </div>
      </div>
      <AccountList />
      <AccountForm />
      <TransferForm
        open={transfer.isOpen}
        onClose={transfer.close}
        defaultToAccountId={transfer.toAccountId}
        defaultAmount={transfer.amount}
      />
    </div>
  );
}
