// components/EnterKeyHandler.tsx
import { useEffect } from "react";

interface EnterKeyHandlerProps {
  onEnter?: () => void;
}

const EnterKeyHandler: React.FC<EnterKeyHandlerProps> = ({ onEnter }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && onEnter) {
        onEnter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEnter]);

  return null;
};

export default EnterKeyHandler;
