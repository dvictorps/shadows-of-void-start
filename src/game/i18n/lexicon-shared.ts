export type GrammaticalGender = "m" | "f";

export interface GenderedForm {
	m: string;
	f: string;
}

export function isGenderedForm(
	form: string | GenderedForm,
): form is GenderedForm {
	return typeof form !== "string";
}

export function pickGendered(
	form: string | GenderedForm,
	gender: GrammaticalGender,
): string {
	return isGenderedForm(form) ? form[gender] : form;
}
