import { cn } from '@/lib/utils';

interface RatingBadgeProps {
  rating: 'S' | 'A' | 'B' | 'C' | 'D';
  size?: 'sm' | 'md' | 'lg';
}

const ratingColors: Record<RatingBadgeProps['rating'], string> = {
  S: 'bg-rating-S text-white',
  A: 'bg-rating-A text-gray-900',
  B: 'bg-rating-B text-white',
  C: 'bg-rating-C text-white',
  D: 'bg-rating-D text-white',
};

const sizeClasses = {
  sm: 'h-5 w-5 text-xs',
  md: 'h-6 w-6 text-sm',
  lg: 'h-8 w-8 text-base',
};

export function RatingBadge({ rating, size = 'md' }: RatingBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold',
        ratingColors[rating],
        sizeClasses[size]
      )}
      aria-label={`评级 ${rating}`}
    >
      {rating}
    </span>
  );
}
