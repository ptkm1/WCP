import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { applyAppTheme, readStoredAppThemeId } from "./lib/app-theme";
import "./index.css";

applyAppTheme(readStoredAppThemeId());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
