import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { excluirLesao, listarLesoes } from '../api/rotas';
import type { Lesao } from '../api/tipos';
import {
  contagemDeLesoes, lesoesNaOrdem, observacaoLonga, periodoDaLesao, RECUPERADAS_VISIVEIS, seloDaLesao,
} from '../dominio/fichaDados';
import { SEM_DADO } from '../dominio/formatos';
import { useSessao } from '../sessao/SessaoProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { IconeBotao } from '../ui/IconeBotao';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo } from '../ui/Selo';
import { Tabela, type ColunaDaTabela } from '../ui/Tabela';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { FolhaDeAcoes } from './FolhaDeAcoes';
import { FolhaLesao } from './FolhaLesao';

/** As lesões do aluno, buscadas uma vez pela aba (as ativas do topo, no celular, e o histórico usam a mesma carga). */
export function useLesoes(alunoId: string | null) {
  return useCarregar(alunoId ? `lesoes:${alunoId}` : null, (chave) => listarLesoes(chave.slice('lesoes:'.length)));
}
type CargaDasLesoes = ReturnType<typeof useLesoes>;

/**
 * Histórico de lesões do aluno (dado sensível: só na tela, nunca em log; o sistema só guarda e mostra). Ficha › Dados
 * (23/11): cabeçalho com a contagem ("1 ativa · 3 no total") e "Registrar lesão"; tabela com Região, O que é (e os
 * cuidados no treino), Período, Situação e ⋯ (Editar, Excluir lesão com confirmação). As ativas vêm primeiro, tingidas de
 * `atencao` pela `tingida` da `ui/Tabela` (fundo liso `forte` e fio na cor, texto em `texto`); as recuperadas depois, neutras,
 * 5 à vista e "Ver todas". `parte`: `tudo` (PC); no celular as ativas sobem para o topo da aba (`ativas`, "Lesões ativas") e
 * o histórico embaixo fica com as recuperadas (`recuperadas`), para nenhuma aparecer duas vezes.
 */
export function CartaoLesoes({ alunoId, carga, parte = 'tudo' }: { alunoId: string; carga: CargaDasLesoes; parte?: 'tudo' | 'ativas' | 'recuperadas' }) {
  const { pode } = useSessao();
  const podeAlterar = pode('ALUNO_SENSIVEL_ALTERAR');
  const { dados, erro, carregando, recarregar } = carga;
  const [editando, setEditando] = useState<Lesao | 'nova' | null>(null);
  const [excluir, setExcluir] = useState<Lesao | null>(null);
  const [erroExcluir, setErroExcluir] = useState<unknown>(null);
  const [todas, setTodas] = useState(false);
  const { ativas, recuperadas } = lesoesNaOrdem(dados ?? []);

  const confirmarExclusao = () => {
    const alvo = excluir;
    setExcluir(null);
    if (!alvo) return;
    excluirLesao(alunoId, alvo.id).then(recarregar, (e: unknown) => setErroExcluir(e));
  };
  const acoesDaLinha = { podeAlterar, aoEditar: setEditando, aoExcluir: (l: Lesao) => { setErroExcluir(null); setExcluir(l); } };
  const folhas = (
    <>
      {editando ? (
        <FolhaLesao alunoId={alunoId} lesao={editando === 'nova' ? null : editando} aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); }} />
      ) : null}
      <PainelConfirmacao
        visivel={excluir !== null}
        titulo="Excluir este registro de lesão?"
        mensagem={excluir ? excluir.regiao : undefined}
        rotuloConfirmar="Excluir lesão"
        perigo
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluir(null)}
      />
    </>
  );

  // No topo da aba (celular): só com ativas; carregando, erro e vazio ficam com o histórico, embaixo.
  if (parte === 'ativas') {
    if (ativas.length === 0) return null;
    return (
      <Cartao titulo="Lesões ativas">
        {erroExcluir ? <MensagemErro texto={textoDoErro(erroExcluir)} /> : null}
        <TabelaDeLesoes ativas={ativas} recuperadas={[]} {...acoesDaLinha} />
        {folhas}
      </Cartao>
    );
  }

  const mostrarAtivas = parte === 'tudo' ? ativas : [];
  const recuperadasVisiveis = todas ? recuperadas : recuperadas.slice(0, RECUPERADAS_VISIVEIS);
  const contagem = dados ? contagemDeLesoes(dados) : null;
  return (
    <Cartao titulo="Histórico de lesões" descricao={contagem ?? undefined}
      acoes={podeAlterar ? <Botao rotulo="Registrar lesão" tipo="acao" Icone={Plus} aoTocar={() => setEditando('nova')} /> : undefined}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {erroExcluir ? <MensagemErro texto={textoDoErro(erroExcluir)} /> : null}
      {!dados && carregando ? <Esqueleto cartoes={1} texto="Carregando lesões" /> : null}
      {dados && dados.length === 0 ? <Texto variante="suave">Nenhuma lesão registrada.</Texto> : null}
      {mostrarAtivas.length + recuperadasVisiveis.length > 0 ? (
        <TabelaDeLesoes ativas={mostrarAtivas} recuperadas={recuperadasVisiveis} {...acoesDaLinha} />
      ) : dados && dados.length > 0 ? <Texto variante="suave">Nenhuma lesão recuperada.</Texto> : null}
      {recuperadas.length > RECUPERADAS_VISIVEIS ? (
        <View style={estilos.verTodas}>
          <Botao rotulo={todas ? 'Ver menos' : `Ver todas as recuperadas (${recuperadas.length})`} tipo="fantasma" aoTocar={() => setTodas((v) => !v)} />
        </View>
      ) : null}
      {folhas}
    </Cartao>
  );
}

