import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2JL7SUc.ttf", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    color: "#0a0a0a",
    backgroundColor: "#ffffff",
  },
  watermark: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 80,
    color: "#f1f5f9",
    fontWeight: 700,
    transform: "rotate(-30deg)",
    opacity: 0.7,
  },
  pageNumber: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 56,
    textAlign: "right",
    fontSize: 9,
    color: "#94a3b8",
  },
  footerLine: {
    position: "absolute",
    bottom: 48,
    left: 56,
    right: 56,
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
  },
  sectionHeader: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 11,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 14,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  h1: { fontSize: 26, fontWeight: 700, marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  muted: { color: "#64748b" },
  row: { flexDirection: "row" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  kpiBox: {
    width: "50%",
    padding: 6,
  },
  kpiInner: {
    borderWidth: 0.8,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 12,
  },
  kpiLabel: { fontSize: 9, color: "#64748b", marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: 700 },
  kpiTrend: { fontSize: 9, marginTop: 4, color: "#475569" },
  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 8 },
  bullet: { fontSize: 10, marginBottom: 4, lineHeight: 1.4 },
  bar: { height: 14, backgroundColor: "#0f172a", marginRight: 6 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barLabel: { width: 60, fontSize: 9 },
  barValue: { fontSize: 9, color: "#475569" },
  table: { borderWidth: 0.5, borderColor: "#e2e8f0", marginTop: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  th: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    fontWeight: 700,
    backgroundColor: "#f8fafc",
    color: "#334155",
  },
  td: { flex: 1, padding: 6, fontSize: 9 },
  commentBox: {
    borderLeftWidth: 2,
    borderLeftColor: "#0f172a",
    paddingLeft: 8,
    marginBottom: 10,
  },
  commentMeta: { fontSize: 8, color: "#64748b", marginTop: 4 },
});

function PageChrome({ children, num, total }: { children: React.ReactNode; num: number; total: number }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.watermark} fixed>CONFIDENCIAL</Text>
      {children}
      <View style={styles.footerLine} fixed />
      <Text style={styles.pageNumber} fixed>
        Página {num} de {total}
      </Text>
    </Page>
  );
}

export type PdfQuestion = {
  text: string;
  average: number;
  stdDev: number;
  bestDay: { date: string; value: number } | null;
  worstDay: { date: string; value: number } | null;
  distribution: { label: string; count: number }[];
  daily: { date: string; value: number }[];
  changeVsPrev: number | null;
};

export type PdfReportData = {
  title: string;
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
  generatedAt: string;
  executiveSummary: string;
  questions: PdfQuestion[];
  patterns: string[];
  bottlenecks: { label: string; detail: string }[];
  comments: { date: string; text: string; scores: string }[];
  recommendations: { title: string; impact: string }[];
  methodology: {
    totalResponses: number;
    validResponses: number;
    flaggedExcluded: number;
    lowSampleDays: string[];
    moderation: { approved: number; archived: number; deleted: number; pending: number };
    antiFraud: string[];
  };
};

function fmtPct(n: number | null) {
  if (n === null || !isFinite(n)) return "—";
  const s = n >= 0 ? "▲" : "▼";
  return `${s} ${Math.abs(n).toFixed(1)}%`;
}

