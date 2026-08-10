import React from "react";
import ReactPDF from "@react-pdf/renderer";
import { SPReportTemplate } from "/dev-server/src/lib/pdf/SPReportTemplate";

const qs = [
  "Calidad de los alimentos","Sabor de los alimentos","Temperatura de los alimentos","Variedad del menú",
  "Limpieza del comedor","Atención del personal de servicio","Tiempo de espera en la fila",
];
const data = {
  comedorNombre: "Comedor Soler y Palau",
  comedorEmpresa: "Soler y Palau",
  fechaDesde: new Date("2026-07-01"),
  fechaHasta: new Date("2026-07-31"),
  totalEncuestas: 84,
  totalPersonal: 120,
  preguntas: qs.map((texto, i) => ({
    texto, n: 84,
    dist: [5,4,3,2,1].map((valor, j) => ({ valor, pct: [40,25,18,10,7].map(x=>x+((i+j)%3))[j] })),
  })),
  incidentesSiPct: 12,
  incidentesNoPct: 88,
  agrupaciones: {
    incidentes: [{categoria:"ALIMENTO FRÍO",conteo:5},{categoria:"OBJETO EXTRAÑO EN LA COMIDA",conteo:2}],
    mejoras: [{categoria:"MÁS VARIEDAD DE ENSALADAS",conteo:9},{categoria:"MEJORAR TIEMPO DE FILA",conteo:6}],
    menu: [{categoria:"MILANESA DE POLLO",conteo:11},{categoria:"CHILES RELLENOS",conteo:4}],
    fuente: "ia",
  },
};
await ReactPDF.renderToFile(React.createElement(SPReportTemplate, { data }) as any, "/tmp/pdfqa/out.pdf");
console.log("ok");
