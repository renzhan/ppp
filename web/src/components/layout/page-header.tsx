import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  titleClassName?: string;
  actions?: React.ReactNode;
  backHref?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function PageHeader({ title, description, titleClassName, actions, backHref, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {/* Breadcrumb navigation */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-gray-500">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && <span className="text-gray-400">/</span>}
                {isLast || !item.href ? (
                  <span className="text-gray-900">{item.label}</span>
                ) : (
                  <Link href={item.href} className="hover:text-gray-700 transition-colors">
                    {item.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {/* Title row with actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <div>
            <h1 className={`text-2xl tracking-tight text-gray-900 ${titleClassName ?? 'font-bold'}`}>
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * Section divider title component.
 * Used for section headings like "已完成的复盘" within page content.
 */
interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionTitle({ children, className = '' }: SectionTitleProps) {
  return (
    <h2 className={`text-lg font-semibold border-b border-gray-200 pb-2 text-gray-900 ${className}`}>
      {children}
    </h2>
  );
}
