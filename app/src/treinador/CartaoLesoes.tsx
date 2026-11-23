import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { alterarLesao, excluirLesao, listarLesoes, registrarLesao } from '../api/rotas';
import type { Lesao, SituacaoLesao } from '../api/tipos';
import { dataDaTelaNaFaixa } from '../dominio/datasValidas';
import {
  contagemDeLesoes, lesoesNaOrdem, observacaoLonga, periodoDaLesao, RECUPERADAS_VISIVEIS, seloDaLesao,
} from '../dominio/fichaDados';
import { dataParaTela, SEM_DADO } from '../dominio/formatos';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { ParDeDatas } from '../ui/CamposEmLinha';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { IconeBotao } from '../ui/IconeBotao';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo } from '../ui/Selo';
import { superficiePintada } from '../ui/superficiePintada';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { FolhaDeAcoes } from './FolhaDeAcoes';

const SITUACOES: { valor: SituacaoLesao; rotulo: string }[] = [
  { valor: 'ATIVA', rotulo: 'Ativa' },
  { valor: 'EM_RECUPERACAO', rotulo: 'Em recuperação' },
  { valor: 'RECUPERADA', rotulo: 'Recuperada' },
];

/** As lesões do aluno, buscadas uma vez pela aba (as ativas do topo, no celular, e o histórico usam a mesma carga). */
export function useLesoes(alunoId: string | null) {
  return useCarregar(alunoId ? `lesoes:${alunoId}` : null, (chave) => listarLesoes(chave.slice('lesoes:'.length)));
}
type CargaDasLesoes = ReturnType<typeof useLesoes>;

/**
 * Histórico de lesões do aluno (dado sensível: só na tela, nunca em log; o sistema só guarda e mostra). Ficha › Dados
 * (23/11): cabeçalho com a contagem ("1 ativa · 3 no total") e "Registrar lesão"; tabela com Região, Descrição (e a
 * observação), Período, Situação e ⋯ (Editar, Excluir lesão com confirmação). As ativas vêm primeiro, tingidas de
 * `atencao` (`ui/superficiePintada`, liso: fundo `forte`, borda na cor, texto em `texto`); as recuperadas depois, neutras,
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

/** A partir desta largura (medida na própria lista) as lesões ficam em colunas; abaixo, uma por cartão com os rótulos à vista. */
const LARGURA_EM_COLUNAS = 800;

interface AcoesDaLinha { podeAlterar: boolean; aoEditar: (l: Lesao) => void; aoExcluir: (l: Lesao) => void }

/**
 * Tabela das lesões: cabeçalho e colunas quando cabe, cartões empilhados com "Rótulo: valor" abaixo disso, como a `Tabela`
 * de `ui/`. Peça própria porque a `Tabela` não pinta uma linha (a ativa é tingida) e mudar a peça compartilhada mexeria
 * nas outras telas.
 */
function TabelaDeLesoes({ ativas, recuperadas, ...acoes }: { ativas: Lesao[]; recuperadas: Lesao[] } & AcoesDaLinha) {
  const { cores, bordas } = useTema();
  const [largura, setLargura] = useState<number | null>(null);
  const emColunas = largura !== null && largura >= LARGURA_EM_COLUNAS;
  const linhas = [...ativas.map((l) => ({ l, ativa: true })), ...recuperadas.map((l) => ({ l, ativa: false }))];
  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      role={emColunas ? 'table' : undefined} accessibilityRole={emColunas ? undefined : 'list'} accessibilityLabel="Lesões"
      style={emColunas ? [estilos.tabela, { borderWidth: bordas.bloco, borderColor: cores.divisor }] : estilos.cartoes}>
      {largura === null ? null : emColunas ? (
        <>
          <View role="row" style={[estilos.linha, estilos.cabecalho, { backgroundColor: cores.superficie3, borderColor: cores.divisor }]}>
            {COLUNAS.map((c) => (
              <View key={c.chave} role="columnheader" style={c.estilo}>
                {c.titulo ? <Texto variante="secao">{c.titulo}</Texto> : null}
              </View>
            ))}
          </View>
          {linhas.map(({ l, ativa }, i) => (
            <LinhaDaLesao key={l.id} lesao={l} ativa={ativa} ultima={i === linhas.length - 1} {...acoes} />
          ))}
        </>
      ) : linhas.map(({ l, ativa }) => <CartaoDaLesao key={l.id} lesao={l} ativa={ativa} {...acoes} />)}
    </View>
  );
}

