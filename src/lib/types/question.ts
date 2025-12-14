export type CorrectAnswerBoolean = {
  type: 'boolean';
  value: boolean;
};

export type CorrectAnswerSingleChoice = {
  type: 'single_choice';
  value: string;
};

export type CorrectAnswerMultiChoice = {
  type: 'multiple_choice';
  value: string[];
};

export type CorrectAnswerText = {
  type: 'text';
  value: string;
};

export type CorrectAnswer =
  | CorrectAnswerBoolean
  | CorrectAnswerSingleChoice
  | CorrectAnswerMultiChoice
  | CorrectAnswerText
  // ✅ 业务态（归一化后）
  | boolean
  | string
  | string[];
