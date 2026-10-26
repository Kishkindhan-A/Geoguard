import React from "react";
import ReactDOM from "react-dom/client";
import App from "./OperationalApp";
import WorkspaceBoundary from "./WorkspaceBoundary";
import "./operations.css";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WorkspaceBoundary>
      <App />
    </WorkspaceBoundary>
  </React.StrictMode>,
);
