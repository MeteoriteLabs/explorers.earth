import { FC, ReactNode } from "react";
import { createPortal } from "react-dom";
import CrossIcon from "../../assets/icons/CrossIcon";

// types for modal component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  type?: string;
}

const Modal: FC<ModalProps> = ({ isOpen, onClose, children, type }) => {
  // edge case when modal is not open or the state is false
  if (!isOpen) return null;

  return createPortal(
    <div 
      className={`dashboard-theme fixed inset-0 z-[9999] flex items-center justify-center bg-dashboard-overlay backdrop-blur-sm p-2 sm:p-4 ${
        type === 'crop' ? 'bg-black/80' : ''
      }`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="relative">
        {/* Close button positioned in top right corner */}
        {type !== "crop" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute -top-2 -right-2 sm:top-2 sm:right-2 text-dashboard hover:text-dashboard-light z-20 p-2 rounded-full border border-dashboard hover:border-dashboard-accent transition-colors duration-200 bg-dashboard-sidebar backdrop-blur-sm"
          >
            <CrossIcon stroke="#ffffff" size="5" />
          </button>
        )}
        
        <div
          className={`bg-dashboard-sidebar backdrop-blur-sm rounded-2xl border-2 border-gray-600 w-full ${
            type === "crop" 
              ? "p-0" 
              : "p-0"
          } relative my-auto transform transition-all duration-300 ease-out overflow-hidden`}
          style={{
            minWidth: type === "crop" ? '360px' : '360px',
            maxWidth: type === "crop" ? 'calc(100vw - 1rem)' : 'calc(100vw - 0.5rem)',
            width: type === "crop" ? 'clamp(360px, 85vw, 1000px)' : 'clamp(360px, 98vw, 800px)',
            maxHeight: '95vh',
            minHeight: type === "crop" ? 'clamp(400px, 60vh, 80vh)' : 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content text-dashboard font-poppins">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
