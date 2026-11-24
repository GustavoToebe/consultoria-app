import { StyleSheet, View } from 'react-native';

import type { ContratacaoResponse } from '../../api/financeiroTipos';
import { listarContratacoesDoAluno, resumoDaSaidaDoAluno } from '../../api/rotas';
import { linhasDoPainelDeInativar, type travaDoInativar } from '../../dominio/saidaDoPlano';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * O resumo do painel de inativar (`resumoDaSaidaDoAluno`): só com o painel aberto (`aberto`; chave nula fechado, então busca a
 * cada abertura), o financeiro ligado e `FINANCEIRO_LER`. Fica com quem monta o painel: o `contratoFechadoVigente` dele trava
 * o botão de inativar (`travaDoInativar`).
 */
export function useResumoDoInativar(alunoId: string, aberto: boolean) {
  const { pode, pagamentosHabilitados } = useSessao();
  const podeLerFinanceiro = pode('FINANCEIRO_LER');
  const resumo = useCarregar(aberto && podeLerFinanceiro && pagamentosHabilitados ? `resumo-da-saida:${alunoId}` : null, () => resumoDaSaidaDoAluno(alunoId));
  return { ...resumo, contexto: { podeLerFinanceiro, financeiroLigado: pagamentosHabilitados } };
}

type Trava = NonNullable<ReturnType<typeof travaDoInativar>>;

/**
 * O que inativar faz com as cobranças do aluno, no painel de inativar da ficha. Sem o resumo (sem permissão, financeiro
 * desligado ou a busca falhou) fica o texto genérico, sem valores; nada em aberto e sem mínimo = nenhuma linha. Com contrato
 * fechado vigente (`trava`, D13 de `docs/planos/contrato-fechado.md`) as linhas dão lugar ao aviso âmbar e, com
 * `FINANCEIRO_ALTERAR`, ao "Encerrar contrato", que entrega a contratação a quem abre a `FolhaDeEncerrar`.
 */
export function AvisoDoInativar({ alunoId, resumo, trava, aoEncerrar }: {
  alunoId: string;
  resumo: ReturnType<typeof useResumoDoInativar>;
  trava: Trava | null;
  aoEncerrar: (contratacao: ContratacaoResponse) => void;
}) {
  const linhas = linhasDoPainelDeInativar(resumo.dados, resumo.contexto);
  let conteudo = null;
  if (trava) conteudo = <TravaDoContrato alunoId={alunoId} trava={trava} aoEncerrar={aoEncerrar} />;
  else if (resumo.carregando && !resumo.dados) conteudo = <Esqueleto />;
  else if (linhas.length > 0) conteudo = linhas.map((l) => <Texto key={l} variante="suave">{l}</Texto>);
  // A mesma raiz nos três casos: o 409 que troca as linhas pelo aviso é anunciado pela região viva.
  return conteudo ? <View style={estilos.bloco} accessibilityLiveRegion="polite">{conteudo}</View> : null;
}

/** A contratação vem da mesma rota do cartão Plano contratado (a folha precisa da versão e do bloco `contrato`). */
function TravaDoContrato({ alunoId, trava, aoEncerrar }: { alunoId: string; trava: Trava; aoEncerrar: (contratacao: ContratacaoResponse) => void }) {
  const { pode } = useSessao();
  const podeEncerrar = !!trava.contratacaoId && pode('FINANCEIRO_ALTERAR');
  const contratacoes = useCarregar(podeEncerrar ? `contratacoes:${alunoId}` : null, () => listarContratacoesDoAluno(alunoId));
  // A encerrada (o resumo ainda velho, logo depois de encerrar) não é oferecida de novo.
  const contratacao = contratacoes.dados?.find((c) => c.id === trava.contratacaoId && c.situacao !== 'ENCERRADA') ?? null;
  let acao = null;
  if (podeEncerrar && contratacao) acao = <Botao rotulo="Encerrar contrato" tipo="secundario" aoTocar={() => aoEncerrar(contratacao)} />;
  else if (podeEncerrar && contratacoes.erro) acao = <MensagemErro texto={textoDoErro(contratacoes.erro)} erro={contratacoes.erro} tentarDeNovo={contratacoes.recarregar} />;
  else if (podeEncerrar && !contratacoes.dados) acao = <Botao rotulo="Encerrar contrato" tipo="secundario" carregando aoTocar={() => undefined} />;
  return <Alerta tom="atencao" texto={trava.aviso}>{acao ? <View style={estilos.acao}>{acao}</View> : null}</Alerta>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(0.75) },
  acao: { alignItems: 'flex-start', marginTop: espaco(0.5) },
});
