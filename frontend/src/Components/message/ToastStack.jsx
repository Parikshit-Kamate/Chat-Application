import React from 'react';

function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item ${toast.tone}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}

export default ToastStack;
