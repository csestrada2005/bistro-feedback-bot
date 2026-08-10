import { Document, Page, Text, View, StyleSheet, Svg, Path, Rect } from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export type GrupoSP = { categoria: string; conteo: number };

export type PreguntaSP = {
  texto: string;
  n: number;
  /** Porcentaje por calificación, de 5 a 1. */
  dist: { valor: number; pct: number }[];
};

export type ReportDataSP = {
  comedorNombre: string;
  comedorEmpresa: string;
  fechaDesde: Date;
  fechaHasta: Date;
  totalEncuestas: number;
  totalPersonal: number | null;
  preguntas: PreguntaSP[];
  incidentesSiPct: number | null;
  incidentesNoPct: number | null;
  agrupaciones: {
    incidentes: GrupoSP[];
    mejoras: GrupoSP[];
    menu: GrupoSP[];
    fuente?: string;
  };
};

const C = {
  red: "#E30613",
  grey: "#595959",
  text: "#1F2933",
  muted: "#6B7280",
  border: "#B7BDC6",
  white: "#FFFFFF",
};

// Colores por calificación (5 -> 1), tomando la referencia de la presentación.
const SLICE_COLORS: Record<number, string> = {
  5: "#1F4E79",
  4: "#ED7D31",
  3: "#2E7D32",
  2: "#29A3DC",
  1: "#9C27B0",
};

const ESCALA: { valor: number; label: string }[] = [
  { valor: 5, label: "Muy bueno" },
  { valor: 4, label: "Bueno" },
  { valor: 3, label: "Regular" },
  { valor: 2, label: "Malo" },
  { valor: 1, label: "Deficiente" },
];

const STAR_PATH =
  "M 10 0.8 L 12.6 7 L 19.2 7.5 L 14.1 11.8 L 15.7 18.3 L 10 14.8 L 4.3 18.3 L 5.9 11.8 L 0.8 7.5 L 7.4 7 Z";

/** Estrellas dibujadas en SVG: las fuentes base de PDF no incluyen el glifo ★. */
function Stars({ count, size = 9 }: { count: number; size?: number }) {
  const gap = 1.5;
  const width = count * size + (count - 1) * gap;
  return (
    <Svg width={width} height={size} viewBox={`0 0 ${count * 20 + (count - 1) * 3} 20`}>
      {Array.from({ length: count }).map((_, i) => (
        <Path key={i} d={STAR_PATH} fill="#E0A800" transform={`translate(${i * 23}, 0)`} />
      ))}
    </Svg>
  );
}

const s = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 46,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.text,
    backgroundColor: C.white,
  },
  cover: { padding: 0, fontFamily: "Helvetica", backgroundColor: C.white, color: C.text },
  coverBar: { height: 10, backgroundColor: C.red },
  coverBody: { paddingHorizontal: 56, paddingTop: 120 },
  coverKicker: { fontSize: 11, color: C.grey, letterSpacing: 1 },
  coverTitle: { fontSize: 34, fontFamily: "Helvetica-Bold", color: C.grey, marginTop: 14 },
  coverSub: { fontSize: 14, color: C.muted, marginTop: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  titleAccent: { width: 4, height: 22, backgroundColor: C.red, marginRight: 10 },
  slideTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.grey },
  sub: { fontSize: 9, color: C.muted, marginBottom: 10 },
  body: { flexDirection: "row", gap: 26, alignItems: "center", flexGrow: 1 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  swatch: { width: 9, height: 9, marginRight: 6 },
  starsCell: { width: 64, flexDirection: "row", alignItems: "center" },
  legendLabel: { fontSize: 9, color: C.text, width: 66 },
  legendPct: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.grey },
  table: { borderWidth: 1, borderColor: C.border, marginTop: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  thCell: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    padding: 5,
    color: C.grey,
    backgroundColor: "#F1F3F5",
  },
  tdCell: { fontSize: 9, padding: 5, color: C.text },
  colWide: { flex: 1, borderRightWidth: 1, borderRightColor: C.border },
  colNum: { width: 46, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: C.muted,
  },
  thanks: { fontSize: 40, fontFamily: "Helvetica-Bold", color: C.grey },
});

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= 359.999) {
    // Círculo completo dibujado con dos arcos.
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }
  const p1 = polarToCartesian(cx, cy, r, start);
  const p2 = polarToCartesian(cx, cy, r, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

function Pie({ data, size = 230 }: { data: { valor: number; pct: number }[]; size?: number }) {
  const total = data.reduce((a, b) => a + b.pct, 0);
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  let angle = 0;
  const slices = data
    .filter((d) => d.pct > 0)
    .map((d) => {
      const sweep = total > 0 ? (d.pct / total) * 360 : 0;
      const start = angle;
      angle += sweep;
      return { valor: d.valor, d: slicePath(cx, cy, r, start, angle) };
    });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.length === 0 ? (
        <Rect x={0} y={0} width={size} height={size} fill="#F1F3F5" />
      ) : (
        slices.map((sl) => (
          <Path key={sl.valor} d={sl.d} fill={SLICE_COLORS[sl.valor]} stroke={C.white} strokeWidth={1} />
        ))
      )}
    </Svg>
  );
}

