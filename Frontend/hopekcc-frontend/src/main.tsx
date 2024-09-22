import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { GoogleOAuthProvider } from '@react-oauth/google';

const queryClient = new QueryClient();
const clientId = "172531116306-onf46pdprbkm7hmaqibcptpjslv4ph25.apps.googleusercontent.com";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={clientId}>
    <QueryClientProvider client={queryClient}>
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);