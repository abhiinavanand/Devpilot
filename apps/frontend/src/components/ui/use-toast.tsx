import { useCallback, useState } from 'react';

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
};

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, notify, dismiss };
};
