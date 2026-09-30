'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Notice = {
  id: number;
  message: string;
  tone: 'error' | 'success';
};

const NotificationContext = createContext<{
  notify: (message: string, tone?: Notice['tone']) => void;
}>({ notify: () => {} });

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const notify = useCallback(
    (message: string, tone: Notice['tone'] = 'error') => {
      const id = Date.now();
      setNotices((items) => [...items, { id, message, tone }]);
      setTimeout(
        () => setNotices((items) => items.filter((item) => item.id !== id)),
        4500
      );
    },
    []
  );

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-50 grid gap-2"
        aria-live="polite"
      >
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`rounded-md border px-4 py-3 text-sm shadow-lg ${
              notice.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-zinc-300 bg-white text-zinc-900'
            }`}
          >
            {notice.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);