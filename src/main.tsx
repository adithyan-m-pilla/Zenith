import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/lib/clear-sessions"; // Expose clearTodaysSessions to window

createRoot(document.getElementById("root")!).render(<App />);
