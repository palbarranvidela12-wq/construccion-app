import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";

// ── currency helpers ──────────────────────────────────────────────────────────
const fmtARS = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n ?? 0);

// ARS <-> USD conversion
const toARS = (monto, moneda, tc) => (moneda === "USD" ? monto * (parseFloat(tc) || 1) : monto);
const toUSD = (monto, moneda, tc) => (moneda === "ARS" ? monto / (parseFloat(tc) || 1) : monto);

const avgTC = (list) => (list.length ? list.reduce((s, x) => s + (parseFloat(x.tc) || 1), 0) / list.length : 1);


// ── misc helpers ──────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split("T")[0];

// ── map snake_case DB rows → camelCase app objects ────────────────────────────
const mapProyecto = (r) => ({
  id: r.id,
  nombre: r.nombre,
  cliente: r.cliente,
  direccion: r.direccion,
  inicio: r.inicio,
  fin_estimado: r.fin_estimado,
  estado: r.estado,
  presupuesto: r.presupuesto,
  monedaPresupuesto: r.moneda_presupuesto,
  tc: r.tc,
  notas: r.notas,
});
const mapMaterial = (r) => ({
  id: r.id,
  proyectoId: r.proyecto_id,
  fecha: r.fecha,
  nombre: r.nombre,
  categoria: r.categoria,
  cantidad: r.cantidad,
  unidad: r.unidad,
  precioUnitario: r.precio_unitario,
  moneda: r.moneda,
  tc: r.tc,
  proveedor: r.proveedor,
});
const mapContratista = (r) => ({
  id: r.id,
  proyectoId: r.proyecto_id,
  nombre: r.nombre,
  especialidad: r.especialidad,
  fecha: r.fecha,
  importe: r.importe,
  moneda: r.moneda,
  tc: r.tc,
  estado: r.estado,
  notas: r.notas,
});

// ── icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);
const IcHome = () => <Icon path="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />;
const IcBox = () => <Icon path="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />;
const IcUser = () => <Icon path="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z" />;
const IcChart = () => <Icon path="M18 20V10 M12 20V4 M6 20v-6" />;
const IcPlus = () => <Icon path="M12 5v14 M5 12h14" size={16} />;
const IcTrash = () => <Icon path="M3 6h18 M19 6l-1 14H6L5 6 M9 6V4h6v2" size={16} />;
const IcEdit = () => <Icon path="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" size={16} />;
const IcX = () => <Icon path="M18 6L6 18 M6 6l12 12" size={18} />;
const IcRefresh = () => <Icon path="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" size={16} />;

// ── status badge ──────────────────────────────────────────────────────────────
const estadoConfig = {
  en_curso: { label: "En curso", bg: "#e0f2fe", color: "#0369a1" },
  completado: { label: "Completado", bg: "#dcfce7", color: "#15803d" },
  pausado: { label: "Pausado", bg: "#fef9c3", color: "#a16207" },
  planificacion: { label: "Planificación", bg: "#f3e8ff", color: "#7e22ce" },
};
const Badge = ({ estado }) => {
  const cfg = estadoConfig[estado] ?? { label: estado, bg: "#f1f5f9", color: "#475569" };
  return <span style={{ background: cfg.bg, color: cfg.color, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{cfg.label}</span>;
};
const MonedaBadge = ({ moneda }) => (
  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: moneda === "USD" ? "#fef9c3" : "#dbeafe", color: moneda === "USD" ? "#a16207" : "#1e40af" }}>
    {moneda}
  </span>
);

// ── modal ─────────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.22)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e293b" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex" }}>
          <IcX />
        </button>
      </div>
      <div style={{ padding: "20px 24px 24px" }}>{children}</div>
    </div>
  </div>
);

// ── form helpers ──────────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
    {children}
  </div>
);
const iS = { width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, color: "#1e293b", outline: "none", boxSizing: "border-box", background: "#f8fafc" };
const sS = { ...iS, cursor: "pointer" };

