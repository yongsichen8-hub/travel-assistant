import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ConfigProvider } from "@/components/providers/ConfigProvider";
import { FeishuUserProvider } from "@/components/providers/FeishuUserProvider";
import { ChatStoreProvider } from "@/lib/store/chat-store";
import { AppShell } from "@/components/layout/AppShell";
import type { FeishuUser } from "@/lib/auth/feishu-user-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "差旅规划助手",
  description: "AI 驱动的智能差旅行程规划",
};

function readUserFromCookie(cookieValue: string | undefined): FeishuUser | null {
  if (!cookieValue) return null;
  try {
    const json = Buffer.from(cookieValue, 'base64').toString('utf-8');
    const data = JSON.parse(json);
    if (data.name && data.openId) return data as FeishuUser;
  } catch {
    // Cookie 解析失败
  }
  return null;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const feishuCookie = cookieStore.get('feishu_user');
  const initialUser = readUserFromCookie(feishuCookie?.value);

  return (
    <html
      suppressHydrationWarning
      lang="zh-CN"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="h-full overflow-hidden">
        <ConfigProvider>
          <FeishuUserProvider initialUser={initialUser}>
            <ChatStoreProvider>
              <AppShell>
                {children}
              </AppShell>
            </ChatStoreProvider>
          </FeishuUserProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
