import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((ts) => [...ts.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 2500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
            <span>{t.message}</span>
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <FiX />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
