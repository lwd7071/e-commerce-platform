import { cloneElement, isValidElement, useEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type FieldProps = {
  id: string;
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

export function FormField({ id, label, helpText, error, required, children }: FieldProps) {
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const accessibleControl = isValidElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
  }>(children)
    ? cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;

  return (
    <div className="field-stack">
      <label className="field-label" htmlFor={id}>
        {label}{required && <span aria-hidden="true"> *</span>}
      </label>
      {accessibleControl}
      {helpText && <p className="field-help" id={helpId}>{helpText}</p>}
      {error && <p className="field-error" id={errorId} role="alert">{error}</p>}
    </div>
  );
}

type ControlProps = { id: string; error?: string; describedBy?: string };

export function TextInput({ id, error, describedBy, className = "", "aria-describedby": callerDescribedBy, "aria-invalid": callerInvalid, ...props }: InputHTMLAttributes<HTMLInputElement> & ControlProps) {
  return (
    <input
      id={id}
      className={`form-control ${className}`.trim()}
      aria-invalid={error ? true : callerInvalid}
      aria-describedby={[callerDescribedBy, describedBy, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined}
      {...props}
    />
  );
}

export function TextArea({ id, error, describedBy, className = "", "aria-describedby": callerDescribedBy, "aria-invalid": callerInvalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & ControlProps) {
  return (
    <textarea
      id={id}
      className={`form-control ${className}`.trim()}
      aria-invalid={error ? true : callerInvalid}
      aria-describedby={[callerDescribedBy, describedBy, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined}
      {...props}
    />
  );
}

export function SelectInput({ id, error, describedBy, className = "", children, "aria-describedby": callerDescribedBy, "aria-invalid": callerInvalid, ...props }: SelectHTMLAttributes<HTMLSelectElement> & ControlProps) {
  return (
    <select
      id={id}
      className={`form-control ${className}`.trim()}
      aria-invalid={error ? true : callerInvalid}
      aria-describedby={[callerDescribedBy, describedBy, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function ErrorSummary({ id = "form-errors", title = "Kiểm tra lại thông tin", errors }: { id?: string; title?: string; errors: Array<{ fieldId: string; message: string }> }) {
  const summaryRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (errors.length > 0) summaryRef.current?.focus();
  }, [errors]);
  if (errors.length === 0) return null;

  return (
    <section ref={summaryRef} className="field-error-summary" role="alert" tabIndex={-1} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <ul>
        {errors.map((item) => (
          <li key={item.fieldId}><a href={`#${item.fieldId}`}>{item.message}</a></li>
        ))}
      </ul>
    </section>
  );
}