// ── TC live preview ───────────────────────────────────────────────────────────
const TCPreview = ({ monto, moneda, tc }) => {
  const m = parseFloat(monto) || 0;
  const t = parseFloat(tc) || 0;
  if (!m || !t) return null;
  return (
    <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 8, padding: "10px 16px", marginBottom: 14, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>En ARS</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1d6fa4" }}>{fmtARS(toARS(m, moneda, t))}</div>
      </div>
      <div style={{ color: "#cbd5e1", fontSize: 20 }}>⇄</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>En USD</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#a16207" }}>{fmtUSD(toUSD(m, moneda, t))}</div>
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>T.C. aplicado</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#475569" }}>1 USD = {fmtARS(t)}</div>
      </div>
    </div>
  );
};

// ── shared currency block ─────────────────────────────────────────────────────
const CurrencyBlock = ({ form, f, montoLabel = "Monto" }) => (
  <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
      💱 {montoLabel} y Tipo de Cambio
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      <Field label={montoLabel}>
        <input type="number" style={iS} value={form._monto || ""} onChange={f("_monto")} placeholder="0" />
      </Field>
      <Field label="Moneda">
        <select style={sS} value={form.moneda || "ARS"} onChange={f("moneda")}>
          <option value="ARS">🇦🇷 ARS $</option>
          <option value="USD">🇺🇸 USD $</option>
        </select>
      </Field>
      <Field label="T.C. (1 USD = ? ARS)">
        <input type="number" style={iS} value={form.tc || ""} onChange={f("tc")} placeholder="Ej: 1200" />
      </Field>
    </div>
    <TCPreview monto={form._monto} moneda={form.moneda || "ARS"} tc={form.tc} />
  </div>
);

