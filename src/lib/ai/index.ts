// Wrapper para la integracion de IA.
// Por ahora retorna stubs; cuando reconectemos backend, se sustituye
// por llamadas a las edge functions ya existentes (generate-insights, etc.).

export async function generateInsights(_input: unknown): Promise<{ summary: string; recommendations: string[] }> {
  return { summary: "Analisis IA no disponible (modo mock).", recommendations: [] };
}

export async function suggestQuestions(_topic: string): Promise<string[]> {
  return [];
}

export async function moderateComment(_text: string): Promise<{ category: string; action: string }> {
  return { category: "pending", action: "review" };
}
