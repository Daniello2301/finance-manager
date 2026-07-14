import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useConfirmStore } from "@/stores/confirm.store";
import { confirmAction } from "@/lib/notifications";

afterEach(() => {
  useConfirmStore.setState({ pending: null, resolve: null });
});

describe("ConfirmDialog", () => {
  it("renders nothing until a confirmation is raised", () => {
    render(<ConfirmDialog />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the title, the text and the default button labels", async () => {
    render(<ConfirmDialog />);
    void confirmAction({ title: "¿Eliminar?", text: "No se puede deshacer." });

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("¿Eliminar?")).toBeInTheDocument();
    expect(screen.getByText("No se puede deshacer.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sí, continuar" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("shows custom button labels when given", async () => {
    render(<ConfirmDialog />);
    void confirmAction({
      title: "¿Eliminar?",
      confirmButtonText: "Eliminar",
      cancelButtonText: "No, dejarla",
    });

    expect(
      await screen.findByRole("button", { name: "Eliminar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No, dejarla" })
    ).toBeInTheDocument();
  });

  it("the confirm button resolves the promise with true and closes", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    const answer = confirmAction({ title: "¿Eliminar?" });

    await user.click(await screen.findByRole("button", { name: "Sí, continuar" }));

    await expect(answer).resolves.toBe(true);
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it("the cancel button resolves the promise with false", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    const answer = confirmAction({ title: "¿Eliminar?" });

    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    await expect(answer).resolves.toBe(false);
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it("Escape resolves the promise with false", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    const answer = confirmAction({ title: "¿Eliminar?" });
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");

    await expect(answer).resolves.toBe(false);
  });
});
