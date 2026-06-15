import { Package } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center">
          <Package className="w-8 h-8 text-text-secondary" />
        </div>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="flex items-center justify-center gap-3">
        {actionLabel && actionHref && (
          <Link href={actionHref} className="btn btn-primary">
            {actionLabel}
          </Link>
        )}
        {secondaryLabel && secondaryHref && (
          <Link href={secondaryHref} className="btn btn-secondary">
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
