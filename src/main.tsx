import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import Landing   from "./Landing.jsx";
import LandingV2 from "./LandingV2.jsx";
import LandingV3 from "./LandingV3.jsx";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"    element={<LandingV2 />} />
        <Route path="/v1"  element={<Landing />} />
        <Route path="/v3"  element={<LandingV3 />} />
        <Route path="/app" element={<App />} />
        <Route path="*"    element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  </StrictMode>
);
