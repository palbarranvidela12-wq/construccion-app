import { useContext, createContext } from "react";

// Separa exports para que react-refresh/only-export-components no marque error en AuthContext.jsx.
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

