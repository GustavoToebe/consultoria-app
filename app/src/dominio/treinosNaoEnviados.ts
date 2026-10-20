import type { RegistroLocal, RegistroMobilidadeLocal } from '../offline/repositorioLocal';

/**
 * Treinos (dia + sessão) com ao menos um registro ainda não enviado: LOCAL (na fila) ou FALHOU (recusado, esperando
 * "tentar de novo"). É o que "Sair" apagaria; o aviso fala em treinos porque é o que o aluno reconhece, não em séries.
 */
export function treinosNaoEnviados(registros: readonly Pick<RegistroLocal, 'situacao' | 'data' | 'sessaoUid'>[]): number {
  const treinos = new Set<string>();
  for (const r of registros) {
    if (r.situacao !== 'ENVIADO') treinos.add(`${r.data}|${r.sessaoUid}`);
  }
  return treinos.size;
}

/** Dias com algum item de mobilidade ainda não enviado (LOCAL ou FALHOU): o que "Sair" também apagaria. */
export function diasDeMobilidadeNaoEnviados(marcas: readonly Pick<RegistroMobilidadeLocal, 'situacao' | 'data'>[]): number {
  return new Set(marcas.filter((m) => m.situacao !== 'ENVIADO').map((m) => m.data)).size;
}

/**
 * "1 treino", "3 treinos e mobilidade de 2 dias"... e a concordância do que vem depois. Só mobilidade fala no feminino
 * singular ("mobilidade de 2 dias ainda não enviada"). Sem nada para contar, `null`.
 */
export function descreverNaoEnviados(
  treinos: number,
  diasDeMobilidade = 0,
): { texto: string; enviado: string; esse: string; ele: string; sera: string } | null {
  if (treinos <= 0 && diasDeMobilidade <= 0) return null;
  const partes = [
    treinos > 0 ? (treinos === 1 ? '1 treino' : `${treinos} treinos`) : null,
    diasDeMobilidade > 0 ? `mobilidade de ${diasDeMobilidade === 1 ? '1 dia' : `${diasDeMobilidade} dias`}` : null,
  ].filter((p): p is string => p !== null);
  const soMobilidade = treinos <= 0;
  const singular = soMobilidade || (treinos === 1 && diasDeMobilidade <= 0);
  const registros = treinos + diasDeMobilidade;
  return {
    texto: partes.join(' e '),
    enviado: singular ? (soMobilidade ? 'enviada' : 'enviado') : 'enviados',
    esse: registros === 1 ? 'esse registro' : 'esses registros',
    ele: singular ? (soMobilidade ? 'ela' : 'ele') : 'eles',
    sera: singular ? (soMobilidade ? 'será apagada' : 'será apagado') : 'serão apagados',
  };
}

/** Texto do painel "Sair da conta?" do aluno; sem treino nem mobilidade pendente não há aviso. */
export function avisoAoSairComPendencias(treinos: number, diasDeMobilidade = 0): string | null {
  const d = descreverNaoEnviados(treinos, diasDeMobilidade);
  if (!d) return null;
  return `Você tem ${d.texto} ainda não ${d.enviado}. Sair apaga ${d.esse}. Conecte-se e sincronize antes, se puder.`;
}
