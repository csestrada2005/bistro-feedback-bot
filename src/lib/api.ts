import { supabase } from "@/integrations/supabase/client";

export type PublicQuestion = {
  id: string;
  order_num: number;
  question_text: string;
  question_type: "scale_5" | "trend_3" | "recommend_3" | "comment";
};

export type SubmitSurveyPayload = {
  q1: number;
  q2: number;
  q3: "peor" | "igual" | "mejor";
  q4: "no" | "tal_vez" | "si";
  comment?: string | null;
  response_time_ms: number;
  device_fingerprint: string;
};

export type SubmitSurveyError = {
  code: string;
  message: string;
  retry_after_seconds?: number;
};

export async function fetchPublicQuestions(): Promise<PublicQuestion[]> {
  const { data, error } = await supabase.functions.invoke<{
    questions: PublicQuestion[];
  }>("get-public-questions", { method: "GET" });
  if (error) throw error;
  return data?.questions ?? [];
}

export async function submitSurvey(
  payload: SubmitSurveyPayload
): Promise<{ ok: true; id: string; is_flagged: boolean }> {
  const { data, error } = await supabase.functions.invoke<
    | { ok: true; id: string; is_flagged: boolean }
    | { error: SubmitSurveyError }
  >("submit-survey", { body: payload });

  if (error) {
    // FunctionsHttpError exposes the response body via context
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const body = await ctx.clone().json();
        if (body?.error) {
          const e = body.error as SubmitSurveyError;
          throw Object.assign(new Error(e.message), { code: e.code, meta: e });
        }
      } catch {
        // fall through
      }
    }
    throw error;
  }

  if (data && "error" in data) {
    throw Object.assign(new Error(data.error.message), {
      code: data.error.code,
      meta: data.error,
    });
  }
  return data as { ok: true; id: string; is_flagged: boolean };
}
