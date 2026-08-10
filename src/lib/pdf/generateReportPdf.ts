import { pdf } from "@react-pdf/renderer";
import { format } from "date-fns";
import { addDays, startOfDay } from "date-fns";
import React from "react";

import { supabase } from "@/integrations/supabase/client";
import { ReportTemplate, type AnalisisIA, type ReportData } from "./ReportTemplate";
import { SPReportTemplate, type GrupoSP, type ReportDataSP } from "./SPReportTemplate";

type Pregunta = {
  id: string;
  texto: string;
  tipo: "escala_5" | "si_no" | "texto_abierto" | "texto_multiple_3";
  orden: number;
};
type Encuesta = { id: string; fecha: string; comedor_id: string };
type Respuesta = {
  id: string;
  encuesta_id: string;
  pregunta_id: string;
  valor_numerico: number | null;
  valor_booleano: boolean | null;
  valor_texto: string | null;
  created_at: string;
};

function computeStats(preguntas: Pregunta[], encuestas: Encuesta[], respuestas: Respuesta[]) {
  const pregById = new Map(preguntas.map((p) => [p.id, p]));
  const encById = new Map(encuestas.map((e) => [e.id, e]));

  const escala = preguntas.filter((p) => p.tipo === "escala_5");
  const porPregunta = escala
    .map((p) => {
      const vals = respuestas
        .filter((r) => r.pregunta_id === p.id && r.valor_numerico != null)
        .map((r) => r.valor_numerico as number);
      const n = vals.length;
      return { id: p.id, texto: p.texto, promedio: n ? vals.reduce((a, b) => a + b, 0) / n : 0, n };
    })
    .filter((x) => x.n > 0);

  const promedio =
    porPregunta.length > 0
      ? porPregunta.reduce((a, b) => a + b.promedio, 0) / porPregunta.length
      : null;

  const incidenteQ = preguntas.find((p) => p.tipo === "si_no");
  let pctIncidentes: number | null = null;
  const incidentes: { texto: string; fecha: string }[] = [];
  if (incidenteQ) {
    const incResp = respuestas.filter((r) => r.pregunta_id === incidenteQ.id);
    const yes = incResp.filter((r) => r.valor_booleano === true);
    pctIncidentes = incResp.length > 0 ? (yes.length / incResp.length) * 100 : null;
    yes.forEach((r) => {
      const e = encById.get(r.encuesta_id);
      incidentes.push({
        texto: r.valor_texto?.trim() || "(sin descripción)",
        fecha: e?.fecha ?? r.created_at,
      });
    });
    incidentes.sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  }

  const propuestasMejora: { texto: string; fecha: string }[] = [];
  const propuestasMenu: { texto: string; fecha: string }[] = [];
  let totalPropuestas = 0;
  respuestas.forEach((r) => {
    const p = pregById.get(r.pregunta_id);
    if (!p) return;
    if (p.tipo !== "texto_multiple_3" && p.tipo !== "texto_abierto") return;
    const raw = r.valor_texto?.trim();
    if (!raw) return;
    const partes = raw.split("|").map((s) => s.trim()).filter(Boolean);
    if (!partes.length) return;
    totalPropuestas += partes.length;
    const fecha = encById.get(r.encuesta_id)?.fecha ?? r.created_at;
    const esMenu = /men[uú]/i.test(p.texto);
    partes.forEach((t) => (esMenu ? propuestasMenu : propuestasMejora).push({ texto: t, fecha }));
  });

  return {
    total: encuestas.length,
    promedio,
    pctIncidentes,
    totalPropuestas,
    porPregunta,
    propuestasMejora,
    propuestasMenu,
    incidentes,
  };
}

