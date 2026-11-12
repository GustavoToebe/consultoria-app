import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, CircleAlert, TriangleAlert } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { atualizacaoDoAluno } from '../api/rotas';
import type { AlunoDetalhe, PastaResumo } from '../api/tipos';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../dominio/atualizacao';
import { periodoCurto } from '../dominio/datasRelativas';
import type { AbaDaFicha } from '../dominio/fichaDoAluno';
import { hojeIso } from '../dominio/formatos';
import { pastaSoComRascunho } from '../dominio/pastaEmRascunho';
import { periodoDaSemana } from '../dominio/progressoSemana';
import { planosDaPasta } from '../dominio/publicarPasta';
import { planejamentoDoResumo, proximoPassoDoAluno, treinosDoResumo, type SituacaoDaFonte } from '../dominio/resumoDoAluno';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { CampoLeitura } from '../ui/CampoLeitura';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { AtividadeRecente } from './AtividadeRecente';
import type { useAcompanhamentoDoAluno } from './CartaoFrequencia';
import { AvisoDeLesoesNoResumo, UltimaMedicao } from './PesoELesoesNoResumo';
import { usePlanosDaPasta, type CargaDosPlanos } from './usePlanosDaPasta';

/**
 * Aba Resumo da ficha (guia de 11/11, págs. 30 a 32), na ordem de quem decide: o próximo passo com a ação direta e os
 * fatos curtos (atualização, treinos com o período, último registro com o escopo); depois o Planejamento e a Última
 * medição, lado a lado no PC; por fim o histórico recente. Vazio é linha de apoio, não cartão. Os atalhos só levam a
 * fluxos que já existem (aba Ficha no Acesso ao app, pasta ou aba Planos, aba Evolução): nada é enviado, renovado ou
 * publicado daqui. Carregando, erro, sem permissão e sem registro têm apresentações próprias, e o próximo passo nunca diz
 * "Tudo em dia" sem as fontes.
 */
