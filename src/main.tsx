import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";
import { GOOGLE_CLIENT_ID } from "./config/api";

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || "placeholder"}>
    <App />
  </GoogleOAuthProvider>
);
