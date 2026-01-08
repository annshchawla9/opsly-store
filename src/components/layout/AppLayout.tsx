import React from "react";
import { Outlet } from "react-router-dom";
import { PhoneContainer } from "./PhoneContainer";
import { BottomNav } from "./BottomNav";

export const AppLayout: React.FC = () => {
  return (
    <PhoneContainer>
      <div className="flex flex-col h-full">
        <main className="flex-1 overflow-y-auto pb-24">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </PhoneContainer>
  );
};
