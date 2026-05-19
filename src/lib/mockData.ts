import type { Comedor, Question, SurveyResponse } from "@/types";

// NO TOCAR ESTE ARCHIVO DESPUES DE CREARLO (acuerdo PASO 5).
// Cuando lleguen los textos reales del formato de papel de Main Catering,
// se reemplazan los placeholders y se vuelve a congelar.

export const comedores: Comedor[] = [
  { id: "sp", slug: "sp", nombre: "S&P (Soler y Palau)", ubicacion: "Queretaro", activo: true },
  { id: "telcel-reforma", slug: "telcel-reforma", nombre: "Telcel Reforma", ubicacion: "CDMX", activo: true },
];

const allSites = comedores.map((c) => c.id);
const scale = (order: number, text: string): Question => ({
  id: `q${order}`,
  order,
  text,
  type: "scale_5",
  required: true,
  activeForSites: allSites,
});

export const questions: Question[] = [
  scale(1, "Calidad general de la comida de hoy"),
  scale(2, "Sabor y sazon de los platillos"),
  scale(3, "Temperatura de los alimentos"),
  scale(4, "Variedad del menu"),
  scale(5, "Frescura de los ingredientes"),
  scale(6, "Porcion servida"),
  scale(7, "Presentacion de los platillos"),
  scale(8, "Limpieza del comedor"),
  scale(9, "Limpieza de utensilios y vajilla"),
  scale(10, "Amabilidad del personal de servicio"),
  scale(11, "Rapidez en la fila"),
  scale(12, "Disponibilidad de bebidas y postres"),
  scale(13, "Satisfaccion general con la experiencia de hoy"),
  {
    id: "q14",
    order: 14,
    text: "Recomendarias el comedor a un companero?",
    type: "yes_no",
    required: true,
    conditionalText: "Por que? (solo si respondiste No)",
    activeForSites: allSites,
  },
  {
    id: "q15",
    order: 15,
    text: "Propon 3 mejoras para el comedor",
    type: "open_text",
    required: false,
    activeForSites: allSites,
  },
  {
    id: "q16",
    order: 16,
    text: "Propon 3 platillos que te gustaria ver en el menu",
    type: "open_text",
    required: false,
    activeForSites: allSites,
  },
];

function buildResponse(i: number): SurveyResponse {
  const comedorId = i % 3 === 0 ? "telcel-reforma" : "sp";
  const answers: Record<string, number | "si" | "no" | string> = {};
  for (let q = 1; q <= 13; q++) answers[`q${q}`] = 2 + ((i + q) % 4);
  answers["q14"] = i % 4 === 0 ? "no" : "si";
  const date = new Date();
  date.setDate(date.getDate() - (i % 14));
  return {
    id: `r${i + 1}`,
    comedorId,
    createdAt: date.toISOString(),
    answers,
    conditionalText: answers["q14"] === "no" ? "Falto variedad esta semana" : undefined,
    proposalsImprovement: ["Mas opciones vegetarianas", "Servir mas rapido", "Mejorar postres"],
    proposalsMenu: ["Pozole", "Enchiladas verdes", "Pescado a la veracruzana"],
  };
}

export const responses: SurveyResponse[] = Array.from({ length: 20 }, (_, i) => buildResponse(i));
