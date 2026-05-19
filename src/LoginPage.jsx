import { useState } from "react";
import { supabase } from "./supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      setError("Email o contraseña incorrectos.");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 36px", width: "100%",
        maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏗️</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#1e3a5f", letterSpacing: 1 }}>stockIA</div>
          <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2, marginTop: 4 }}>GESTIÓN DE OBRAS</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              style={{
                width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0",
                borderRadius: 10, fontSize: 15, color: "#1e293b", outline: "none",
                boxSizing: "border-box", background: "#f8fafc",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0",
                borderRadius: 10, fontSize: 15, color: "#1e293b", outline: "none",
                boxSizing: "border-box", background: "#f8fafc",
              }}
            />
          </div>

          {error && (
            <div style={{ background: "#ffe4e6", border: "1.5px solid #fecdd3", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#be123c", fontSize: 14, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", background: loading ? "#94a3b8" : "#1e3a5f",
              color: "#fff", border: "none", borderRadius: 10, padding: "13px",
              cursor: loading ? "not-allowed" : "pointer", fontWeight: 800,
              fontSize: 15, transition: "background .2s",
            }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#94a3b8" }}>
          ¿No tenés acceso? Contactá al administrador.
        </div>
      </div>
    </div>
  );
}