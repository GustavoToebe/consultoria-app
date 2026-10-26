export type Sexo = 'MASCULINO' | 'FEMININO' | 'OUTRO';

export const ROTULO_DO_SEXO: Record<Sexo, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  OUTRO: 'Outro',
};

export const OPCOES_DE_SEXO: { valor: Sexo; rotulo: string }[] = [
  { valor: 'MASCULINO', rotulo: 'Masculino' },
  { valor: 'FEMININO', rotulo: 'Feminino' },
  { valor: 'OUTRO', rotulo: 'Outro' },
];

export function sexoDoCampo(valor: string | null | undefined): Sexo | null {
  return valor === 'MASCULINO' || valor === 'FEMININO' || valor === 'OUTRO' ? valor : null;
}

/** Leitura da ficha. Ausente = "Não informado". */
export function rotuloDoSexo(sexo: string | null | undefined): string {
  const valor = sexoDoCampo(sexo);
  return valor ? ROTULO_DO_SEXO[valor] : 'Não informado';
}
