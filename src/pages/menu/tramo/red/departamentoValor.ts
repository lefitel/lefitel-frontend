/** The value a department select holds when the tramo has none. Not an id. */
export const NINGUNO = "ninguno";

export const valorDeDepartamento = (id: number | null | undefined): string => (id == null ? NINGUNO : String(id));

/** The `id_departamento` a select value stands for. */
export const departamentoDeValor = (v: string): number | null => (v === NINGUNO ? null : Number(v));
