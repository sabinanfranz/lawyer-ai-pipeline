"use client";

import React from "react";
import { TopBarProvider } from "./TopBarContext";
import TopBar from "./TopBar";

export default function TopBarShell({ children }: { children: React.ReactNode }) {
  return (
    <TopBarProvider>
      <TopBar />
      {children}
    </TopBarProvider>
  );
}