const COLUNAS = [
  { chave: 'regiao', titulo: 'Região', estilo: { flex: 2, minWidth: 120 } },
  { chave: 'descricao', titulo: 'Descrição', estilo: { flex: 3, minWidth: 160 } },
  // 232: cabe "01/03/2026 a 15/05/2026" numa linha (Geist Mono).
  { chave: 'periodo', titulo: 'Período', estilo: { flex: 2, minWidth: 232 } },
  { chave: 'situacao', titulo: 'Situação', estilo: { width: 140 } },
  { chave: 'acoes', titulo: '', estilo: { width: 44 } },
] as const;

/** Fundo e borda da ativa: o tingido de `atencao` sobre a base onde ela fica (o texto segue `texto`/`textoSuave`). */
function useTingido(ativa: boolean, base: 'superficie' | 'superficie2') {
  const { cores, variante } = useTema();
  if (!ativa) return null;
  const p = superficiePintada(cores.atencao, cores[base], variante, cores);
  return { backgroundColor: p.forte, borderColor: p.borda };
}

function LinhaDaLesao({ lesao, ativa, ultima, ...acoes }: { lesao: Lesao; ativa: boolean; ultima: boolean } & AcoesDaLinha) {
  const { cores } = useTema();
  const tingido = useTingido(ativa, 'superficie');
  const selo = seloDaLesao(lesao.situacao);
  return (
    <View role="row" style={[estilos.linha, estilos.corpoDaLinha, tingido ? [estilos.linhaTingida, tingido] : !ultima ? { borderBottomWidth: 1, borderColor: cores.divisor } : null]}>
      <View role="cell" style={COLUNAS[0].estilo}><Texto variante="subtitulo">{lesao.regiao}</Texto></View>
      <View role="cell" style={[COLUNAS[1].estilo, estilos.celula]}>
        <Texto variante={lesao.descricao ? 'corpo' : 'suave'}>{lesao.descricao || SEM_DADO}</Texto>
        {lesao.observacao ? <Observacao texto={lesao.observacao} /> : null}
      </View>
      <View role="cell" style={COLUNAS[2].estilo}><Texto numerico>{periodoDaLesao(lesao)}</Texto></View>
      <View role="cell" style={COLUNAS[3].estilo}><View style={estilos.selo}><Selo texto={selo.texto} tipo={selo.tipo} /></View></View>
      <View role="cell" style={COLUNAS[4].estilo}><MaisAcoes lesao={lesao} {...acoes} /></View>
    </View>
  );
}

