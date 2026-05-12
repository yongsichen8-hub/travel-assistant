'use client';

export function MessageBubble({
  role,
  content,
}: {
  role: string;
  content: string;
}) {
  const isUser = role === 'user';

  if (!content) return null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
        }`}
      >
        {content}
      </div>
    </div>
  );
}
