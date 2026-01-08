import React from "react";
import { cn } from "@/lib/utils";

interface PhoneContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PhoneContainer: React.FC<PhoneContainerProps> = ({ children, className }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 md:py-4 md:px-4">
      <div
        className={cn(
          // ✅ KEY: fixed height on all screens + flex column
          "phone-container relative flex flex-col w-full h-[100dvh] overflow-hidden",
          // keep your desktop “framed phone” behavior
          "md:rounded-3xl md:h-[calc(100vh-2rem)]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
};