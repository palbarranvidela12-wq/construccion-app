import { useState, useEffect } from "react";
import { supabase } from "./supabase";

import { AuthContext } from "./authContext.js";

export default function AuthProvider({ children }) {

  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (userId) => {
    if (!userId) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("usuarios_app")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      setPerfil(data ?? null);
    } catch (err) {
      console.error("Error cargando perfil:", err?.message || err);
      setPerfil(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      cargarPerfil(session?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(true);
      cargarPerfil(nextSession?.user?.id);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = () => supabase.auth.signOut();

  const esSuperadmin = perfil?.rol === "superadmin";
  const esAdmin = perfil?.rol === "admin" || esSuperadmin;
  const esLector = perfil?.rol === "lector";

  return (
    <AuthContext.Provider value={{ session, perfil, loading, logout, esSuperadmin, esAdmin, esLector }}>
      {children}
    </AuthContext.Provider>
  );
}

