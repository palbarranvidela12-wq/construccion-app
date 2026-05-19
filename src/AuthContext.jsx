import { useAuth as baseUseAuth, AuthContext as baseAuthContext } from "./authContext.js";

// Re-export para mantener compatibilidad con App.jsx
export const useAuth = baseUseAuth;

// Si en algún lado importan AuthContext desde aquí, lo dejamos disponible también
export const AuthContext = baseAuthContext;



