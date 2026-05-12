'use client';

export function LoginScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white px-8 py-10 shadow-lg">
        {/* Logo + 产品名 */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white text-xl font-bold">
            X
          </div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-wide">
            XPENG 差旅管家
          </h1>
          <p className="text-sm text-gray-500 text-center">
            AI 驱动的智能差旅行程规划平台
          </p>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-gray-100 mb-8" />

        {/* 登录按钮 */}
        <a
          href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/feishu/auth`}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#3370FF' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2860E0')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3370FF')}
        >
          {/* 飞书 icon */}
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.5 3.5L9.19 7.16C9.72 7.58 10.37 7.84 11.05 7.92L19.5 8.89L12.18 16.21C11.79 16.6 11.27 16.83 10.73 16.86L4.82 17.17C4.47 17.19 4.2 16.84 4.35 16.52L7.5 10L4.5 3.5Z" />
          </svg>
          通过飞书授权登录
        </a>

        {/* 底部提示 */}
        <p className="mt-6 text-center text-xs text-gray-400">
          点击登录即表示您同意使用飞书账号进行身份验证
        </p>
      </div>
    </div>
  );
}
