import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

if (import.meta.env.DEV) {
  console.log(
    "%c🔭 %cStatecraft Online %c— %cSingh says: network panel first, assumptions second.",
    "font-size:1.2em",
    "font-weight:bold;color:#8fd8bc",
    "",
    "color:#9da59f;font-style:italic"
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
