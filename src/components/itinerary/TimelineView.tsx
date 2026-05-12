'use client';

import type { DayPlan } from '@/lib/types/itinerary';
import { DayCard } from './DayCard';

export function TimelineView({ days }: { days: DayPlan[] }) {
  return (
    <div className="space-y-6">
      {days.map((day) => (
        <DayCard key={day.dayNumber} day={day} />
      ))}
    </div>
  );
}
