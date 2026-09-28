import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  leadingIcon,
  trailingIcon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      disabled={disabled || loading}
      type={type}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Icon name="spinner" className="button__spinner" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, className = "", children, ...props }: IconButtonProps) {
  return (
    <button
      className={`icon-button ${className}`.trim()}
      type="button"
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}
