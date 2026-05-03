export type SurveyRow = {
  id: string;
  created_at: string;
  question_1_score: number;
  question_2_score: number;
  question_3_trend: "peor" | "igual" | "mejor";
  question_4_recommend: "no" | "tal_vez" | "si";
  comment: string | null;
  comment_status: "pending" | "approved" | "archived" | "deleted";
  is_flagged: boolean;
  daily_menu_id: string | null;
};

export type MenuRow = {
  id: string;
  date: string;
  main_dish: string;
};

export type DateRange = { from: Date; to: Date };
