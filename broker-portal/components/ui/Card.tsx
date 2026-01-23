/**
 * Card Components
 *
 * Professional card layouts with shadows, borders, and hover states.
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Base Card Component
 */
export function Card({
  children,
  className,
  hover = false,
  padding = 'md',
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-sm border border-gray-200',
        hover && 'transition-shadow hover:shadow-md',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card Header
 */
export function CardHeader({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between pb-4 border-b border-gray-200 mb-4',
        className
      )}
    >
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * Card Title
 */
export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900', className)}>
      {children}
    </h3>
  );
}

/**
 * Card Description
 */
export function CardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('text-sm text-gray-500 mt-1', className)}>{children}</p>
  );
}

/**
 * Card Content
 */
export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(className)}>{children}</div>;
}

/**
 * Card Footer
 */
export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 pt-4 border-t border-gray-200 mt-4',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Stats Card
 */
export function StatsCard({
  label,
  value,
  trend,
  trendDirection,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  className?: string;
}) {
  const trendColors = {
    up: 'text-green-600 bg-green-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50',
  };

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          {trend && trendDirection && (
            <div
              className={cn(
                'inline-flex items-center mt-2 px-2 py-1 rounded-full text-xs font-medium',
                trendColors[trendDirection]
              )}
            >
              {trendDirection === 'up' && (
                <svg
                  className="w-3 h-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {trendDirection === 'down' && (
                <svg
                  className="w-3 h-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {trend}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-full bg-blue-50 text-blue-600">{icon}</div>
        )}
      </div>
    </Card>
  );
}

/**
 * List Card - for displaying lists within a card
 */
export function ListCard({
  title,
  items,
  emptyMessage = 'No items',
  className,
}: {
  title: string;
  items: Array<{ id: string; label: string; subLabel?: string; action?: ReactNode }>;
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <Card padding="none" className={className}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-500">{emptyMessage}</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li
              key={item.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                {item.subLabel && (
                  <p className="text-sm text-gray-500">{item.subLabel}</p>
                )}
              </div>
              {item.action}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