/** A partir desta largura (medida na própria tabela) as lesões ficam em colunas; abaixo, uma por cartão com os rótulos à vista. */
const LARGURA_EM_COLUNAS = 800;

interface AcoesDaLinha { podeAlterar: boolean; aoEditar: (l: Lesao) => void; aoExcluir: (l: Lesao) => void }

/**
 * Tabela das lesões na `ui/Tabela` (cabeçalho e colunas quando cabe, cartões empilhados abaixo disso). A ativa é a linha
 * `tingida` da peça: fundo e fio de `atencao`, sem borda própria que dobre a da caixa (24/11, "ficha: tabela com linha tingida").
 */
function TabelaDeLesoes({ ativas, recuperadas, ...acoes }: { ativas: Lesao[]; recuperadas: Lesao[] } & AcoesDaLinha) {
  const colunas: ColunaDaTabela<Lesao>[] = [
    { chave: 'regiao', titulo: 'Região', principal: true, flex: 2, minimo: 120, render: (l) => <Texto variante="subtitulo">{l.regiao}</Texto> },
    {
      chave: 'descricao', titulo: 'O que é', flex: 3, minimo: 160,
      render: (l) => (
        <View style={estilos.celula}>
          <Texto variante={l.descricao ? 'corpo' : 'suave'}>{l.descricao || SEM_DADO}</Texto>
          {l.observacao ? <Observacao texto={l.observacao} /> : null}
        </View>
      ),
    },
    // 232: cabe "01/03/2026 a 15/05/2026" numa linha (Geist Mono).
    { chave: 'periodo', titulo: 'Período', flex: 2, minimo: 232, render: (l) => <Texto numerico>{periodoDaLesao(l)}</Texto> },
    {
      chave: 'situacao', titulo: 'Situação', largura: 140,
      render: (l) => { const selo = seloDaLesao(l.situacao); return <View style={estilos.selo}><Selo texto={selo.texto} tipo={selo.tipo} /></View>; },
    },
    { chave: 'acoes', titulo: 'Ações', acao: true, largura: 44, render: (l) => <View style={estilos.maisNoTopo}><MaisAcoes lesao={l} {...acoes} /></View> },
  ];
  return (
    <Tabela rotulo="Lesões" colunas={colunas} linhas={[...ativas, ...recuperadas]} chave={(l) => l.id} larguraMinima={LARGURA_EM_COLUNAS}
      vao={espaco(2)} alinharLinhas="topo" tingida={(l) => ativas.includes(l)} />
  );
}

/** "Cuidados no treino: …" em até duas linhas; a longa ganha "Ver observação inteira" (o leitor de tela sempre ouve o texto todo). */
function Observacao({ texto }: { texto: string }) {
  const [inteira, setInteira] = useState(false);
  const longa = observacaoLonga(texto);
  return (
    <View style={estilos.observacao}>
      <Texto variante="pequeno" numberOfLines={longa && !inteira ? 2 : undefined} accessibilityLabel={`Cuidados no treino: ${texto}`}>
        <Texto variante="pequeno" style={estilos.rotuloDaObservacao}>Cuidados no treino: </Texto>{texto}
      </Texto>
      {longa ? (
        <View style={estilos.verObservacao}>
          <Botao rotulo={inteira ? 'Ver menos' : 'Ver observação inteira'} tipo="fantasma" aoTocar={() => setInteira((v) => !v)} />
        </View>
      ) : null}
    </View>
  );
}

/** ⋯ da lesão (Editar, Excluir lesão), só com `ALUNO_SENSIVEL_ALTERAR`. No celular, o que abre depois espera o menu fechar. */
function MaisAcoes({ lesao, podeAlterar, aoEditar, aoExcluir }: { lesao: Lesao } & AcoesDaLinha) {
  const [menu, setMenu] = useState(false);
  if (!podeAlterar) return null;
  const depois = (f: () => void) => (Platform.OS === 'web' ? f() : setTimeout(f, 350));
  return (
    <>
      <IconeBotao Icone={Ellipsis} rotulo={`Mais ações da lesão em ${lesao.regiao}`} aoTocar={() => setMenu(true)} />
      {menu ? (
        <FolhaDeAcoes titulo={lesao.regiao} aoFechar={() => setMenu(false)} acoes={[
          { rotulo: 'Editar', Icone: Pencil, aoTocar: () => depois(() => aoEditar(lesao)) },
          { rotulo: 'Excluir lesão', Icone: Trash2, perigo: true, aoTocar: () => depois(() => aoExcluir(lesao)) },
        ]} />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  verTodas: { flexDirection: 'row' },
  // O ⋯ (44) no meio da primeira linha de texto (22), como o selo, e não no meio da linha de duas alturas.
  maisNoTopo: { marginVertical: -(ALVO_TOQUE - 22) / 2 },
  celula: { gap: espaco(0.5), alignItems: 'flex-start' },
  selo: { flexDirection: 'row' },
  observacao: { gap: espaco(0.25), alignItems: 'flex-start' },
  rotuloDaObservacao: { fontFamily: fontes.semi },
  verObservacao: { marginLeft: -espaco(1.5) },
});
