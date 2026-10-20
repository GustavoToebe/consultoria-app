import { dataCurta, dataParaTela, hojeIso, SEM_DADO } from './formatos';

/**
 * Datas perto de hoje nas listas de acompanhamento (padrão das telas, 19/10): "hoje", "amanhã", "ontem", "em 3 dias",
 * "há 3 dias"; mais longe, a data curta, sem o ano quando é o ano corrente. O detalhe continua com a data completa.
 * Dias de calendário (sem hora nem horário de verão), como `faseAtualizacao`.
 */
const DIAS_PERTO = 7;

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86_400_000);

/** "19/10" no ano corrente; "19/10/2025" em outro ano. */
export function dataSemAnoCorrente(iso: string | null | undefined, hoje: string = hojeIso()): string {
  if (!iso) return SEM_DADO;
  return iso.slice(0, 4) === hoje.slice(0, 4) ? dataCurta(iso) : dataParaTela(iso);
}

/** "hoje", "amanhã", "ontem", "em 3 dias", "há 3 dias" ou a data curta. Ausente = "—". */
export function dataRelativa(iso: string | null | undefined, hoje: string = hojeIso()): string {
  if (!iso) return SEM_DADO;
  const d = diasEntre(hoje, iso);
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d === -1) return 'ontem';
  if (d > 1 && d <= DIAS_PERTO) return `em ${d} dias`;
  if (d < -1 && d >= -DIAS_PERTO) return `há ${-d} dias`;
  return dataSemAnoCorrente(iso, hoje);
}

/** Primeira letra maiúscula: "Hoje", "Em 3 dias" (começo de frase ou de selo). */
export const comMaiuscula = (texto: string) => (texto ? texto[0].toUpperCase() + texto.slice(1) : texto);

/** "20/09 a 19/10" no ano corrente; com ano quando alguma das pontas é de outro ano. Sem período = "Sem período". */
export function periodoCurto(inicio: string | null, fim: string | null, hoje: string = hojeIso()): string {
  if (!inicio && !fim) return 'Sem período';
  const ano = hoje.slice(0, 4);
  const comAno = (inicio && inicio.slice(0, 4) !== ano) || (fim && fim.slice(0, 4) !== ano);
  const texto = (iso: string | null) => (!iso ? SEM_DADO : comAno ? dataParaTela(iso) : dataCurta(iso));
  return `${texto(inicio)} a ${texto(fim)}`;
}

/** Instante de entrada numa lista: "Hoje, 18:47", "Ontem, 09:05", senão "17/10 18:47" (ano só se for outro). */
export function instanteRelativo(instante: string | null | undefined, agora: Date = new Date()): string {
  if (!instante) return SEM_DADO;
  const data = new Date(instante);
  if (Number.isNaN(data.getTime())) return SEM_DADO;
  const dia = hojeIso(data);
  const hoje = hojeIso(agora);
  const hora = `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
  const d = diasEntre(hoje, dia);
  if (d === 0) return `Hoje, ${hora}`;
  if (d === -1) return `Ontem, ${hora}`;
  return `${dataSemAnoCorrente(dia, hoje)} ${hora}`;
}
