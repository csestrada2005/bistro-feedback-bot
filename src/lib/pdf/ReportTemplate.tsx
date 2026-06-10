import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Image,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import logoAsset from "@/assets/main-catering-logo.jpg.asset.json";

const LOGO_URL =
  typeof window !== "undefined" ? `${window.location.origin}${logoAsset.url}` : logoAsset.url;

export type AnalisisIA = {
  resumenEjecutivo: string;
  fortalezas: { titulo: string; evidencia: string }[];
  areasOportunidad: { titulo: string; evidencia: string; severidad: "alta" | "media" | "baja" }[];
  recomendaciones: { accion: string; impactoEsperado: string; prioridad: "alta" | "media" | "baja" }[];
  sentimientoComentarios: "positivo" | "neutro" | "negativo" | "mixto";
  citasDestacadas: string[];
};

export type ReportData = {
  comedorNombre: string;
  comedorEmpresa: string;
  fechaDesde: Date;
  fechaHasta: Date;
  stats: {
    total: number;
    promedio: number | null;
    pctIncidentes: number | null;
    totalPropuestas: number;
    porPregunta: { id: string; texto: string; promedio: number; n: number }[];
    propuestasMejora: { texto: string; fecha: string }[];
    propuestasMenu: { texto: string; fecha: string }[];
    incidentes: { texto: string; fecha: string }[];
  };
  analisis: AnalisisIA;
};

// ----- Colors -----
const C = {
  primary: "#0F172A",
  accent: "#D45A1A",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  bg: "#FFFFFF",
  soft: "#F8FAFC",
  green: "#15803D",
  greenBg: "#DCFCE7",
  yellow: "#A16207",
  yellowBg: "#FEF9C3",
  red: "#B91C1C",
  redBg: "#FEE2E2",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.text,
    backgroundColor: C.bg,
  },
  pageCover: {
    padding: 56,
    fontFamily: "Helvetica",
    color: C.text,
    backgroundColor: C.bg,
  },
  h1: { fontSize: 28, fontFamily: "Helvetica-Bold", color: C.primary },
  h2: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 12 },
  h3: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.primary },
  small: { fontSize: 9, color: C.muted },
  muted: { color: C.muted },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginVertical: 12 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: C.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 12,
    backgroundColor: C.soft,
  },
  kpiLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 4 },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  row: { flexDirection: "row" },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: C.muted,
    textTransform: "uppercase",
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: C.soft,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  td: {
    fontSize: 9,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    color: C.text,
  },
});

function severidadStyle(sev: "alta" | "media" | "baja") {
  if (sev === "alta") return { bg: C.redBg, fg: C.red };
  if (sev === "media") return { bg: C.yellowBg, fg: C.yellow };
  return { bg: C.soft, fg: C.muted };
}

function barFillColor(v: number) {
  if (v < 2.5) return C.red;
  if (v < 3.5) return C.yellow;
  return C.green;
}

function fmtDate(d: Date) {
  return format(d, "d 'de' MMMM yyyy", { locale: es });
}

function PageFooter({ pageNumber }: { pageNumber: number }) {
  return (
    <View style={s.footer} fixed>
      <Text>Main Catering · Reporte de satisfacción</Text>
      <Text>Página {pageNumber}</Text>
    </View>
  );
}

function LogoPlaceholder() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image src={LOGO_URL} style={{ width: 56, height: 56, objectFit: "contain" }} />
      <View>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: C.primary }}>
          Main Catering
        </Text>
        <Text style={{ fontSize: 8, color: C.muted }}>Servicios de alimentación corporativa</Text>
      </View>
    </View>
  );
}

function Badge({ text, sev }: { text: string; sev: "alta" | "media" | "baja" }) {
  const st = severidadStyle(sev);
  return (
    <Text style={[s.badge, { backgroundColor: st.bg, color: st.fg }]}>{text.toUpperCase()}</Text>
  );
}

function Bar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value / 5));
  const W = 120;
  return (
    <Svg width={W} height={10}>
      <Rect x={0} y={2} width={W} height={6} rx={3} fill={C.border} />
      <Rect x={0} y={2} width={W * pct} height={6} rx={3} fill={barFillColor(value)} />
    </Svg>
  );
}

// ============ PAGES ============

function CoverPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.pageCover}>
      <LogoPlaceholder />
      <View style={{ marginTop: 140 }}>
        <Text style={{ fontSize: 12, color: C.accent, fontFamily: "Helvetica-Bold", letterSpacing: 2 }}>
          REPORTE EJECUTIVO
        </Text>
        <Text style={{ fontSize: 40, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 8 }}>
          Reporte de
        </Text>
        <Text style={{ fontSize: 40, fontFamily: "Helvetica-Bold", color: C.primary }}>
          Satisfacción
        </Text>
        <View style={{ width: 80, height: 3, backgroundColor: C.accent, marginTop: 18, marginBottom: 24 }} />
        <Text style={{ fontSize: 16, color: C.text, fontFamily: "Helvetica-Bold" }}>
          {data.comedorNombre}
        </Text>
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{data.comedorEmpresa}</Text>
        <Text style={{ fontSize: 11, color: C.muted, marginTop: 24 }}>
          Período: del {fmtDate(data.fechaDesde)} al {fmtDate(data.fechaHasta)}
        </Text>
      </View>
      <View style={{ position: "absolute", bottom: 48, left: 56, right: 56 }}>
        <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
          <Text style={{ fontSize: 9, color: C.muted }}>
            Main Catering · Reporte ejecutivo de satisfacción
          </Text>
          <Text style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
            {format(new Date(), "dd/MM/yyyy HH:mm")}
          </Text>
        </View>
      </View>
    </Page>
  );
}

function SectionTitle({ children, pageNo }: { children: string; pageNo: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 9, color: C.accent, fontFamily: "Helvetica-Bold", letterSpacing: 1 }}>
        {pageNo}
      </Text>
      <Text style={s.h1}>{children}</Text>
      <View style={{ width: 40, height: 3, backgroundColor: C.accent, marginTop: 8 }} />
    </View>
  );
}

function ResumenPage({ data }: { data: ReportData }) {
  const { stats, analisis } = data;
  const sentColor =
    analisis.sentimientoComentarios === "positivo"
      ? { bg: C.greenBg, fg: C.green }
      : analisis.sentimientoComentarios === "negativo"
      ? { bg: C.redBg, fg: C.red }
      : { bg: C.yellowBg, fg: C.yellow };
  const bullets = analisis.resumenEjecutivo
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
  return (
    <Page size="A4" style={s.page}>
      <SectionTitle pageNo="01 · RESUMEN">Resumen ejecutivo</SectionTitle>
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Total respuestas</Text>
          <Text style={s.kpiValue}>{stats.total}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Promedio general</Text>
          <Text style={s.kpiValue}>
            {stats.promedio != null ? stats.promedio.toFixed(2) : "—"}
            <Text style={{ fontSize: 10, color: C.muted }}> / 5</Text>
          </Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>% incidentes</Text>
          <Text style={s.kpiValue}>
            {stats.pctIncidentes != null ? `${stats.pctIncidentes.toFixed(1)}%` : "—"}
          </Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Propuestas</Text>
          <Text style={s.kpiValue}>{stats.totalPropuestas}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Text style={s.muted}>Sentimiento general:</Text>
        <Text
          style={[
            s.badge,
            { backgroundColor: sentColor.bg, color: sentColor.fg, fontSize: 9 },
          ]}
        >
          {analisis.sentimientoComentarios.toUpperCase()}
        </Text>
      </View>

      <View style={{ borderLeftWidth: 3, borderLeftColor: C.accent, paddingLeft: 12, marginTop: 8 }}>
        <Text style={s.h3}>Conclusiones clave</Text>
        <View style={{ marginTop: 8 }}>
          {bullets.length === 0 ? (
            <Text style={s.muted}>Sin resumen disponible.</Text>
          ) : (
            bullets.map((b, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 6 }}>
                <Text style={{ color: C.accent, marginRight: 6 }}>•</Text>
                <Text style={{ flex: 1, lineHeight: 1.5 }}>{b}</Text>
              </View>
            ))
          )}
        </View>
      </View>
      <PageFooter pageNumber={2} />
    </Page>
  );
}

function PromediosPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionTitle pageNo="02 · DETALLE">Detalle por aspecto evaluado</SectionTitle>
      {data.stats.porPregunta.length === 0 ? (
        <Text style={s.muted}>Sin preguntas de escala con respuestas.</Text>
      ) : (
        <View>
          <View style={s.row}>
            <Text style={[s.th, { flex: 4 }]}>Pregunta</Text>
            <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Promedio</Text>
            <Text style={[s.th, { flex: 3 }]}>Visualización</Text>
            <Text style={[s.th, { flex: 1, textAlign: "right" }]}># Resp.</Text>
          </View>
          {data.stats.porPregunta.map((p) => (
            <View key={p.id} style={s.row}>
              <Text style={[s.td, { flex: 4 }]}>{p.texto}</Text>
              <Text style={[s.td, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                {p.promedio.toFixed(2)}
              </Text>
              <View style={[s.td, { flex: 3, justifyContent: "center" }]}>
                <Bar value={p.promedio} />
              </View>
              <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{p.n}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ marginTop: 18, padding: 10, backgroundColor: C.soft, borderRadius: 6 }}>
        <Text style={[s.small, { fontFamily: "Helvetica-Bold", marginBottom: 4 }]}>
          Leyenda de visualización
        </Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Svg width={10} height={10}>
              <Rect width={10} height={10} fill={C.red} rx={2} />
            </Svg>
            <Text style={s.small}>{`< 2.5  Crítico`}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Svg width={10} height={10}>
              <Rect width={10} height={10} fill={C.yellow} rx={2} />
            </Svg>
            <Text style={s.small}>{`2.5 – 3.5  Atención`}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Svg width={10} height={10}>
              <Rect width={10} height={10} fill={C.green} rx={2} />
            </Svg>
            <Text style={s.small}>{`>= 3.5  Bueno`}</Text>
          </View>
        </View>
      </View>
      <PageFooter pageNumber={3} />
    </Page>
  );
}

function FortalezasPage({ data }: { data: ReportData }) {
  const fortalezas = data.analisis.fortalezas.slice(0, 3);
  const areas = data.analisis.areasOportunidad.slice(0, 5);
  return (
    <Page size="A4" style={s.page}>
      <SectionTitle pageNo="03 · ANÁLISIS">Fortalezas y áreas de oportunidad</SectionTitle>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.h3, { color: C.green, marginBottom: 8 }]}>Fortalezas</Text>
          {fortalezas.length === 0 ? (
            <Text style={s.muted}>Sin fortalezas identificadas.</Text>
          ) : (
            fortalezas.map((f, i) => (
              <View
                key={i}
                style={[s.card, { backgroundColor: C.greenBg, borderColor: C.green }]}
              >
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, color: C.green }}>
                  {f.titulo}
                </Text>
                <Text style={{ fontSize: 9, color: C.text, marginTop: 4, lineHeight: 1.4 }}>
                  {f.evidencia}
                </Text>
              </View>
            ))
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.h3, { color: C.red, marginBottom: 8 }]}>Áreas de oportunidad</Text>
          {areas.length === 0 ? (
            <Text style={s.muted}>Sin áreas detectadas.</Text>
          ) : (
            areas.map((a, i) => {
              const st = severidadStyle(a.severidad);
              return (
                <View key={i} style={[s.card, { backgroundColor: st.bg, borderColor: st.fg }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, color: st.fg, flex: 1 }}>
                      {a.titulo}
                    </Text>
                    <Badge text={a.severidad} sev={a.severidad} />
                  </View>
                  <Text style={{ fontSize: 9, color: C.text, marginTop: 4, lineHeight: 1.4 }}>
                    {a.evidencia}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </View>
      <PageFooter pageNumber={4} />
    </Page>
  );
}

function RecomendacionesPage({ data }: { data: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionTitle pageNo="04 · ACCIONES">Recomendaciones</SectionTitle>
      {data.analisis.recomendaciones.length === 0 ? (
        <Text style={s.muted}>Sin recomendaciones generadas.</Text>
      ) : (
        data.analisis.recomendaciones.map((r, i) => (
          <View key={i} style={[s.card, { flexDirection: "row", gap: 10 }]} wrap={false}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: C.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 11 }}>
                {i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, color: C.primary, flex: 1 }}>
                  {r.accion}
                </Text>
                <Badge text={`prioridad ${r.prioridad}`} sev={r.prioridad} />
              </View>
              <Text style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>
                Impacto esperado:
              </Text>
              <Text style={{ fontSize: 9, color: C.text, marginTop: 2, lineHeight: 1.4 }}>
                {r.impactoEsperado}
              </Text>
            </View>
          </View>
        ))
      )}
      <PageFooter pageNumber={5} />
    </Page>
  );
}

function VocesPage({ data }: { data: ReportData }) {
  const { stats, analisis } = data;
  return (
    <Page size="A4" style={s.page}>
      <SectionTitle pageNo="05 · VOCES">Voces de los comensales</SectionTitle>

      <Text style={[s.h3, { marginBottom: 8 }]}>Comentarios destacados</Text>
      {analisis.citasDestacadas.length === 0 ? (
        <Text style={s.muted}>Sin citas destacadas.</Text>
      ) : (
        analisis.citasDestacadas.slice(0, 5).map((c, i) => (
          <View
            key={i}
            style={[
              s.card,
              { backgroundColor: C.soft, borderLeftWidth: 3, borderLeftColor: C.accent },
            ]}
          >
            <Text style={{ fontSize: 10, fontStyle: "italic", color: C.text, lineHeight: 1.5 }}>
              "{c}"
            </Text>
          </View>
        ))
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.h3, { marginBottom: 6 }]}>Propuestas de mejora</Text>
          {stats.propuestasMejora.slice(0, 5).length === 0 ? (
            <Text style={s.small}>Sin propuestas.</Text>
          ) : (
            stats.propuestasMejora.slice(0, 5).map((p, i) => (
              <View key={i} style={[s.card, { padding: 8 }]}>
                <Text style={{ fontSize: 9, lineHeight: 1.4 }}>{p.texto}</Text>
              </View>
            ))
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.h3, { marginBottom: 6 }]}>Propuestas de menú</Text>
          {stats.propuestasMenu.slice(0, 5).length === 0 ? (
            <Text style={s.small}>Sin propuestas.</Text>
          ) : (
            stats.propuestasMenu.slice(0, 5).map((p, i) => (
              <View key={i} style={[s.card, { padding: 8 }]}>
                <Text style={{ fontSize: 9, lineHeight: 1.4 }}>{p.texto}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {stats.incidentes.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={[s.h3, { color: C.red, marginBottom: 6 }]}>Incidentes reportados</Text>
          {stats.incidentes.slice(0, 8).map((it, i) => (
            <View
              key={i}
              style={[s.card, { backgroundColor: C.redBg, borderColor: C.red, padding: 8 }]}
            >
              <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.4 }}>{it.texto}</Text>
              <Text style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
                {format(new Date(it.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
              </Text>
            </View>
          ))}
        </View>
      )}

      <PageFooter pageNumber={6} />
    </Page>
  );
}

function MetodologiaPage({ data }: { data: ReportData }) {
  const dias =
    Math.round(
      (data.fechaHasta.getTime() - data.fechaDesde.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
  return (
    <Page size="A4" style={s.page}>
      <SectionTitle pageNo="06 · CIERRE">Metodología y cierre</SectionTitle>

      <View style={[s.card, { padding: 14 }]}>
        <Text style={s.h3}>Metodología</Text>
        <View style={s.divider} />
        <Text style={{ fontSize: 10, lineHeight: 1.6, marginTop: 6 }}>
          Las respuestas fueron levantadas directamente en el comedor mediante una encuesta digital
          anónima, disponible para los comensales al finalizar cada servicio. Durante el período
          analizado ({dias} días) se registraron {data.stats.total} encuestas completas en {data.comedorNombre}.
        </Text>
        <Text style={{ fontSize: 10, lineHeight: 1.6, marginTop: 8 }}>
          Las preguntas combinan escalas de 1 a 5, preguntas dicotómicas (sí/no) para incidentes y
          campos de texto libre para propuestas de mejora y sugerencias de menú. El análisis
          cualitativo y la priorización de hallazgos fueron asistidos por inteligencia artificial.
        </Text>
      </View>

      <View style={[s.card, { padding: 14, marginTop: 8 }]}>
        <Text style={s.h3}>Contacto</Text>
        <View style={s.divider} />
        <Text style={{ fontSize: 10, marginTop: 6 }}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Main Catering</Text>
        </Text>
        <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
          contacto@maincatering.com.mx
        </Text>
        <Text style={{ fontSize: 10, color: C.muted }}>
          www.maincatering.com.mx
        </Text>
      </View>

      <View
        style={{
          position: "absolute",
          bottom: 80,
          left: 48,
          right: 48,
          padding: 10,
          backgroundColor: C.soft,
          borderRadius: 6,
        }}
      >
        <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.5, textAlign: "center" }}>
          Análisis generado con asistencia de inteligencia artificial. Los hallazgos y
          recomendaciones son orientativos y deben validarse por el equipo operativo.
        </Text>
      </View>

      <PageFooter pageNumber={7} />
    </Page>
  );
}

export function ReportTemplate({ data }: { data: ReportData }) {
  return (
    <Document
      title={`Reporte ${data.comedorNombre}`}
      author="Main Catering"
    >
      <CoverPage data={data} />
      <ResumenPage data={data} />
      <PromediosPage data={data} />
      <FortalezasPage data={data} />
      <RecomendacionesPage data={data} />
      <VocesPage data={data} />
      <MetodologiaPage data={data} />
    </Document>
  );
}