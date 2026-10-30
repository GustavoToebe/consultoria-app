import type { RegistroAguaLocal, RegistroLocal, RegistroMobilidadeLocal, RegistroSessaoConcluidaLocal } from '../offline/repositorioLocal';

/**
 * Treinos (dia + sessão) com ao menos um registro ainda não enviado: LOCAL (na fila) ou FALHOU (recusado, esperando
 * "tentar de novo"). É o que "Sair" apagaria; o aviso fala em treinos porque é o que o aluno reconhece, não em séries.
 * A conclusão do treino ainda não enviada conta no mesmo treino (dia + sessão): sem série pendente ela também é um
 * treino não enviado, e com série pendente do mesmo dia e sessão não conta duas vezes.
 */
export function treinosNaoEnviados(
  registros: readonly Pick<RegistroLocal, 'situacao' | 'data' | 'sessaoUid'>[],
  conclusoes: readonly Pick<RegistroSessaoConcluidaLocal, 'situacao' | 'data' | 'sessaoUid'>[] = [],
): number {
  const treinos = new Set<string>();
  for (const r of [...registros, ...conclusoes]) {
    if (r.situacao !== 'ENVIADO') treinos.add(`${r.data}|${r.sessaoUid}`);
  }
  return treinos.size;
}

/** Dias com algum item de mobilidade ainda não enviado (LOCAL ou FALHOU): o que "Sair" também apagaria. */
export function diasDeMobilidadeNaoEnviados(marcas: readonly Pick<RegistroMobilidadeLocal, 'situacao' | 'data'>[]): number {
  return new Set(marcas.filter((m) => m.situacao !== 'ENVIADO').map((m) => m.data)).size;
}

/** Dias com água ainda não enviada (LOCAL ou FALHOU): o que "Sair" também apagaria. */
export function diasDeAguaNaoEnviados(agua: readonly Pick<RegistroAguaLocal, 'situacao' | 'data'>[]): number {
  return new Set(agua.filter((a) => a.situacao !== 'ENVIADO').map((a) => a.data)).size;
}

const dias = (n: number) => (n === 1 ? '1 dia' : `${n} dias`);

/**
 * "1 treino", "3 treinos e mobilidade de 2 dias", "mobilidade de 1 dia e água de 2 dias"... e a concordância do que vem
 * depois. Mobilidade e água falam no feminino ("água de 2 dias ainda não enviada"); com treino, masculino plural. Sem nada
 * para contar, `null`.
 */
export function descreverNaoEnviados(
  treinos: number,
  diasDeMobilidade = 0,
  diasDeAgua = 0,
): { texto: string; enviado: string; esse: string; ele: string; sera: string } | null {
  if (treinos <= 0 && diasDeMobilidade <= 0 && diasDeAgua <= 0) return null;
  const partes = [
    treinos > 0 ? (treinos === 1 ? '1 treino' : `${treinos} treinos`) : null,
    diasDeMobilidade > 0 ? `mobilidade de ${dias(diasDeMobilidade)}` : null,
    diasDeAgua > 0 ? `água de ${dias(diasDeAgua)}` : null,
  ].filter((p): p is string => p !== null);
  const soFeminino = treinos <= 0;
  const femininas = (diasDeMobilidade > 0 ? 1 : 0) + (diasDeAgua > 0 ? 1 : 0);
  const singular = (soFeminino && femininas === 1) || (treinos === 1 && femininas === 0);
  const registros = treinos + diasDeMobilidade + diasDeAgua;
  return {
    texto: partes.length > 2 ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}` : partes.join(' e '),
    enviado: singular ? (soFeminino ? 'enviada' : 'enviado') : soFeminino ? 'enviadas' : 'enviados',
    esse: registros === 1 ? 'esse registro' : 'esses registros',
    ele: singular ? (soFeminino ? 'ela' : 'ele') : soFeminino ? 'elas' : 'eles',
    sera: singular ? (soFeminino ? 'será apagada' : 'será apagado') : soFeminino ? 'serão apagadas' : 'serão apagados',
  };
}

/** Texto do painel "Sair da conta?" do aluno; sem treino, mobilidade nem água pendente não há aviso. */
export function avisoAoSairComPendencias(treinos: number, diasDeMobilidade = 0, diasDeAgua = 0): string | null {
  const d = descreverNaoEnviados(treinos, diasDeMobilidade, diasDeAgua);
  if (!d) return null;
  return `Você tem ${d.texto} ainda não ${d.enviado}. Sair apaga ${d.esse}. Conecte-se e sincronize antes, se puder.`;
}
