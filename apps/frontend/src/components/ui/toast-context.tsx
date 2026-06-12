import { createContext, useContext } from 'react';
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription } from './toast';
import { useToast } from './use-toast';

const ToastContext = createContext<{ notify: (title: string, description?: string) => void } | null>(
  null
);

export const useToastContext = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastContext must be used within ToastHost');
  }
  return ctx;
};

export const ToastHost = ({ children }: { children: React.ReactNode }) => {
  const { toasts, notify, dismiss } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      <ToastContext.Provider value={{ notify: (title, description) => notify({ title, description }) }}>
        {children}
        {toasts.map((toast) => (
          <Toast key={toast.id} onOpenChange={(open: boolean) => !open && dismiss(toast.id)}>
            <ToastTitle className="text-sm font-semibold">{toast.title}</ToastTitle>
            {toast.description ? (
              <ToastDescription className="text-xs text-muted">{toast.description}</ToastDescription>
            ) : null}
          </Toast>
        ))}
        <ToastViewport />
      </ToastContext.Provider>
    </ToastProvider>
  );
};
