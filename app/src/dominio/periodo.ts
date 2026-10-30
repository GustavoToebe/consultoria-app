import { dataDaTela, dataParaTela, somarDias } from './formatos';

/**
 * Período sugerido para uma pasta nova: começa em `hoje` e dura `dias` dias contando o primeiro (15/02 + 30 dias =
 * 16/03). Sem prazo no cadastro do aluno, só o início vem preenchido.
 */
export function periodoInicial(hoje: string, dias: number | null | undefined): { inicio: string; fim: string } {
  const inicio = dataParaTela(hoje);
  if (!dias || dias < 1) return { inicio, fim: '' };
  return { inicio, fim: dataParaTela(somarDias(hoje, dias - 1)) };
}

/** Quantos dias o período tem, contando o primeiro e o último (01/11 a 15/11 = 15); nulo se faltar data ou o fim vier antes. */
export function diasDoPeriodo(inicio: string, fim: string): number | null {
  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  if (!ini || !fi || fi < ini) return null;
  return Math.round((Date.parse(fi) - Date.parse(ini)) / 86_400_000) + 1;
}

/**
 * Fim que acompanha o início enquanto o treinador não editou o fim à mão (reunião de 29/10, A05): início + dias - 1.
 * Início incompleto ou inválido devolve nulo, e o fim que já estava na tela fica.
 */
export function fimQueAcompanha(inicio: string, dias: number | null): string | null {
  const ini = dataDaTela(inicio);
  if (!ini || !dias || dias < 1) return null;
  return dataParaTela(somarDias(ini, dias - 1));
}

/** Próximo ciclo: começa no dia seguinte ao fim do plano e dura o mesmo tanto (tudo editável). */
export function proximoPeriodo(p: { inicio: string | null; fim: string | null }): { inicio: string; fim: string } {
  if (!p.fim) return { inicio: '', fim: '' };
  const inicio = somarDias(p.fim, 1);
  if (!p.inicio) return { inicio: dataParaTela(inicio), fim: '' };
  const dias = Math.round((Date.parse(p.fim) - Date.parse(p.inicio)) / 86_400_000);
  return { inicio: dataParaTela(inicio), fim: dataParaTela(somarDias(inicio, dias)) };
}

/**
 * "Renovar pasta": o que o app manda a `POST /pastas/{id}/replicar` sem abrir formulário. O período segue o de
 * `proximoPeriodo`; pasta sem fim usa o ciclo do aluno a partir de hoje (como a pasta nova). O título leva "(renovada)"
 * para não repetir o da origem na lista. `texto` é o período como aparece na confirmação.
 */
export function dadosDaRenovacao(
  pasta: { titulo: string; inicio: string | null; fim: string | null },
  hoje: string,
  diasAtualizacao: number | null | undefined,
): { titulo: string; inicio: string | null; fim: string | null; texto: string } {
  const sugestao = pasta.fim ? proximoPeriodo(pasta) : periodoInicial(hoje, diasAtualizacao);
  const inicio = dataDaTela(sugestao.inicio) ?? null;
  const fim = dataDaTela(sugestao.fim) ?? null;
  const texto = inicio && fim ? `${sugestao.inicio} a ${sugestao.fim}` : inicio ? `a partir de ${sugestao.inicio}` : 'sem período definido';
  return { titulo: `${pasta.titulo} (renovada)`.slice(0, 120), inicio, fim, texto };
}

/**
 * Ciclo de atualização que vale para o aluno: o dele; sem valor próprio, o padrão da consultoria (pedido do Saraiva em
 * 17/10, para não repetir o mesmo número em cada cadastro); sem nenhum, nulo.
 */
export function cicloDoAluno(doAluno: number | null | undefined, padraoDaConsultoria: number | null | undefined): number | null {
  return doAluno ?? padraoDaConsultoria ?? null;
}

/** "15 dias", "20 dias (padrão da consultoria)" ou nulo ("—" na ficha). */
export function textoDoCiclo(doAluno: number | null | undefined, padraoDaConsultoria: number | null | undefined): string | null {
  if (doAluno) return `${doAluno} dias`;
  if (padraoDaConsultoria) return `${padraoDaConsultoria} dias (padrão da consultoria)`;
  return null;
}
