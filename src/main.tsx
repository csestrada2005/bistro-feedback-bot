import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Silenciar console en producción
if (import.meta.env.PROD) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

createRoot(document.getElementById("root")!).render(<App />);
