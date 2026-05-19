// Wrapper para generacion de PDF. Stub por ahora.

export async function generateReportPdf(_params: {
  comedorId: string;
  from: string;
  to: string;
}): Promise<Blob> {
  return new Blob([], { type: "application/pdf" });
}