// ── loading spinner ───────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
    <div style={{ width: 36, height: 36, border: "4px solid #e2e8f0", borderTopColor: "#1e3a5f", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── error banner ──────────────────────────────────────────────────────────────
const ErrorBanner = ({ msg, onRetry }) => (
  <div style={{ background: "#ffe4e6", border: "1.5px solid #fecdd3", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span style={{ color: "#be123c", fontWeight: 600, fontSize: 14 }}>⚠️ {msg}</span>
    {onRetry && (
      <button onClick={onRetry} style={{ display: "flex", alignItems: "center", gap: 6, background: "#be123c", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
        <IcRefresh /> Reintentar
      </button>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const { session, loading: authLoading } = useAuth();

  // Hooks SIEMPRE al inicio (evita "Rules of Hooks")
  const [tab, setTab] = useState("dashboard");
  const [proyectos, setProyectos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [contratistas, setContratistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [proyectoActivo, setProyectoActivo] = useState(null);
  const [form, setForm] = useState({});

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: pData, error: pErr }, { data: mData, error: mErr }, { data: cData, error: cErr }] = await Promise.all([
        supabase.from("proyectos").select("*").order("created_at", { ascending: false }),
        supabase.from("materiales").select("*").order("created_at", { ascending: false }),
        supabase.from("contratistas").select("*").order("created_at", { ascending: false }),
      ]);

      if (pErr) throw pErr;
      if (mErr) throw mErr;
      if (cErr) throw cErr;

      setProyectos(pData.map(mapProyecto));
      setMateriales(mData.map(mapMaterial));
      setContratistas(cData.map(mapContratista));
    } catch (err) {
      console.error("Supabase fetchAll error:", err);
      setError(`No se pudo conectar con la base de datos. ${err?.message ? "(" + err.message + ")" : ""}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await fetchAll();
    };
    run();
  }, [fetchAll]);


  const stats = useMemo(() => {
    const mARS = (m) => toARS(m.cantidad * m.precioUnitario, m.moneda, m.tc);
    const cARS = (c) => toARS(c.importe, c.moneda, c.tc);

    const totalMatARS = materiales.reduce((s, m) => s + mARS(m), 0);
    const totalConARS = contratistas.reduce((s, c) => s + cARS(c), 0);

    const porProyecto = proyectos.map((p) => {
      const gastoMatARS = materiales
        .filter((m) => m.proyectoId === p.id)
        .reduce((s, m) => s + mARS(m), 0);
      const gastoConARS = contratistas
        .filter((c) => c.proyectoId === p.id)
        .reduce((s, c) => s + cARS(c), 0);

      const gastoTotalARS = gastoMatARS + gastoConARS;
      const presupuestoARS = toARS(p.presupuesto, p.monedaPresupuesto, p.tc);

      return { ...p, gastoMatARS, gastoConARS, gastoTotalARS, presupuestoARS, margenARS: presupuestoARS - gastoTotalARS };
    });

    return { totalMatARS, totalConARS, totalGastoARS: totalMatARS + totalConARS, porProyecto };
  }, [proyectos, materiales, contratistas]);

  const openModal = (tipo, datos = {}) => {
    setForm(datos);
    setModal(tipo);
  };
  const closeModal = () => {
    setModal(null);
    setForm({});
  };

  const guardarProyecto = async () => {
    if (!form.nombre) return;
    setSaving(true);

    const row = {
      id: form.id || uid(),
      nombre: form.nombre,
      cliente: form.cliente || null,
      direccion: form.direccion || null,
      inicio: form.inicio || null,
      fin_estimado: form.fin_estimado || null,
      estado: form.estado || "planificacion",
      presupuesto: parseFloat(form.presupuesto) || 0,
      moneda_presupuesto: form.monedaPresupuesto || "ARS",
      tc: parseFloat(form.tc) || 1,
      notas: form.notas || null,
    };

    const { error: e } = await supabase.from("proyectos").upsert(row);
    setSaving(false);
    if (e) {
      setError("Error al guardar el proyecto: " + e.message);
      return;
    }

    closeModal();
    fetchAll();
  };

  const eliminarProyecto = async (id) => {
    if (!window.confirm("¿Eliminar este proyecto y todos sus datos?")) return;
    const { error: e } = await supabase.from("proyectos").delete().eq("id", id);
    if (e) {
      setError("Error al eliminar: " + e.message);
      return;
    }
    if (proyectoActivo === id) setProyectoActivo(null);
    fetchAll();
  };

  const guardarMaterial = async () => {
    if (!form.nombre || !form.proyectoId) return;
    setSaving(true);

    const row = {
      id: form.id || uid(),
      proyecto_id: form.proyectoId,
      fecha: form.fecha || null,
      nombre: form.nombre,
      categoria: form.categoria || "Otro",
      cantidad: parseFloat(form.cantidad) || 0,
      unidad: form.unidad || null,
      precio_unitario: parseFloat(form._monto) || parseFloat(form.precioUnitario) || 0,
      moneda: form.moneda || "ARS",
      tc: parseFloat(form.tc) || 1,
      proveedor: form.proveedor || null,
    };

    const { error: e } = await supabase.from("materiales").upsert(row);
    setSaving(false);
    if (e) {
      setError("Error al guardar material: " + e.message);
      return;
    }

    closeModal();
    fetchAll();
  };

  const eliminarMaterial = async (id) => {
    const { error: e } = await supabase.from("materiales").delete().eq("id", id);
    if (e) {
      setError("Error al eliminar: " + e.message);
      return;
    }
    fetchAll();
  };

  const guardarContratista = async () => {
    if (!form.nombre || !form.proyectoId) return;
    setSaving(true);

    const row = {
      id: form.id || uid(),
      proyecto_id: form.proyectoId,
      nombre: form.nombre,
      especialidad: form.especialidad || null,
      fecha: form.fecha || null,
      importe: parseFloat(form._monto) || parseFloat(form.importe) || 0,
      moneda: form.moneda || "ARS",
      tc: parseFloat(form.tc) || 1,
      estado: form.estado || "pendiente",
      notas: form.notas || null,
    };

    const { error: e } = await supabase.from("contratistas").upsert(row);
    setSaving(false);
    if (e) {
      setError("Error al guardar contratista: " + e.message);
      return;
    }

    closeModal();
    fetchAll();
  };

  const eliminarContratista = async (id) => {
    const { error: e } = await supabase.from("contratistas").delete().eq("id", id);
    if (e) {
      setError("Error al eliminar: " + e.message);
      return;
    }
    fetchAll();
  };

  const navItems = [
    { id: "dashboard", label: "Resumen", icon: <IcChart /> },
    { id: "proyectos", label: "Proyectos", icon: <IcHome /> },
    { id: "materiales", label: "Materiales", icon: <IcBox /> },
    { id: "contratistas", label: "Contratistas", icon: <IcUser /> },
  ];

  const matFiltrados = proyectoActivo ? materiales.filter((m) => m.proyectoId === proyectoActivo) : materiales;
  const conFiltrados = proyectoActivo ? contratistas.filter((c) => c.proyectoId === proyectoActivo) : contratistas;
  const [contratistaFiltroEspecialidad, setContratistaFiltroEspecialidad] = useState("Todas");

  const especialidadesConFiltradoProyecto = useMemo(() => {
    const set = new Set(conFiltrados.map((c) => (c.especialidad || "Sin especialidad").trim()));
    return ["Todas", ...Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, "es"))];
  }, [conFiltrados]);

  const conFiltrados2 = contratistaFiltroEspecialidad === "Todas" ? conFiltrados : conFiltrados.filter((c) => (c.especialidad || "Sin especialidad").trim() === contratistaFiltroEspecialidad);

  const btn = (bg, color = "#fff") => ({ background: bg, color, border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 4 });

  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando...</div>;
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", background: "#f1f5f9", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%)", color: "#FF791A", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <div style={{ background: "rgba(255, 255, 255, 0)", borderRadius: 10, padding: "8px 10px", fontSize: 22 }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>stockIA</div>
          <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 1 }}>GESTIÓN DE OBRAS · ARS / USD</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {proyectoActivo && (
            <>
              <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 600 }}>📁 {proyectos.find((p) => p.id === proyectoActivo)?.nombre}</div>
              <button onClick={() => setProyectoActivo(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>Todos</button>
            </>
          )}
          <button onClick={fetchAll} title="Actualizar datos" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex" }}>
            <IcRefresh />
          </button>
        </div>
      </header>

      <nav style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", display: "flex", padding: "0 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflowX: "auto" }}>
        {navItems.map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 18px",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: tab === n.id ? "#1e3a5f" : "#64748b",
              borderBottom: tab === n.id ? "3px solid #1e3a5f" : "3px solid transparent",
              fontWeight: tab === n.id ? 800 : 500,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>

      <main style={{ flex: 1, padding: 24, maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {error && <ErrorBanner msg={error} onRetry={() => { setError(null); fetchAll(); }} />}
        {loading && <Spinner />}

        {!loading && (
          <>

            {tab === "dashboard" && (
              <div>
                <h2 style={{ margin: "0 0 20px", fontSize: 22, color: "#1e293b" }}>Resumen General</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                  {[
                    { label: "Proyectos activos", ars: proyectos.filter((p) => p.estado === "en_curso").length, isCount: true, color: "#2d6a9f", bg: "#dbeafe" },
                    { label: "Total materiales", ars: stats.totalMatARS, usd: stats.totalMatARS / avgTC(materiales), color: "#15803d", bg: "#dcfce7" },
                    { label: "Total contratistas", ars: stats.totalConARS, usd: stats.totalConARS / avgTC(contratistas), color: "#7e22ce", bg: "#f3e8ff" },
                    { label: "Gasto total", ars: stats.totalGastoARS, usd: stats.totalGastoARS / avgTC([...materiales, ...contratistas]), color: "#be123c", bg: "#ffe4e6" },
                  ].map((k) => (
                    <div key={k.label} style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", borderLeft: `5px solid ${k.color}` }}>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
                      {k.isCount ? (
                        <div style={{ fontSize: 36, fontWeight: 900, color: k.color }}>{k.ars}</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 20, fontWeight: 900, color: k.color }}>{fmtARS(k.ars)}</div>
                          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>≈ {fmtUSD(k.usd)}</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <h3 style={{ margin: "0 0 14px", color: "#1e293b", fontSize: 16 }}>Desglose por proyecto</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {stats.porProyecto.map((p) => (
                    <div key={p.id} style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: "#1e293b", fontSize: 15 }}>{p.nombre}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{p.cliente} · {p.direccion}</div>
                        </div>
                        <Badge estado={p.estado} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                        {[
                          { l: "Presupuesto", arsV: p.presupuestoARS, usdV: toUSD(p.presupuestoARS, p.monedaPresupuesto, p.tc), c: "#1e3a5f" },
                          { l: "Materiales", arsV: p.gastoMatARS, usdV: p.gastoMatARS / (parseFloat(p.tc) || 1), c: "#15803d" },
                          { l: "Contratistas", arsV: p.gastoConARS, usdV: p.gastoConARS / (parseFloat(p.tc) || 1), c: "#7e22ce" },
                          { l: "Margen est.", arsV: p.margenARS, usdV: p.margenARS / (parseFloat(p.tc) || 1), c: p.margenARS >= 0 ? "#15803d" : "#be123c" },
                        ].map((x) => (
                          <div key={x.l} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>{x.l}</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: x.c }}>{fmtARS(x.arsV)}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{fmtUSD(x.usdV)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {proyectos.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Todavía no hay proyectos cargados.</div>}
                </div>
              </div>
            )}

            {tab === "proyectos" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>Proyectos</h2>
                  <button onClick={() => openModal("proyecto", { monedaPresupuesto: "ARS", estado: "planificacion" })} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                    <IcPlus /> Nuevo proyecto
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {proyectos.map((p) => {
                    const sp = stats.porProyecto.find((x) => x.id === p.id);
                    return (
                      <div key={p.id} style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", marginBottom: 3 }}>{p.nombre}</div>
                            <div style={{ fontSize: 13, color: "#64748b" }}>👤 {p.cliente} · 📍 {p.direccion}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>🗓 {p.inicio} → {p.fin_estimado}</div>
                            {p.notas && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>{p.notas}</div>}
                          </div>
                          <Badge estado={p.estado} />
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                          <div style={{ background: "#f1f5f9", padding: "6px 14px", borderRadius: 8 }}>
                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Presupuesto</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#1e3a5f" }}>{fmtARS(toARS(p.presupuesto, p.monedaPresupuesto, p.tc))}</div>
                          </div>
                          {sp && (
                            <div style={{ background: "#f0fdf4", padding: "6px 14px", borderRadius: 8 }}>
                              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Gastado</div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: "#15803d" }}>{fmtARS(sp.gastoTotalARS)}</div>
                            </div>
                          )}
                          <div style={{ background: "#f8fafc", padding: "6px 14px", borderRadius: 8 }}>
                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>T.C. referencia</div>
                            1 USD = {fmtARS(p.tc)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                          <button onClick={() => { setProyectoActivo(p.id); setTab("materiales"); }} style={btn("#dbeafe", "#1e40af")}>Materiales</button>
                          <button onClick={() => { setProyectoActivo(p.id); setTab("contratistas"); }} style={btn("#f3e8ff", "#7e22ce")}>Contratistas</button>
                          <button onClick={() => openModal("proyecto", { ...p })} style={btn("#f1f5f9", "#475569")}> <IcEdit /> Editar</button>
                          <button onClick={() => eliminarProyecto(p.id)} style={btn("#ffe4e6", "#be123c")}> <IcTrash /> Eliminar</button>
                        </div>
                      </div>
                    );
                  })}
                  {proyectos.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>No hay proyectos. ¡Crea el primero!</div>}
                </div>
              </div>
            )}

            {tab === "materiales" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>Materiales</h2>
                    {proyectoActivo && <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Filtrando: {proyectos.find((p) => p.id === proyectoActivo)?.nombre}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {proyectoActivo && <button onClick={() => setProyectoActivo(null)} style={{ fontSize: 13, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Ver todos</button>}
                    <button onClick={() => openModal("material", { fecha: today(), proyectoId: proyectoActivo || "", moneda: "ARS" })} style={{ display: "flex", alignItems: "center", gap: 6, background: "#15803d", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                      <IcPlus /> Añadir material
                    </button>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 12, padding: "12px 20px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
                  <div><span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total ARS</span> <span style={{ fontSize: 16, fontWeight: 900, color: "#1d6fa4" }}>{fmtARS(matFiltrados.reduce((s, m) => s + toARS(m.cantidad * m.precioUnitario, m.moneda, m.tc), 0))}</span></div>
                  <div><span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total USD</span> <span style={{ fontSize: 16, fontWeight: 900, color: "#a16207" }}>{fmtUSD(matFiltrados.reduce((s, m) => s + toUSD(m.cantidad * m.precioUnitario, m.moneda, m.tc), 0))}</span></div>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>· {matFiltrados.length} registros</span>
                </div>

                <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["Proyecto", "Fecha", "Material", "Categ.", "Cant.", "U.", "Mon.", "P. Unit.", "T.C.", "Total ARS", "Total USD", ""].map((h) => (
                            <th key={h} style={{ padding: "11px 12px", textAlign: "left", fontWeight: 800, color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matFiltrados.map((m) => {
                          const sub = m.cantidad * m.precioUnitario;
                          return (
                            <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "10px 12px", color: "#1e3a5f", fontWeight: 600, whiteSpace: "nowrap" }}>{proyectos.find((p) => p.id === m.proyectoId)?.nombre?.split(" ").slice(0, 2).join(" ") ?? "—"}</td>
                              <td style={{ padding: "10px 12px", color: "#64748b", whiteSpace: "nowrap" }}>{m.fecha}</td>
                              <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1e293b" }}>{m.nombre}</td>
                              <td style={{ padding: "10px 12px" }}><span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{m.categoria}</span></td>
                              <td style={{ padding: "10px 12px", textAlign: "right" }}>{m.cantidad.toLocaleString("es-AR")}</td>
                              <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{m.unidad}</td>
                              <td style={{ padding: "10px 12px" }}><MonedaBadge moneda={m.moneda} /></td>
                              <td style={{ padding: "10px 12px", textAlign: "right" }}>{m.moneda === "ARS" ? fmtARS(m.precioUnitario) : fmtUSD(m.precioUnitario)}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: "#475569", whiteSpace: "nowrap" }}>${parseFloat(m.tc)?.toLocaleString("es-AR")}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#1d6fa4", whiteSpace: "nowrap" }}>{fmtARS(toARS(sub, m.moneda, m.tc))}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#a16207", whiteSpace: "nowrap" }}>{fmtUSD(toUSD(sub, m.moneda, m.tc))}</td>
                              <td style={{ padding: "10px 12px" }}>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => openModal("material", { ...m, _monto: m.precioUnitario })} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                                    <IcEdit />
                                  </button>
                                  <button onClick={() => eliminarMaterial(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#be123c" }}>
                                    <IcTrash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {matFiltrados.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Sin materiales registrados.</div>}
                  </div>
                </div>
              </div>
            )}

            {tab === "contratistas" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>Contratistas</h2>
                    {proyectoActivo && <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Filtrando: {proyectos.find((p) => p.id === proyectoActivo)?.nombre}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {proyectoActivo && <button onClick={() => setProyectoActivo(null)} style={{ fontSize: 13, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Ver todos</button>}
                    <button onClick={() => openModal("contratista", { fecha: today(), proyectoId: proyectoActivo || "", estado: "pendiente", moneda: "ARS" })} style={{ display: "flex", alignItems: "center", gap: 6, background: "#7e22ce", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                      <IcPlus /> Añadir contratista
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Categoría (Especialidad)</div>
                    <select
                      style={{ width: 260, padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, background: "#f8fafc", cursor: "pointer" }}
                      value={contratistaFiltroEspecialidad}
                      onChange={(e) => setContratistaFiltroEspecialidad(e.target.value)}
                    >
                      {especialidadesConFiltradoProyecto.map((esp) => (
                        <option key={esp} value={esp}>{esp}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>· {conFiltrados2.length} registros</div>
                    <button
                      onClick={() => setContratistaFiltroEspecialidad("Todas")}
                      style={{ fontSize: 13, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}
                    >
                      Limpiar filtro
                    </button>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 12, padding: "12px 20px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
                  <div><span style={{ fontSize: 11, fontWeight: 700, color: "#1d6fa4", textTransform: "uppercase" }}>Total ARS</span> <span style={{ fontSize: 16, fontWeight: 900, color: "#1d6fa4" }}>{fmtARS(conFiltrados2.reduce((s, c) => s + toARS(c.importe, c.moneda, c.tc), 0))}</span></div>
                  <div><span style={{ fontSize: 11, fontWeight: 700, color: "#a16207", textTransform: "uppercase" }}>Total USD</span> <span style={{ fontSize: 16, fontWeight: 900, color: "#a16207" }}>{fmtUSD(conFiltrados2.reduce((s, c) => s + toUSD(c.importe, c.moneda, c.tc), 0))}</span></div>
                  <div><span style={{ fontSize: 11, fontWeight: 700, color: "#7e22ce", textTransform: "uppercase" }}>Pagado ARS</span> <span style={{ fontSize: 16, fontWeight: 900, color: "#7e22ce" }}>{fmtARS(conFiltrados2.filter((c) => c.estado === "pagado").reduce((s, c) => s + toARS(c.importe, c.moneda, c.tc), 0))}</span></div>
                  <div><span style={{ fontSize: 11, fontWeight: 700, color: "#be123c", textTransform: "uppercase" }}>Pendiente ARS</span> <span style={{ fontSize: 16, fontWeight: 900, color: "#be123c" }}>{fmtARS(conFiltrados2.filter((c) => c.estado === "pendiente").reduce((s, c) => s + toARS(c.importe, c.moneda, c.tc), 0))}</span></div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {conFiltrados2.map((c) => (
                    <div key={c.id} style={{ background: "#fff", borderRadius: 12, padding: "18px 22px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>{c.nombre}</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{c.especialidad} · 📅 {c.fecha}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>📁 {proyectos.find((p) => p.id === c.proyectoId)?.nombre ?? "—"}</div>
                        {c.notas && <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", marginTop: 2 }}>{c.notas}</div>}
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                          <MonedaBadge moneda={c.moneda} />
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>T.C. $1 USD = {fmtARS(c.tc)}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 19, fontWeight: 900, color: "#1d6fa4" }}>{fmtARS(toARS(c.importe, c.moneda, c.tc))}</div>
                          <div style={{ fontSize: 13, color: "#a16207", fontWeight: 700 }}>{fmtUSD(toUSD(c.importe, c.moneda, c.tc))}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, display: "inline-block", marginTop: 4, background: c.estado === "pagado" ? "#dcfce7" : "#fef9c3", color: c.estado === "pagado" ? "#15803d" : "#a16207" }}>
                            {c.estado === "pagado" ? "✅ Pagado" : "⏳ Pendiente"}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openModal("contratista", { ...c, _monto: c.importe })} style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#64748b", borderRadius: 7, padding: "6px 8px", display: "flex" }}>
                            <IcEdit />
                          </button>
                          <button onClick={() => eliminarContratista(c.id)} style={{ background: "#ffe4e6", border: "none", cursor: "pointer", color: "#be123c", borderRadius: 7, padding: "6px 8px", display: "flex" }}>
                            <IcTrash />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {conFiltrados2.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Sin contratistas registrados.</div>}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {saving && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#1e3a5f", color: "#fff", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Guardando...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {modal === "proyecto" && (
        <Modal title={form.id ? "Editar proyecto" : "Nuevo proyecto"} onClose={closeModal}>
          <Field label="Nombre del proyecto"><input style={iS} value={form.nombre || ""} onChange={f("nombre")} placeholder="Ej: Vivienda Unifamiliar Los Pinos" /></Field>
          <Field label="Cliente"><input style={iS} value={form.cliente || ""} onChange={f("cliente")} placeholder="Nombre del cliente" /></Field>
          <Field label="Dirección"><input style={iS} value={form.direccion || ""} onChange={f("direccion")} placeholder="Calle, número, localidad" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Fecha de inicio"><input type="date" style={iS} value={form.inicio || ""} onChange={f("inicio")} /></Field>
            <Field label="Fin estimado"><input type="date" style={iS} value={form.fin_estimado || ""} onChange={f("fin_estimado")} /></Field>
          </div>
          <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>💱 Presupuesto y Tipo de Cambio</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="Presupuesto"><input type="number" style={iS} value={form.presupuesto || ""} onChange={f("presupuesto")} placeholder="0" /></Field>
              <Field label="Moneda">
                <select style={sS} value={form.monedaPresupuesto || "ARS"} onChange={f("monedaPresupuesto")}>
                  <option value="ARS">🇦🇷 ARS $</option>
                  <option value="USD">🇺🇸 USD $</option>
                </select>
              </Field>
              <Field label="T.C. (1 USD = ? ARS)"><input type="number" style={iS} value={form.tc || ""} onChange={f("tc")} placeholder="Ej: 1200" /></Field>
            </div>
            <TCPreview monto={form.presupuesto} moneda={form.monedaPresupuesto || "ARS"} tc={form.tc} />
          </div>
          <Field label="Estado">
            <select style={sS} value={form.estado || "planificacion"} onChange={f("estado")}>
              <option value="planificacion">Planificación</option>
              <option value="en_curso">En curso</option>
              <option value="pausado">Pausado</option>
              <option value="completado">Completado</option>
            </select>
          </Field>
          <Field label="Notas"><textarea style={{ ...iS, minHeight: 64, resize: "vertical" }} value={form.notas || ""} onChange={f("notas")} /></Field>
          <button onClick={guardarProyecto} disabled={saving} style={{ width: "100%", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, padding: "12px", cursor: "pointer", fontWeight: 800, fontSize: 15, marginTop: 6, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear proyecto"}
          </button>
        </Modal>
      )}

      {modal === "material" && (
        <Modal title={form.id ? "Editar material" : "Añadir material"} onClose={closeModal}>
          <Field label="Proyecto">
            <select style={sS} value={form.proyectoId || ""} onChange={f("proyectoId")}>
              <option value="">— Selecciona proyecto —</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Field>
          <Field label="Nombre del material"><input style={iS} value={form.nombre || ""} onChange={f("nombre")} placeholder="Ej: Cemento Portland" /></Field>
          <Field label="Categoría">
            <select style={sS} value={form.categoria || "Estructura"} onChange={f("categoria")}>
              {["Áridos","Cemento/Yeso","Hierros","Ladrillos","Mat. Albañilería","Mat. Plomeria/Gas","Mat. Iluminación","Consumibles","Otro"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Cantidad"><input type="number" style={iS} value={form.cantidad || ""} onChange={f("cantidad")} /></Field>
            <Field label="Unidad"><input style={iS} value={form.unidad || ""} onChange={f("unidad")} placeholder="m², sacos, ud…" /></Field>
          </div>
          <CurrencyBlock form={form} f={f} montoLabel="Precio unitario" />
          <Field label="Proveedor"><input style={iS} value={form.proveedor || ""} onChange={f("proveedor")} /></Field>
          <Field label="Fecha"><input type="date" style={iS} value={form.fecha || ""} onChange={f("fecha")} /></Field>
          <button onClick={guardarMaterial} disabled={saving} style={{ width: "100%", background: "#15803d", color: "#fff", border: "none", borderRadius: 9, padding: "12px", cursor: "pointer", fontWeight: 800, fontSize: 15, marginTop: 6, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Añadir material"}
          </button>
        </Modal>
      )}

      {modal === "contratista" && (
        <Modal title={form.id ? "Editar contratista" : "Añadir contratista"} onClose={closeModal}>
          <Field label="Proyecto">
            <select style={sS} value={form.proyectoId || ""} onChange={f("proyectoId")}>
              <option value="">— Selecciona proyecto —</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Field>
          <Field label="Empresa / Contratista"><input style={iS} value={form.nombre || ""} onChange={f("nombre")} placeholder="Nombre empresa o autónomo" /></Field>
          <Field label="Especialidad"><input style={iS} value={form.especialidad || ""} onChange={f("especialidad")} placeholder="Fontanería, electricidad, albañilería…" /></Field>
          <CurrencyBlock form={form} f={f} montoLabel="Importe" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Fecha"><input type="date" style={iS} value={form.fecha || ""} onChange={f("fecha")} /></Field>
            <Field label="Estado">
              <select style={sS} value={form.estado || "pendiente"} onChange={f("estado")}>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </Field>
          </div>
          <Field label="Notas"><textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={form.notas || ""} onChange={f("notas")} /></Field>
          <button onClick={guardarContratista} disabled={saving} style={{ width: "100%", background: "#7e22ce", color: "#fff", border: "none", borderRadius: 9, padding: "12px", cursor: "pointer", fontWeight: 800, fontSize: 15, marginTop: 6, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Añadir contratista"}
          </button>
        </Modal>
      )}

    </div>
  );
}

