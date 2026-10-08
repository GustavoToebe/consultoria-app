/** Contas do calendário do seletor de data. Tudo em UTC para o dia nunca andar com o fuso. */

export const NOMES_DOS_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

export interface MesDoCalendario {
  ano: number;
  /** 0 = janeiro. */
  mes: number;
}

export function mesDeIso(iso: string | null | undefined, padrao: string): MesDoCalendario {
  const [a, m] = (iso ?? padrao).split('-').map(Number);
  return { ano: a, mes: m - 1 };
}

export function mudarMes({ ano, mes }: MesDoCalendario, meses: number): MesDoCalendario {
  const total = ano * 12 + mes + meses;
  return { ano: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
}

export function isoDoDia(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export interface DiaDoCalendario {
  iso: string;
  dia: number;
  /** `false` nos dias dos meses vizinhos que completam a grade. */
  doMes: boolean;
}

/** Sempre 6 semanas (domingo a sábado), com os dias dos meses vizinhos nas pontas, para a altura não pular. */
export function semanasDoMes({ ano, mes }: MesDoCalendario): DiaDoCalendario[][] {
  const primeiro = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const semanas: DiaDoCalendario[][] = [];
  for (let s = 0; s < 6; s++) {
    semanas.push(
      Array.from({ length: 7 }, (_, d) => {
        const data = new Date(Date.UTC(ano, mes, 1 - primeiro + s * 7 + d));
        const a = data.getUTCFullYear();
        const m = data.getUTCMonth();
        return { iso: isoDoDia(a, m, data.getUTCDate()), dia: data.getUTCDate(), doMes: m === mes && a === ano };
      }),
    );
  }
  return semanas;
}
