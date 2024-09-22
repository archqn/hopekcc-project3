import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";

// Define the structure of the decoded token
interface DecodedToken {
  email: string;
}

interface BaseDirectoryContextType {
  baseDirectory: string | null;
  setBaseDirectory: (baseDirectory: string | null) => void;
}

// Add a type for the children prop
interface BaseDirectoryProviderProps {
  children: ReactNode;
}

const BaseDirectoryContext = createContext<BaseDirectoryContextType | undefined>(undefined);

export const useBaseDirectory = (): BaseDirectoryContextType => {
  const context = useContext(BaseDirectoryContext);
  if (!context) {
    throw new Error("useBaseDirectory must be used within a BaseDirectoryProvider");
  }
  return context;
};

export const BaseDirectoryProvider: React.FC<BaseDirectoryProviderProps> = ({ children }) => {
  const [baseDirectory, setBaseDirectory] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("google_token");
    if (token) {
      try {
        const decodedToken = jwtDecode<DecodedToken>(token);
        const email = decodedToken.email;

        // Replace "@" and "." in the email and prepend with "ext_"
        const formattedEmail = `ext_${email.replace(/[@.]/g, "_")}`;
        const rootDirectory = "C:\\Users\\uclam\\Downloads\\"; // Define your root directory here

        // Set the full directory path
        setBaseDirectory(`${rootDirectory}\\${formattedEmail}`);
      } catch (error) {
        console.error("Error decoding token:", error);
        setBaseDirectory(null);
      }
    }
  }, []);

  return (
    <BaseDirectoryContext.Provider value={{ baseDirectory, setBaseDirectory }}>
      {children}
    </BaseDirectoryContext.Provider>
  );
};
