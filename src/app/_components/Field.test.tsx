import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field, Input } from "./Field";

/**
 * Field + Input — form primitive a11y contract. Tests assert the label↔control
 * association (real <label htmlFor>), hint via aria-describedby, error via
 * aria-errormessage + aria-invalid, and that placeholder/disabled/loading states
 * keep the control reachable and correctly described.
 */
describe("Field + Input", () => {
  it("wires a real <label> to the control by id (getByLabelText works)", () => {
    render(
      <Field label="Reduction target">
        {(props) => <Input {...props} placeholder="e.g. 10" />}
      </Field>,
    );
    const input = screen.getByLabelText("Reduction target");
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveAttribute("id");
  });

  it("associates the hint via aria-describedby", () => {
    render(
      <Field label="Email" hint="We never share it.">
        {(props) => <Input {...props} type="email" />}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "We never share it.",
    );
  });

  it("error sets aria-invalid + aria-errormessage pointing at the message", () => {
    render(
      <Field label="Reduction target" error="Enter a value between 1 and 90.">
        {(props) => <Input {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText("Reduction target");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const errId = input.getAttribute("aria-errormessage");
    expect(errId).toBeTruthy();
    expect(document.getElementById(errId as string)).toHaveTextContent(
      /between 1 and 90/i,
    );
  });

  it("required mirrors onto the control and marks the label", () => {
    render(
      <Field label="Name" required>
        {(props) => <Input {...props} />}
      </Field>,
    );
    expect(screen.getByLabelText(/Name/)).toBeRequired();
  });

  it("loading makes the input read-only + aria-busy without losing its label", () => {
    render(
      <Field label="Lookup">{(props) => <Input {...props} loading />}</Field>,
    );
    const input = screen.getByLabelText("Lookup");
    expect(input).toHaveAttribute("aria-busy", "true");
    expect(input).toHaveAttribute("readonly");
  });
});
