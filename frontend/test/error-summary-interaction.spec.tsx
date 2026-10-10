// @vitest-environment jsdom

import { useState, type FormEvent } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ErrorSummary, FormField, TextInput } from "@/components/ui/form-controls";

type FieldError = { fieldId: string; message: string };

function ValidationForm({ valid = false }: { valid?: boolean }) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors(valid ? [] : [
      { fieldId: "email", message: "Email chưa hợp lệ" },
      { fieldId: "password", message: "Mật khẩu quá ngắn" },
    ]);
  };

  return (
    <form noValidate onSubmit={submit}>
      <ErrorSummary errors={errors} />
      <FormField id="email" label="Email" error={errors.find((error) => error.fieldId === "email")?.message}>
        <TextInput id="email" type="email" />
      </FormField>
      <FormField id="password" label="Mật khẩu" error={errors.find((error) => error.fieldId === "password")?.message}>
        <TextInput id="password" type="password" />
      </FormField>
      <button type="submit">Lưu</button>
    </form>
  );
}

describe("ErrorSummary form behavior", () => {
  it("focuses the summary after an invalid submit and keeps field errors connected", async () => {
    const user = userEvent.setup();
    render(<ValidationForm />);

    await user.click(screen.getByRole("button", { name: "Lưu" }));
    const summary = await screen.findByRole("alert", { name: "Kiểm tra lại thông tin" });
    await waitFor(() => expect(document.activeElement).toBe(summary));

    expect(screen.getByRole("link", { name: "Email chưa hợp lệ" }).getAttribute("href")).toBe("#email");
    expect(screen.getByRole("link", { name: "Mật khẩu quá ngắn" }).getAttribute("href")).toBe("#password");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Email").getAttribute("aria-describedby")).toBe("email-error");
    expect(screen.getByLabelText("Mật khẩu").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Mật khẩu").getAttribute("aria-describedby")).toBe("password-error");
    expect(screen.getByText("Email chưa hợp lệ", { selector: "p.field-error" })).not.toBeNull();
    expect(screen.getByText("Mật khẩu quá ngắn", { selector: "p.field-error" })).not.toBeNull();
  });

  it("does not render or take focus when a valid form is submitted", async () => {
    const user = userEvent.setup();
    render(<ValidationForm valid />);

    const submit = screen.getByRole("button", { name: "Lưu" });
    await user.click(submit);

    expect(screen.queryByRole("alert", { name: "Kiểm tra lại thông tin" })).toBeNull();
    expect(document.activeElement).toBe(submit);
  });
});
