export type Comedor = {
  id: string;
  slug: string;
  nombre: string;
  ubicacion: string;
  activo: boolean;
};

export type QuestionType = "scale_5" | "yes_no" | "open_text";

export type Question = {
  id: string;
  order: number;
  text: string;
  type: QuestionType;
  required: boolean;
  conditionalText?: string;
  activeForSites: string[];
};

export type AnswerValue = number | "si" | "no" | string;

export type SurveyResponse = {
  id: string;
  comedorId: string;
  createdAt: string;
  answers: Record<string, AnswerValue>;
  conditionalText?: string;
  proposalsImprovement: string[];
  proposalsMenu: string[];
};

export type AdminUser = {
  id: string;
  email: string;
  role: "admin" | "operador";
  comedorId?: string;
};
