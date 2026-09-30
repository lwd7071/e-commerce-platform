import { useId } from "react";
import { Button } from "./button";
import { Icon } from "./icon";

export function Skeleton({ className = "", height = 18 }: { className?: string; height?: number }) {
  return <div className={`skeleton ${className}`.trim()} style={{ height }} aria-hidden="true" />;
}

export function EmptyState({ title, description, icon = "info", action }: { title: string; description: string; icon?: "bag" | "bell" | "info" | "user"; action?: { label: string; onClick: () => void } }) {
  const titleId = useId();
  return <section className="empty-state surface-card" aria-labelledby={titleId}><span className="empty-state__icon"><Icon name={icon} /></span><h2 id={titleId}>{title}</h2><p>{description}</p>{action && <Button variant="secondary" onClick={action.onClick}>{action.label}</Button>}</section>;
}

export function ErrorState({ title = "Chưa tải được dữ liệu", description = "Vui lòng thử lại. Nếu sự cố tiếp tục, hãy quay lại sau.", requestId, onRetry }: { title?: string; description?: string; requestId?: string; onRetry: () => void }) {
  const titleId = useId();
  return <section className="error-state surface-card" aria-labelledby={titleId}><span className="empty-state__icon"><Icon name="warning" /></span><h2 id={titleId}>{title}</h2><p>{description}{requestId && <><br /><small>Mã yêu cầu: {requestId}</small></>}</p><Button variant="secondary" onClick={onRetry}>Thử lại</Button></section>;
}