export async function buildReportDataFromReporteId(reporteId: string): Promise<ReportData> {
  const { data: reporte, error } = await supabase
    .from("reportes")
    .select("id, comedor_id, fecha_desde, fecha_hasta, analisis_ia")
    .eq("id", reporteId)
    .single();
  if (error || !reporte) throw new Error("Reporte no encontrado");

  const { data: comedor } = await supabase
    .from("comedores_admin")
    .select("nombre, empresa_cliente, slug")
    .eq("id", reporte.comedor_id)
    .single();

  const fechaDesde = new Date(reporte.fecha_desde);
  const fechaHasta = new Date(reporte.fecha_hasta);
  const desdeISO = startOfDay(fechaDesde).toISOString();
  const hastaISO = addDays(startOfDay(fechaHasta), 1).toISOString();

  const [pQ, eQ] = await Promise.all([
    supabase.from("preguntas").select("id, texto, tipo, orden").order("orden"),
    supabase
      .from("encuestas")
      .select("id, fecha, comedor_id")
      .eq("comedor_id", reporte.comedor_id)
      .gte("fecha", desdeISO)
      .lt("fecha", hastaISO),
  ]);

  const preguntas = (pQ.data ?? []) as Pregunta[];
  const encuestas = (eQ.data ?? []) as Encuesta[];
  const ids = encuestas.map((e) => e.id);

  const rQ = ids.length
    ? await supabase.from("respuestas").select("*").in("encuesta_id", ids)
    : { data: [] as Respuesta[] };
  const respuestas = (rQ.data ?? []) as Respuesta[];

  return {
    comedorNombre: comedor?.nombre ?? "Comedor",
    comedorEmpresa: comedor?.empresa_cliente ?? "",
    fechaDesde,
    fechaHasta,
    stats: computeStats(preguntas, encuestas, respuestas),
    analisis: reporte.analisis_ia as unknown as AnalisisIA,
  };
}

async function getPlantillaForReporte(reporteId: string): Promise<string> {
  const { data: reporte } = await supabase
    .from("reportes")
    .select("comedor_id")
    .eq("id", reporteId)
    .maybeSingle();
  if (!reporte) return "estandar";
  const { data: comedor } = await supabase
    .from("comedores_admin")
    .select("plantilla_reporte")
    .eq("id", reporte.comedor_id)
    .maybeSingle();
  return comedor?.plantilla_reporte ?? "estandar";
}

async function fetchAgrupaciones(reporteId: string): Promise<ReportDataSP["agrupaciones"]> {
  const empty = { incidentes: [] as GrupoSP[], mejoras: [] as GrupoSP[], menu: [] as GrupoSP[] };
  const { data: reporte } = await supabase
    .from("reportes")
    .select("agrupaciones")
    .eq("id", reporteId)
    .maybeSingle();
  const cached = reporte?.agrupaciones as ReportDataSP["agrupaciones"] | null;
  if (cached && (cached.incidentes || cached.mejoras || cached.menu)) {
    return { ...empty, ...cached };
  }
  const { data, error } = await supabase.functions.invoke("group-comments", {
    body: { reporte_id: reporteId },
  });
  if (error) {
    console.error("group-comments falló", error);
    return empty;
  }
  const ag = (data as { agrupaciones?: ReportDataSP["agrupaciones"] })?.agrupaciones;
  return ag ? { ...empty, ...ag } : empty;
}

