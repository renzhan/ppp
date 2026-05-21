import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
}

export function PageHeader({ title, description, actions, backHref }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft size={18} />
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
