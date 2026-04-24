import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { OrganizationRole, ResourcePhase } from "@sourceplane/contracts";

const phaseColors: Record<ResourcePhase, string> = {
  degraded: "#c46210",
  deleted: "#6d7485",
  deleting: "#a23e48",
  draft: "#6d7485",
  failed: "#a23e48",
  pending: "#d08c00",
  provisioning: "#0f766e",
  ready: "#1f7a1f"
};

export interface AppShellProps {
  eyebrow: string;
  title: string;
  nav?: ReactNode;
  topBar?: ReactNode;
}

export function AppShell({ children, eyebrow, title, nav, topBar }: PropsWithChildren<AppShellProps>) {
  return (
    <div className="sp-app">
      {nav ? <aside className="sp-app__nav">{nav}</aside> : null}
      <main className="sp-shell">
        <div className="sp-shell__frame">
          {topBar ? <div className="sp-shell__topbar">{topBar}</div> : null}
          <p className="sp-shell__eyebrow">{eyebrow}</p>
          <h1 className="sp-shell__title">{title}</h1>
          <div className="sp-shell__content">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function SectionCard({ children, title, action }: PropsWithChildren<{ title: string; action?: ReactNode }>) {
  return (
    <section className="sp-card">
      <header className="sp-card__head">
        <h2 className="sp-card__title">{title}</h2>
        {action ? <div className="sp-card__action">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function StatusPill({ phase }: { phase: ResourcePhase }) {
  return (
    <span className="sp-pill" style={{ backgroundColor: phaseColors[phase] }}>
      {phase}
    </span>
  );
}

export interface NavItem {
  key: string;
  label: string;
  to: string;
  isActive?: boolean;
  badge?: string;
}

export interface NavProps {
  items: NavItem[];
  header?: ReactNode;
  footer?: ReactNode;
  onNavigate: (to: string) => void;
}

export function Nav({ items, header, footer, onNavigate }: NavProps) {
  return (
    <nav className="sp-nav" aria-label="Primary">
      {header ? <div className="sp-nav__header">{header}</div> : null}
      <ul className="sp-nav__list">
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={item.to}
              className={`sp-nav__link${item.isActive ? " sp-nav__link--active" : ""}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.to);
              }}
            >
              <span>{item.label}</span>
              {item.badge ? <span className="sp-nav__badge">{item.badge}</span> : null}
            </a>
          </li>
        ))}
      </ul>
      {footer ? <div className="sp-nav__footer">{footer}</div> : null}
    </nav>
  );
}

export interface BreadcrumbItem {
  key: string;
  label: string;
  to?: string;
}

export function Breadcrumbs({ items, onNavigate }: { items: BreadcrumbItem[]; onNavigate: (to: string) => void }) {
  return (
    <nav className="sp-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.key}>
              {item.to && !isLast ? (
                <a
                  href={item.to}
                  onClick={(event) => {
                    event.preventDefault();
                    if (item.to) onNavigate(item.to);
                  }}
                >
                  {item.label}
                </a>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
              {!isLast ? <span className="sp-breadcrumbs__sep" aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}

export function Button({ variant = "primary", loading, disabled, children, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      className={`sp-btn sp-btn--${variant}${className ? ` ${className}` : ""}`}
      aria-busy={loading ? true : undefined}
      {...rest}
    >
      {loading ? <span className="sp-btn__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, hint, error, children }: FormFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={`sp-field${error ? " sp-field--error" : ""}`}>
      <label htmlFor={htmlFor} className="sp-field__label">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="sp-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="sp-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextField({ invalid, className, type = "text", ...rest }: TextFieldProps) {
  return (
    <input
      type={type}
      className={`sp-input${invalid ? " sp-input--invalid" : ""}${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={`sp-input sp-select${invalid ? " sp-input--invalid" : ""}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sp-modal-backdrop" onClick={onClose}>
      <div
        className="sp-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sp-modal__head">
          <h2 id="sp-modal-title" className="sp-modal__title">
            {title}
          </h2>
          <button type="button" className="sp-modal__close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </header>
        <div className="sp-modal__body">{children}</div>
        {footer ? <footer className="sp-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  caption?: string;
}

export function Table<T>({ columns, rows, rowKey, emptyMessage = "No records yet.", caption }: TableProps<T>) {
  return (
    <table className="sp-table">
      {caption ? <caption className="sp-table__caption">{caption}</caption> : null}
      <thead>
        <tr>
          {columns.map((column) => (
            <Th key={column.key} style={column.width ? { width: column.width } : undefined}>
              {column.header}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <Td colSpan={columns.length} className="sp-table__empty">
              {emptyMessage}
            </Td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <Td key={column.key}>{column.render(row)}</Td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function Th({ children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" {...rest}>
      {children}
    </th>
  );
}

function Td({ children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest}>{children}</td>;
}

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  reference?: { label: string; href: string };
}

export function EmptyState({ title, description, action, reference }: EmptyStateProps) {
  return (
    <div className="sp-empty">
      <h3 className="sp-empty__title">{title}</h3>
      {description ? <p className="sp-empty__description">{description}</p> : null}
      {reference ? (
        <p className="sp-empty__reference">
          See spec:{" "}
          <a href={reference.href} target="_blank" rel="noreferrer">
            {reference.label}
          </a>
        </p>
      ) : null}
      {action ? <div className="sp-empty__action">{action}</div> : null}
    </div>
  );
}

export type ToastVariant = "info" | "success" | "error";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  detail?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSerial = 0;

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<ToastContextValue["push"]>((toast) => {
    toastSerial += 1;
    const id = toast.id ?? `toast_${String(toastSerial)}`;
    setToasts((prev) => [...prev, { variant: toast.variant ?? "info", message: toast.message, ...(toast.detail !== undefined ? { detail: toast.detail } : {}), id }]);
    setTimeout(() => dismiss(id), (toast.variant ?? "info") === "error" ? 8000 : 4500);
    return id;
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="sp-toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`sp-toast sp-toast--${toast.variant}`} role="status">
            <div className="sp-toast__content">
              <strong>{toast.message}</strong>
              {toast.detail ? <span className="sp-toast__detail">{toast.detail}</span> : null}
            </div>
            <button
              type="button"
              className="sp-toast__close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return context;
}

const roleColors: Record<OrganizationRole, string> = {
  owner: "#a23e48",
  admin: "#0f766e",
  builder: "#1f5fa8",
  viewer: "#6d7485",
  billing_admin: "#c46210"
};

export function RoleBadge({ role }: { role: OrganizationRole }) {
  return (
    <span className="sp-role-badge" style={{ backgroundColor: roleColors[role] }}>
      {role.replace("_", " ")}
    </span>
  );
}
