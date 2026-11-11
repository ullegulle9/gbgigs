export type FormState = {
  error: string | null;
  success: string | null;
};

export const emptyFormState: FormState = {
  error: null,
  success: null,
};