export function ResumoDoAluno({ aluno, acompanhamento, abas, aoRenovar, aoAbrirAba, aoAbrirAcesso, aoAbrirPasta }: {
  aluno: AlunoDetalhe;
  acompanhamento: ReturnType<typeof useAcompanhamentoDoAluno>;
  /** Abas que a pessoa vê: o atalho para uma aba escondida não aparece. */
  abas: readonly AbaDaFicha[];
  /** Abre a confirmação de "Renovar" (a mesma da lista de pastas). */
  aoRenovar: (pasta: PastaResumo) => void;
  aoAbrirAba: (aba: AbaDaFicha) => void;
  /** Aba Ficha do aluno, no bloco Acesso ao app. */
  aoAbrirAcesso: () => void;
  /** Abre a pasta na aba Planos (a mesma Folha da lista). */
  aoAbrirPasta: (pastaId: string) => void;
}) {
  const { pode, temFuncionalidade } = useSessao();
  const { confirmar } = useSaidaGuardada();
  const { cores } = useTema();
  const hoje = hojeIso();
  const verAtualizacao = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  const sensivel = pode('ALUNO_SENSIVEL_LER');
  const atual = useCarregar(verAtualizacao ? `resumo-atualizacao:${aluno.id}` : null, () => atualizacaoDoAluno(aluno.id));
  const recarregarAtual = atual.recarregar;
  // Voltando da revisão, o selo e o próximo passo já mudam.
  useFocusEffect(useCallback(() => { recarregarAtual(); }, [recarregarAtual]));
  const a = atual.dados?.alunoId === aluno.id && atual.dados.dataAtualizacao ? atual.dados : null;
  const dados = acompanhamento.dados;
  const fonteAtualizacao: SituacaoDaFonte = !verAtualizacao ? 'sem-permissao' : atual.dados !== undefined ? 'ok' : atual.erro ? 'erro' : 'carregando';
  const fontePastas = dados ? 'ok' : acompanhamento.erro ? 'erro' : 'carregando';
  const passo = proximoPassoDoAluno({
    aluno, atualizacao: a, pasta: dados?.pasta ?? null, pastas: dados?.pastas ?? [], hoje,
    fontes: { atualizacao: fonteAtualizacao, pastas: fontePastas },
  });
  const pasta = dados?.pasta ?? null;
  const selo = a ? statusAtualizacaoTreinador(a, hoje) : null;
  const f = dados?.frequencia ?? null;
  const treinos = f ? treinosDoResumo(f, periodoDaSemana(hoje).inicio, hoje) : null;
  // Sem pasta vigente, as listas de planos (as mesmas rotas e permissões da aba Planos) dizem qual pasta aberta só tem
  // rascunho. Lista que falhou, não chegou ou que a pessoa não lê deixa a pasta como "aberta".
  const abertas = dados && !pasta ? dados.pastas.filter((p) => !p.concluidaEm) : [];
  const { cargas } = usePlanosDaPasta(aluno.id, abertas[0]?.id ?? null, 0);
  const lista = (c: CargaDosPlanos) => (c.erro ? null : c.dados ?? null);
  const listas = { treino: lista(cargas.treino), dieta: lista(cargas.dieta), mobilidade: lista(cargas.mobilidade) };
  const rascunhos = new Set(abertas.filter((p) => pastaSoComRascunho(planosDaPasta(p.id, listas, temFuncionalidade('MOBILIDADE')))).map((p) => p.id));
  const planejamento = dados ? planejamentoDoResumo(pasta, dados.pastas, rascunhos) : null;
  const falhou = fonteAtualizacao === 'erro' || fontePastas === 'erro';

  const tentarDeNovo = () => { if (fonteAtualizacao === 'erro') atual.recarregar(); if (fontePastas === 'erro') acompanhamento.recarregar(); };
  const acao = passo.acao === 'revisar' && a && pode('ATUALIZACAO_LER')
    ? <Botao rotulo="Revisar atualização" aoTocar={() => confirmar(() => router.push(caminhoAtualizacaoTreinador(a)))} />
    : passo.acao === 'renovar' && pasta && pode('PASTA_ALTERAR')
      ? <Botao rotulo="Renovar pasta" aoTocar={() => aoRenovar(pasta)} />
      // Sem `ALUNO_CONVITE` o bloco do acesso não tem ação: a frase fica, o atalho não.
      : passo.acao === 'acesso' && abas.includes('ficha') && pode('ALUNO_CONVITE')
        ? <Botao rotulo="Abrir acesso ao app" aoTocar={aoAbrirAcesso} />
        : !passo.acao && falhou ? <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={tentarDeNovo} /> : null;
  // Âmbar e vermelho com ícone (a cor nunca fala sozinha); neutro, só o texto.
  const IconeDoPasso = passo.tipo === 'perigo' ? TriangleAlert : passo.tipo === 'atencao' ? CircleAlert : null;
  const corDoPasso = passo.tipo === 'perigo' ? cores.perigo : cores.atencao;

  const saiu = aluno.anonimizado || !aluno.ativo;
  const temFatos = saiu || verAtualizacao || !!treinos;
  return (
    <View style={estilos.resumo}>
      <Cartao titulo="Próximo passo">
        {passo.carregando ? <Esqueleto cartoes={1} texto={passo.texto} /> : (
          <View style={estilos.passo}>
            <View style={estilos.passoTexto}>
              {IconeDoPasso ? <IconeDoPasso size={20} color={corDoPasso} strokeWidth={2} aria-hidden /> : null}
              <Texto style={estilos.frase}>{passo.texto}</Texto>
            </View>
            {acao}
          </View>
        )}
        {temFatos ? (
          <View style={[estilos.fatos, { borderTopColor: cores.divisor }]}>
            {saiu ? (
              <View style={estilos.fato}>
                <Texto variante="rotulo">Situação</Texto>
                <Selo texto={aluno.anonimizado ? 'Anonimizado' : 'Inativo'} tipo="neutro" />
              </View>
            ) : null}
            {verAtualizacao ? (
              <View style={estilos.fato} accessibilityLabel={`Atualização: ${selo?.curto ?? (fonteAtualizacao === 'ok' ? 'nenhuma' : fonteAtualizacao === 'erro' ? 'indisponível' : 'carregando')}`}>
                <Texto variante="rotulo">Atualização</Texto>
                {selo ? <Selo texto={selo.curto} tipo={selo.tipo} />
                  : <Texto variante={fonteAtualizacao === 'ok' ? undefined : 'suave'}>{fonteAtualizacao === 'ok' ? '—' : fonteAtualizacao === 'erro' ? 'Indisponível' : 'Carregando…'}</Texto>}
              </View>
            ) : null}
            {treinos && 'contagem' in treinos ? (
              <>
                <CampoLeitura rotulo="Treinos registrados" valor={treinos.contagem} numerico />
                <CampoLeitura rotulo="Último registro" valor={treinos.ultimo} numerico />
              </>
            ) : null}
            {treinos && 'apoio' in treinos ? <Texto variante="suave" style={estilos.apoio}>{treinos.apoio}</Texto> : null}
          </View>
        ) : null}
      </Cartao>

      {/* Planejamento e medição lado a lado no PC; no celular, um embaixo do outro (a ordem de leitura é a mesma). */}
      <View style={estilos.linha}>
        <Cartao titulo="Planejamento" style={estilos.bloco}>
          {acompanhamento.erro && !dados ? <MensagemErro texto={textoDoErro(acompanhamento.erro)} erro={acompanhamento.erro} tentarDeNovo={acompanhamento.recarregar} /> : null}
          {!dados && !acompanhamento.erro ? <Esqueleto cartoes={1} texto="Carregando as pastas" /> : null}
          {planejamento ? (
            <View style={estilos.planejamento}>
              <Texto variante="rotulo">{planejamento.titulo}</Texto>
              {planejamento.vigente ? (
                <>
                  <Texto variante="bloco">{planejamento.vigente.titulo}</Texto>
                  <View style={estilos.periodo}>
                    <Texto variante="suave" numerico>{periodoCurto(planejamento.vigente.inicio, planejamento.vigente.fim, hoje)}</Texto>
                    {/* "Pasta vencida" fica junto da pasta (guia de 11/11, pág. 13): o período já passou e ela não foi finalizada. */}
                    {planejamento.vigente.fim && planejamento.vigente.fim < hoje && !planejamento.vigente.concluidaEm ? <Selo texto="Pasta vencida" tipo="perigo" /> : null}
                  </View>
                </>
              ) : planejamento.linha ? <Texto>{planejamento.linha}</Texto> : null}
              {planejamento.atalho && abas.includes('planos') ? (
                <View style={estilos.atalho}>
                  <Botao rotulo={planejamento.atalho.rotulo} tipo="fantasma" Icone={ChevronRight} aoTocar={() => {
                    const atalho = planejamento.atalho;
                    if (atalho && 'pastaId' in atalho) confirmar(() => aoAbrirPasta(atalho.pastaId));
                    else aoAbrirAba('planos');
                  }} />
                </View>
              ) : null}
            </View>
          ) : null}
        </Cartao>
        {sensivel ? <UltimaMedicao alunoId={aluno.id} aoVerEvolucao={abas.includes('evolucao') ? () => aoAbrirAba('evolucao') : null} /> : null}
      </View>

      {sensivel ? <AvisoDeLesoesNoResumo alunoId={aluno.id} aoVerLesoes={() => aoAbrirAba('ficha')} /> : null}
      <AtividadeRecente alunoId={aluno.id} aoAbrirPasta={(p) => confirmar(() => aoAbrirPasta(p))} />
    </View>
  );
}

const estilos = StyleSheet.create({
  resumo: { gap: espaco(3) },
  passo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  passoTexto: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1), flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  frase: { flexShrink: 1 },
  fatos: {
    flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(4), rowGap: espaco(1.5),
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espaco(2),
  },
  fato: { gap: espaco(0.25) },
  apoio: { alignSelf: 'flex-end' },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(3), alignItems: 'stretch' },
  bloco: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  planejamento: { gap: espaco(0.5), flexGrow: 1 },
  periodo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  atalho: { flexDirection: 'row', marginTop: 'auto', paddingTop: espaco(1) },
});