export async function buildSPReportDataFromReporteId(reporteId: string): Promise<ReportDataSP> {
  const { data: reporte, error } = await supabase
    .from("reportes")
    .select("id, comedor_id, fecha_desde, fecha_hasta")
    .eq("id", reporteId)
    .single();
  if (error || !reporte) throw new Error("Reporte no encontrado");

  const { data: comedor } = await supabase
    .from("comedores_admin")
    .select("nombre, empresa_cliente, total_personal")
    .eq("id", reporte.comedor_id)
    .single();

  const fechaDesde = new Date(reporte.fecha_desde);
  const fechaHasta = new Date(reporte.fecha_hasta);
  const desdeISO = startOfDay(fechaDesde).toISOString();
  const hastaISO = addDays(startOfDay(fechaHasta), 1).toISOString();

  const [pQ, eQ, agrupaciones] = await Promise.all([
    supabase
      .from("comedor_preguntas")
      .select("preguntas(id, texto, tipo, orden)")
      .eq("comedor_id", reporte.comedor_id),
    supabase
      .from("encuestas")
      .select("id, fecha, comedor_id")
      .eq("comedor_id", reporte.comedor_id)
      .gte("fecha", desdeISO)
      .lt("fecha", hastaISO),
    fetchAgrupaciones(reporteId),
  ]);

  const preguntas = ((pQ.data ?? []) as { preguntas: Pregunta | null }[])
    .map((row) => row.preguntas)
    .filter((p): p is Pregunta => p !== null)
    .sort((a, b) => a.orden - b.orden);
  const encuestas = (eQ.data ?? []) as Encuesta[];
  const ids = encuestas.map((e) => e.id);

  const rQ = ids.length
    ? await supabase.from("respuestas").select("*").in("encuesta_id", ids)
    : { data: [] as Respuesta[] };
  const respuestas = (rQ.data ?? []) as Respuesta[];

  const preguntasSP = preguntas
    .filter((p) => p.tipo === "escala_5")
    .map((p) => {
      const vals = respuestas
        .filter((r) => r.pregunta_id === p.id && r.valor_numerico != null)
        .map((r) => r.valor_numerico as number);
      const n = vals.length;
      const dist = [5, 4, 3, 2, 1].map((valor) => ({
        valor,
        pct: n ? (vals.filter((v) => v === valor).length / n) * 100 : 0,
      }));
      return { texto: p.texto, n, dist };
    });

  const incidenteQ = preguntas.find((p) => p.tipo === "si_no");
  let incidentesSiPct: number | null = null;
  let incidentesNoPct: number | null = null;
  if (incidenteQ) {
    const incResp = respuestas.filter(
      (r) => r.pregunta_id === incidenteQ.id && r.valor_booleano != null
    );
    if (incResp.length) {
      const si = incResp.filter((r) => r.valor_booleano === true).length;
      incidentesSiPct = (si / incResp.length) * 100;
      incidentesNoPct = 100 - incidentesSiPct;
    }
  }

  return {
    comedorNombre: comedor?.nombre ?? "Comedor",
    comedorEmpresa: comedor?.empresa_cliente ?? "",
    fechaDesde,
    fechaHasta,
    totalEncuestas: encuestas.length,
    totalPersonal: comedor?.total_personal ?? null,
    preguntas: preguntasSP,
    incidentesSiPct,
    incidentesNoPct,
    agrupaciones,
  };
}

export async function downloadReportPdf(reporteId: string) {
  const plantilla = await getPlantillaForReporte(reporteId);
  let element: React.ReactElement;
  let comedorNombre: string;
  let fechaDesde: Date;
  let fechaHasta: Date;

  if (plantilla === "sp") {
    const spData = await buildSPReportDataFromReporteId(reporteId);
    element = React.createElement(SPReportTemplate, { data: spData });
    comedorNombre = spData.comedorNombre;
    fechaDesde = spData.fechaDesde;
    fechaHasta = spData.fechaHasta;
  } else {
    const data = await buildReportDataFromReporteId(reporteId);
    // @react-pdf/renderer's pdf() expects a <Document>; our wrapper returns one.
    element = React.createElement(ReportTemplate, { data });
    comedorNombre = data.comedorNombre;
    fechaDesde = data.fechaDesde;
    fechaHasta = data.fechaHasta;
  }
  const blob = await pdf(element as unknown as Parameters<typeof pdf>[0]).toBlob();
  const slug =
    (await supabase
      .from("comedores")
      .select("slug")
      .eq("nombre", comedorNombre)
      .maybeSingle()).data?.slug ?? "comedor";
  const filename = `reporte_${slug}_${format(fechaDesde, "yyyy-MM-dd")}_${format(
    fechaHasta,
    "yyyy-MM-dd"
  )}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}