function MiniBars({ data, max }: { data: { label: string; count: number }[]; max: number }) {
  return (
    <View>
      {data.map((d) => {
        const w = max > 0 ? (d.count / max) * 280 : 0;
        return (
          <View key={d.label} style={styles.barRow}>
            <Text style={styles.barLabel}>{d.label}</Text>
            <View style={[styles.bar, { width: w || 1 }]} />
            <Text style={styles.barValue}>{d.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function MiniLine({ points }: { points: { date: string; value: number }[] }) {
  if (!points.length) return <Text style={styles.muted}>Sin datos</Text>;
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 60, borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1" }}>
      {points.map((p, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            marginHorizontal: 1,
            height: `${Math.max(4, (p.value / max) * 100)}%`,
            backgroundColor: "#0f172a",
          }}
        />
      ))}
    </View>
  );
}

export function ReportPdf({ data }: { data: PdfReportData }) {
  const totalPages = 10;
  const trendOverall = data.questions[0]?.daily ?? [];

  return (
    <Document title={data.title}>
      {/* PAGE 1 — Cover */}
      <PageChrome num={1} total={totalPages}>
        <View style={{ width: 56, height: 56, backgroundColor: "#0f172a", marginBottom: 60 }} />
        <Text style={[styles.muted, { fontSize: 11, marginBottom: 8 }]}>Reporte interno</Text>
        <Text style={styles.h1}>Reporte de Satisfacción del Comedor</Text>
        <Text style={[styles.paragraph, { marginTop: 24 }]}>
          Período: <Text style={{ fontWeight: 700 }}>{data.periodStart}</Text> al{" "}
          <Text style={{ fontWeight: 700 }}>{data.periodEnd}</Text>
        </Text>
        <Text style={styles.paragraph}>Generado por: {data.generatedBy}</Text>
        <Text style={styles.paragraph}>Generado el: {data.generatedAt}</Text>
      </PageChrome>

      {/* PAGE 2 — Resumen Ejecutivo */}
      <PageChrome num={2} total={totalPages}>
        <Text style={styles.sectionHeader}>Resumen Ejecutivo</Text>
        <View style={styles.kpiGrid}>
          {data.questions.map((q, i) => (
            <View key={i} style={styles.kpiBox}>
              <View style={styles.kpiInner}>
                <Text style={styles.kpiLabel}>Pregunta {i + 1}</Text>
                <Text style={styles.kpiValue}>{q.average.toFixed(2)}</Text>
                <Text style={styles.kpiTrend}>vs período anterior: {fmtPct(q.changeVsPrev)}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.h2, { marginTop: 18 }]}>Síntesis</Text>
        <Text style={styles.paragraph}>{data.executiveSummary}</Text>
        <Text style={[styles.h2, { marginTop: 8 }]}>Tendencia general</Text>
        <MiniLine points={trendOverall} />
      </PageChrome>

      {/* PAGES 3-6 — Análisis por pregunta */}
      {data.questions.map((q, i) => {
        const max = Math.max(...q.distribution.map((d) => d.count), 1);
        return (
          <PageChrome key={i} num={3 + i} total={totalPages}>
            <Text style={styles.sectionHeader}>Pregunta {i + 1}</Text>
            <Text style={styles.h2}>{q.text}</Text>
            <Text style={[styles.paragraph, styles.muted]}>
              Promedio: {q.average.toFixed(2)} · Desv. estándar: {q.stdDev.toFixed(2)}
            </Text>

            <Text style={[styles.h2, { marginTop: 12 }]}>Distribución</Text>
            <MiniBars data={q.distribution} max={max} />

            <Text style={[styles.h2, { marginTop: 16 }]}>Tendencia diaria</Text>
            <MiniLine points={q.daily} />

            <View style={[styles.row, { marginTop: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kpiLabel}>Mejor día</Text>
                <Text style={{ fontSize: 12, fontWeight: 700 }}>
                  {q.bestDay ? `${q.bestDay.date} · ${q.bestDay.value.toFixed(2)}` : "—"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kpiLabel}>Peor día</Text>
                <Text style={{ fontSize: 12, fontWeight: 700 }}>
                  {q.worstDay ? `${q.worstDay.date} · ${q.worstDay.value.toFixed(2)}` : "—"}
                </Text>
              </View>
            </View>
          </PageChrome>
        );
      })}

      {/* PAGE 7 — Hallazgos IA */}
      <PageChrome num={7} total={totalPages}>
        <Text style={styles.sectionHeader}>Hallazgos IA</Text>
        <Text style={styles.h2}>Patrones detectados</Text>
        {data.patterns.length === 0 ? (
          <Text style={[styles.paragraph, styles.muted]}>Análisis IA pendiente.</Text>
        ) : (
          data.patterns.map((p, i) => (
            <Text key={i} style={styles.bullet}>• {p}</Text>
          ))
        )}
        <Text style={[styles.h2, { marginTop: 14 }]}>Cuellos de botella</Text>
        {data.bottlenecks.length === 0 ? (
          <Text style={[styles.paragraph, styles.muted]}>Sin cuellos de botella detectados.</Text>
        ) : (
          data.bottlenecks.map((b, i) => (
            <Text key={i} style={styles.bullet}>• <Text style={{ fontWeight: 700 }}>{b.label}</Text> — {b.detail}</Text>
          ))
        )}
      </PageChrome>

      {/* PAGE 8 — Comentarios destacados */}
      <PageChrome num={8} total={totalPages}>
        <Text style={styles.sectionHeader}>Comentarios destacados</Text>
        {data.comments.length === 0 ? (
          <Text style={[styles.paragraph, styles.muted]}>Sin comentarios aprobados en el período.</Text>
        ) : (
          data.comments.map((c, i) => (
            <View key={i} style={styles.commentBox} wrap={false}>
              <Text style={{ fontSize: 10, lineHeight: 1.4 }}>"{c.text}"</Text>
              <Text style={styles.commentMeta}>{c.date} · {c.scores}</Text>
            </View>
          ))
        )}
      </PageChrome>

      {/* PAGE 9 — Recomendaciones */}
      <PageChrome num={9} total={totalPages}>
        <Text style={styles.sectionHeader}>Recomendaciones</Text>
        {data.recommendations.length === 0 ? (
          <Text style={[styles.paragraph, styles.muted]}>
            Recomendaciones IA pendientes de generación.
          </Text>
        ) : (
          data.recommendations.map((r, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}. {r.title}</Text>
              <Text style={[styles.paragraph, { marginTop: 2 }]}>{r.impact}</Text>
            </View>
          ))
        )}
      </PageChrome>

      {/* PAGE 10 — Anexo metodológico */}
      <PageChrome num={10} total={totalPages}>
        <Text style={styles.sectionHeader}>Anexo metodológico</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Métrica</Text>
            <Text style={styles.th}>Valor</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.td}>Total de respuestas</Text>
            <Text style={styles.td}>{data.methodology.totalResponses}</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.td}>Respuestas válidas</Text>
            <Text style={styles.td}>{data.methodology.validResponses}</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.td}>Marcadas como sospechosas y excluidas</Text>
            <Text style={styles.td}>{data.methodology.flaggedExcluded}</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.td}>Período del análisis</Text>
            <Text style={styles.td}>{data.periodStart} — {data.periodEnd}</Text>
          </View>
        </View>

        <Text style={[styles.h2, { marginTop: 14 }]}>Días con muestra insuficiente (&lt;20)</Text>
        {data.methodology.lowSampleDays.length === 0 ? (
          <Text style={[styles.paragraph, styles.muted]}>Ninguno.</Text>
        ) : (
          <Text style={styles.paragraph}>{data.methodology.lowSampleDays.join(", ")}</Text>
        )}

        <Text style={[styles.h2, { marginTop: 4 }]}>Comentarios moderados</Text>
        <Text style={styles.paragraph}>
          Aprobados: {data.methodology.moderation.approved} · Archivados:{" "}
          {data.methodology.moderation.archived} · Borrados:{" "}
          {data.methodology.moderation.deleted} · Pendientes:{" "}
          {data.methodology.moderation.pending}
        </Text>

        <Text style={[styles.h2, { marginTop: 4 }]}>Técnicas anti-fraude aplicadas</Text>
        {data.methodology.antiFraud.map((t, i) => (
          <Text key={i} style={styles.bullet}>• {t}</Text>
        ))}
      </PageChrome>
    </Document>
  );
}