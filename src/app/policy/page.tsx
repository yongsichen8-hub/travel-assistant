'use client';

import { PolicySection } from '@/components/settings/PolicySection';

export default function PolicyPage() {
  return (
    <div className="h-full bg-white dark:bg-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80">
        <div className="px-6 py-3">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            差旅政策
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <PolicySection />
      </main>
    </div>
  );
}
