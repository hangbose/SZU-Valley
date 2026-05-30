import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/ui/App";

// Global reset — minimal base styles (will be replaced by palette.css from D)
const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html, body, #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #1a1a2e;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  input, button {
    font-family: inherit;
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