function CartaoDaLesao({ lesao, ativa, ...acoes }: { lesao: Lesao; ativa: boolean } & AcoesDaLinha) {
  const { cores } = useTema();
  const tingido = useTingido(ativa, 'superficie2');
  const selo = seloDaLesao(lesao.situacao);
  return (
    <View role="listitem" style={[estilos.cartao, tingido ?? { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <View style={estilos.topoDoCartao}>
        <Texto variante="subtitulo" style={estilos.encolher}>{lesao.regiao}</Texto>
        <MaisAcoes lesao={lesao} {...acoes} />
      </View>
      <Par rotulo="Descrição"><Texto variante={lesao.descricao ? 'corpo' : 'suave'}>{lesao.descricao || SEM_DADO}</Texto></Par>
      <Par rotulo="Período"><Texto numerico>{periodoDaLesao(lesao)}</Texto></Par>
      <Par rotulo="Situação"><View style={estilos.selo}><Selo texto={selo.texto} tipo={selo.tipo} /></View></Par>
      {lesao.observacao ? <Observacao texto={lesao.observacao} /> : null}
    </View>
  );
}

function Par({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View style={estilos.par}>
      <Texto variante="pequeno" style={estilos.rotuloDoPar}>{rotulo}</Texto>
      <View style={estilos.valorDoPar}>{children}</View>
    </View>
  );
}

/** "Observação: …" em até duas linhas; a longa ganha "Ver observação inteira" (o leitor de tela sempre ouve o texto todo). */
function Observacao({ texto }: { texto: string }) {
  const [inteira, setInteira] = useState(false);
  const longa = observacaoLonga(texto);
  return (
    <View style={estilos.observacao}>
      <Texto variante="pequeno" numberOfLines={longa && !inteira ? 2 : undefined} accessibilityLabel={`Observação: ${texto}`}>
        <Texto variante="pequeno" style={estilos.rotuloDaObservacao}>Observação: </Texto>{texto}
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

function FolhaLesao({ alunoId, lesao, aoFechar, aoSalvar }: { alunoId: string; lesao: Lesao | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [regiao, setRegiao] = useState(lesao?.regiao ?? '');
  const [descricao, setDescricao] = useState(lesao?.descricao ?? '');
  const [inicio, setInicio] = useState(dataParaTela(lesao?.dataInicio ?? null));
  const [fim, setFim] = useState(dataParaTela(lesao?.dataFim ?? null));
  const [situacao, setSituacao] = useState<SituacaoLesao>(lesao?.situacao ?? 'ATIVA');
  const [observacao, setObservacao] = useState(lesao?.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTelaNaFaixa(inicio, 'REGISTRO');
  const fi = dataDaTelaNaFaixa(fim, 'REGISTRO');
  const valido = regiao.trim() !== '' && ini !== undefined && fi !== undefined;

  const salvar = () => {
    if (!valido) return;
    const dados = {
      regiao: regiao.trim(),
      descricao: descricao.trim() || null,
      dataInicio: ini ?? null,
      dataFim: fi ?? null,
      situacao,
      observacao: observacao.trim() || null,
    };
    setSalvando(true);
    setErro(null);
    (lesao ? alterarLesao(alunoId, lesao.id, dados) : registrarLesao(alunoId, dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={lesao ? 'Editar lesão' : 'Registrar lesão'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!valido} />
        </>
      }>
      <Campo rotulo="Região do corpo" valor={regiao} aoMudar={setRegiao} maxLength={80} placeholder="Ex.: Ombro direito" />
      <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} maxLength={500} multiline />
      <Escolha rotulo="Situação" opcoes={SITUACOES} valor={situacao} aoMudar={setSituacao} />
      <ParDeDatas>
        <CampoData rotulo="Início (opcional)" nome="Início da lesão" regra="REGISTRO" valor={inicio} aoMudar={setInicio} />
        <CampoData rotulo="Fim (opcional)" nome="Fim da lesão" regra="REGISTRO" valor={fim} aoMudar={setFim} />
      </ParDeDatas>
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={500} multiline />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  verTodas: { flexDirection: 'row' },
  tabela: { borderRadius: RAIO, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2), paddingHorizontal: espaco(1.5) },
  cabecalho: { borderBottomWidth: 1, minHeight: 40, alignItems: 'center' },
  corpoDaLinha: { paddingVertical: espaco(1.5), minHeight: 48 },
  // A ativa tingida: a borda na cor fecha a linha nos quatro lados (1 px, `ui/superficiePintada`).
  linhaTingida: { borderWidth: 1 },
  celula: { gap: espaco(0.5) },
  selo: { flexDirection: 'row' },
  cartoes: { gap: espaco(1) },
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  topoDoCartao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  encolher: { flexShrink: 1 },
  par: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  rotuloDoPar: { width: 96, paddingTop: 2 },
  valorDoPar: { flex: 1, alignItems: 'flex-start' },
  observacao: { gap: espaco(0.25), alignItems: 'flex-start' },
  rotuloDaObservacao: { fontFamily: fontes.semi },
  verObservacao: { marginLeft: -espaco(1.5) },
});
