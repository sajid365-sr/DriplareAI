import { create } from "zustand";

interface ConfirmStore {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  confirm: (title: string, message: string, onConfirm: () => void) => void;
}

// Check if zustand is installed, if not I will use a simple state management or create it
export const useConfirm = create<ConfirmStore>((set) => ({
  isOpen: false,
  title: "",
  message: "",
  onConfirm: () => {},
  onClose: () => set({ isOpen: false }),
  confirm: (title, message, onConfirm) => set({ 
    isOpen: true, 
    title, 
    message, 
    onConfirm: () => {
      onConfirm();
      set({ isOpen: false });
    }
  }),
}));