function Legend({ dist }: { dist: { valor: number; pct: number }[] }) {
  const byValor = new Map(dist.map((d) => [d.valor, d.pct]));
  return (
    <View>
      {ESCALA.map((e) => (
        <View key={e.valor} style={s.legendRow}>
          <View style={[s.swatch, { backgroundColor: SLICE_COLORS[e.valor] }]} />
          <View style={s.starsCell}>
            <Stars count={e.valor} />
          </View>
          <Text style={s.legendLabel}>{e.label}</Text>
          <Text style={s.legendPct}>{Math.round(byValor.get(e.valor) ?? 0)}%</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ page, empresa }: { page: number; empresa: string }) {
  return (
    <View style={s.footer} fixed={false}>
      <Text>{page}</Text>
      <Text>{empresa}</Text>
    </View>
  );
}

function GrupoTable({
  titulo,
  grupos,
  aviso,
}: {
  titulo: string;
  grupos: GrupoSP[];
  aviso?: boolean;
}) {
  return (
    <View>
      <Text style={[s.slideTitle, { marginBottom: 6 }]}>{titulo}</Text>
      {aviso && (
        <Text style={s.sub}>
          Agrupación automática no disponible: se muestran los comentarios tal como se capturaron.
        </Text>
      )}
      <View style={s.table}>
        <View style={s.tr}>
          <Text style={[s.thCell, s.colWide]}>CATEGORÍA</Text>
          <Text style={[s.thCell, s.colNum]}>NO.</Text>
        </View>
        {grupos.length === 0 ? (
          <View style={s.tr}>
            <Text style={[s.tdCell, s.colWide]}>Sin comentarios en el periodo</Text>
            <Text style={[s.tdCell, s.colNum]}>0</Text>
          </View>
        ) : (
          grupos.map((g, i) => (
            <View key={`${g.categoria}-${i}`} style={s.tr} wrap={false}>
              <Text style={[s.tdCell, s.colWide]}>{g.categoria}</Text>
              <Text style={[s.tdCell, s.colNum]}>{g.conteo}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export function SPReportTemplate({ data }: { data: ReportDataSP }) {
  const periodo = `${format(data.fechaDesde, "d 'de' MMMM yyyy", { locale: es })} — ${format(
    data.fechaHasta,
    "d 'de' MMMM yyyy",
    { locale: es }
  )}`;
  const participacion =
    data.totalPersonal && data.totalPersonal > 0
      ? Math.round((data.totalEncuestas / data.totalPersonal) * 100)
      : null;
  const empresa = data.comedorEmpresa || data.comedorNombre;
  const avisoTextual = data.agrupaciones.fuente !== "ia";
  let page = 1;

  return (
    <Document title={`Encuesta comedor — ${data.comedorNombre}`}>
      {/* Portada */}
      <Page size="A4" orientation="landscape" style={s.cover}>
        <View style={s.coverBar} />
        <View style={s.coverBody}>
          <Text style={s.coverKicker}>{empresa.toUpperCase()}</Text>
          <Text style={s.coverTitle}>Encuesta Comedor</Text>
          <Text style={s.coverSub}>{data.comedorNombre}</Text>
          <Text style={s.coverSub}>{periodo}</Text>
        </View>
      </Page>

      {/* Objetivo */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.titleRow}>
          <View style={s.titleAccent} />
          <Text style={s.slideTitle}>Objetivo</Text>
        </View>
        <Text style={{ fontSize: 12, color: C.text, marginBottom: 16, maxWidth: 460 }}>
          Conocer los comentarios del personal de {empresa}, para implementar mejoras en el comedor.
        </Text>
        <View style={s.body}>
          <View style={{ width: 300 }}>
            <View style={s.table}>
              <View style={s.tr}>
                <Text style={[s.thCell, s.colWide]}>CALIFICACIÓN</Text>
                <Text style={[s.thCell, { width: 110 }]}>DESCRIPCIÓN</Text>
              </View>
              {ESCALA.map((e) => (
                <View key={e.valor} style={s.tr}>
                  <View style={[s.colWide, { flexDirection: "row", alignItems: "center", padding: 5 }]}>
                    <Text style={{ fontSize: 9, width: 16, color: C.text }}>{e.valor}</Text>
                    <Stars count={e.valor} size={10} />
                  </View>
                  <Text style={[s.tdCell, { width: 110 }]}>{e.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View>
            <Text style={{ fontSize: 12, marginBottom: 8 }}>
              Total de encuestas realizadas: {data.totalEncuestas}
            </Text>
            {data.totalPersonal ? (
              <Text style={{ fontSize: 12, marginBottom: 8 }}>
                Total de personal: {data.totalPersonal}
              </Text>
            ) : null}
            {participacion !== null && (
              <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: C.red }}>
                {participacion}% de participación
              </Text>
            )}
          </View>
        </View>
        <Footer page={page++} empresa={empresa} />
      </Page>

      {/* Una lámina por pregunta */}
      {data.preguntas.map((p, idx) => (
        <Page key={`${p.texto}-${idx}`} size="A4" orientation="landscape" style={s.page}>
          <View style={s.titleRow}>
            <View style={s.titleAccent} />
            <Text style={s.slideTitle}>
              {idx + 1}. {p.texto.toUpperCase()}
            </Text>
          </View>
          <Text style={s.sub}>Base: {p.n} respuestas</Text>
          <View style={s.body}>
            <Pie data={p.dist} />
            <Legend dist={p.dist} />
          </View>
          <Footer page={page++} empresa={empresa} />
        </Page>
      ))}

      {/* Incidentes */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.titleRow}>
          <View style={s.titleAccent} />
          <Text style={s.slideTitle}>¿HAS TENIDO ALGÚN INCIDENTE CON TUS ALIMENTOS?</Text>
        </View>
        <Text style={s.sub}>
          {data.incidentesSiPct === null
            ? "Sin respuestas en el periodo"
            : `SÍ ${Math.round(data.incidentesSiPct)}%  ·  NO ${Math.round(
                data.incidentesNoPct ?? 0
              )}%`}
        </Text>
        <GrupoTable titulo="MENCIONA CUÁL HA SIDO EL INCIDENTE" grupos={data.agrupaciones.incidentes} aviso={avisoTextual} />
        <Footer page={page++} empresa={empresa} />
      </Page>

      {/* Propuestas de mejora */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.titleRow}>
          <View style={s.titleAccent} />
          <Text style={s.slideTitle}>¿QUÉ PROPONES PARA MEJORAR EL SERVICIO DE COMEDOR?</Text>
        </View>
        <GrupoTable titulo="PROPUESTAS" grupos={data.agrupaciones.mejoras} aviso={avisoTextual} />
        <Footer page={page++} empresa={empresa} />
      </Page>

      {/* Propuestas de menú */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.titleRow}>
          <View style={s.titleAccent} />
          <Text style={s.slideTitle}>PROPUESTAS DE MENÚ (PLATO FUERTE)</Text>
        </View>
        <GrupoTable titulo="PROPUESTAS" grupos={data.agrupaciones.menu} aviso={avisoTextual} />
        <Footer page={page++} empresa={empresa} />
      </Page>

      {/* Cierre */}
      <Page size="A4" orientation="landscape" style={s.cover}>
        <View style={s.coverBar} />
        <View style={[s.coverBody, { paddingTop: 170 }]}>
          <Text style={s.thanks}>¡Gracias!</Text>
          <Text style={s.coverSub}>{empresa}</Text>
        </View>
      </Page>
    </Document>
  );
}