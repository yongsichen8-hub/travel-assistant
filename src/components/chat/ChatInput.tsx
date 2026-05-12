'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTravelConfig } from '@/lib/config/travel-config-context';

export function ChatInput({
  onSend,
  isLoading,
}: {
  onSend: (text: string) => void;
  isLoading: boolean;
}) {
  const { config } = useTravelConfig();
  const [input, setInput] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0); // @ 符号在 input 中的位置
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 过滤出匹配的 profiles
  const filteredProfiles = config.profiles.filter((p) =>
    p.name.toLowerCase().startsWith(mentionQuery.toLowerCase())
  );

  // 监听输入变化，检测 @ 触发
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;
    setInput(value);

    // 从光标位置往前扫描，查找最近的 @
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      // @ 前必须是行首或空格
      const charBefore = atIndex > 0 ? value[atIndex - 1] : ' ';
      const query = textBeforeCursor.slice(atIndex + 1);
      // query 不能包含空格（有空格说明已经完成输入）
      const isValidTrigger = (charBefore === ' ' || charBefore === '\n' || atIndex === 0)
        && !query.includes(' ')
        && config.profiles.length > 0;

      if (isValidTrigger) {
        setMentionOpen(true);
        setMentionQuery(query);
        setMentionStart(atIndex);
        setSelectedIndex(0);
        return;
      }
    }

    setMentionOpen(false);
    setMentionQuery('');
  };

  // 选择某个 profile 进行补全
  const selectProfile = useCallback((profileName: string) => {
    const cursorPos = textareaRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, mentionStart);
    const after = input.slice(cursorPos);
    const newValue = `${before}@${profileName} ${after}`;
    setInput(newValue);
    setMentionOpen(false);
    setMentionQuery('');

    // 将光标移到补全文本后面
    const newCursorPos = mentionStart + profileName.length + 2; // @ + name + space
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [input, mentionStart]);

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && filteredProfiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredProfiles.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredProfiles.length) % filteredProfiles.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectProfile(filteredProfiles[selectedIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }

    // 正常的提交逻辑
    if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 失焦关闭（延迟以允许鼠标点击菜单项）
  const handleBlur = () => {
    setTimeout(() => {
      // 如果焦点不在菜单内，关闭
      if (!menuRef.current?.contains(document.activeElement)) {
        setMentionOpen(false);
      }
    }, 150);
  };

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInput('');
    setMentionOpen(false);
  };

  // 当过滤结果变化时，确保 selectedIndex 不越界
  useEffect(() => {
    if (selectedIndex >= filteredProfiles.length) {
      setSelectedIndex(Math.max(0, filteredProfiles.length - 1));
    }
  }, [filteredProfiles.length, selectedIndex]);

  return (
    <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-700">
      <div className="relative flex items-end gap-2">
        {/* Mention 悬浮菜单 */}
        {mentionOpen && filteredProfiles.length > 0 && (
          <div
            ref={menuRef}
            className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          >
            <div className="px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              选择偏好方案
            </div>
            {filteredProfiles.map((profile, index) => (
              <button
                key={profile.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // 阻止 textarea 失焦
                  selectProfile(profile.name);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {profile.name[0]}
                </span>
                <span>{profile.name}</span>
                {profile.isDefault && (
                  <span className="ml-auto text-xs text-zinc-400">默认</span>
                )}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="描述你的出行需求... (输入 @ 选择偏好方案)"
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '思考中...' : '发送'}
        </button>
      </div>
    </form>
  );
}
