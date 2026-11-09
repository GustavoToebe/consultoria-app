import { router, useLocalSearchParams } from 'expo-router';
import { ChevronsDownUp, ChevronsUpDown, NotebookTabs, Plus, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarAlimentos, listarErgogenicos, suplementoDaResposta } from '../../api/rotas';
import type { Alimento, ConteudoDieta, Receita, ResultadoValidacao } from '../../api/tipos';
import { uidsComProblema } from '../../dominio/caminhos';
import { dataDaTelaNaFaixa } from '../../dominio/datasValidas';
import { itensSemValorNoTotal, novaRefeicao, normalizarDieta } from '../../dominio/dieta';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { dataParaTela } from '../../dominio/formatos';
import { proximaSelecao } from '../../dominio/inspetorDoTreino';
import { tituloDoModelo, tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { CartaoCicloNoPeriodo } from '../ciclo/CicloNaFicha';
import { AtualizacaoDoPlano } from '../plano/AtualizacaoDoPlano';
import { BarraDesfazer, type Desfazer } from '../plano/BarraDesfazer';
import { BlocoAdicionar } from '../plano/BlocoAdicionar';
import { ComColunas } from '../plano/ColunasDoEditor';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { FaixaDoModelo, FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { BarraDoModeloDoEditor, NomeDoModelo } from '../plano/TopoModelo';
import { BarraDoPlano, ProblemasDoPlano } from '../plano/TopoPlano';
import { trilhaDoPlano } from '../plano/trilha';
import { usePlanoEditor } from '../plano/usePlanoEditor';
import { VoltarParaAPasta } from '../plano/VoltarParaAPasta';
import { CartaoRefeicao, resumoDaRefeicao, tituloDaRefeicao } from './CartaoRefeicao';
import { ComplementosDaDieta } from './ComplementosDaDieta';
import { type FolhaDaDieta, FolhasDaDieta } from './FolhasDaDieta';
import { TotalDoDia } from './TotalDoDia';

/**
 * Editor do plano de dieta, no formato dos PDFs do Saraiva. Os valores dos itens vêm da biblioteca e são gravados no item;
 * o total do dia soma só a opção A de cada refeição. O topo segue a ordem do editor de treino (pasta, problemas, contexto,
 * configuração) e depois vêm o total, as refeições e os complementos. Com 960 px de conteúdo (`TelaDoEditor colunas`), as
 * refeições viram uma lista à esquerda e a escolhida abre inteira à direita (inspetor); abaixo disso, os cartões empilhados
 * que abrem e fecham. O modelo de uma refeição só fica sempre empilhado e aberto.
 */
export default function EditorDeDieta({ modelo = false, unica = false, receita }: { modelo?: boolean; unica?: boolean; receita?: Receita }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const editor = usePlanoEditor<ConteudoDieta>('dieta', id, normalizarDieta, modelo);
  const nomeDoAluno = useNomeDoAluno(modelo ? null : editor.estado?.plano.alunoId);
  const alimentosComuns = useCarregar('biblioteca-alimentos', () => listarAlimentos()).dados ?? [];
  const { pode } = useSessao();
  // Sem BIBLIOTECA_LER a API recusa a lista: nem pede, e o botão "Suplemento da biblioteca" some.
  const veBiblioteca = pode('BIBLIOTECA_LER');
  const suplementosAlimento = useCarregar(veBiblioteca ? 'biblioteca-suplementos-alimento' : null, () => listarAlimentos(undefined, 'SUPLEMENTO')).dados ?? [];
  const suplementosDaBiblioteca = suplementosAlimento.map(suplementoDaResposta);
  const alimentos = [...alimentosComuns, ...suplementosAlimento];
  // Medicação e ergogênicos é dado sensível: sem ERGOGENICO_LER a lista nem é pedida; modelos nunca a levam.
  const veErgogenicos = !modelo && pode('ERGOGENICO_LER');
  const editaErgogenicos = veErgogenicos && pode('ERGOGENICO_ALTERAR');
  const ergogenicosDaBiblioteca = useCarregar(veErgogenicos && editaErgogenicos ? 'biblioteca-ergogenicos' : null, () => listarErgogenicos()).dados ?? [];
  const porId = new Map<string, Alimento>(alimentos.map((a) => [a.id, a]));
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  // Refeição do inspetor (duas colunas); a que sumiu da lista (desfazer, modelo aplicado) cai na primeira.
  const [escolhidaUid, setEscolhidaUid] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<ResultadoValidacao | null>(null);
  const [folha, setFolha] = useState<FolhaDaDieta | null>(null);
  // `refeicaoDaOpcao`/`indiceDaRefeicao`: onde o aviso aparece empilhado (no lugar do que saiu, para o Desfazer ficar à vista).
  const [desfazer, setDesfazer] = useState<(Desfazer<ConteudoDieta> & OndeDesfazer) | null>(null);
  // Porção da embalagem dos produtos escolhidos nesta abertura, só para referência ao escrever a dose (não é gravada).
  const [porcoes, setPorcoes] = useState<Record<string, string>>({});

  const estado = editor.estado;
  if (!estado) {
    return (
      <Tela bordas={['top']} largura={LARGURA_EDITOR}>
        <Cabecalho titulo="Plano de dieta" voltar="/treinador/alunos" />
        {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar}
          acao={{ rotulo: 'Voltar à lista', aoTocar: () => router.navigate('/treinador/alunos') }} /> : <Esqueleto />}
      </Tela>
    );
  }

  const c = estado.conteudo;
  const comErro = uidsComProblema(c, (problemas?.erros ?? []).map((p) => p.caminho));
  const todasAbertas = c.refeicoes.length > 0 && c.refeicoes.every((r) => abertas.has(r.uid));
  const mudar = (parcial: Partial<ConteudoDieta>) => editor.alterarConteudo((a) => ({ ...a, ...parcial }));
  const mudarRefeicoes = (fn: (r: ConteudoDieta['refeicoes']) => ConteudoDieta['refeicoes']) =>
    editor.alterarConteudo((a) => ({ ...a, refeicoes: fn(a.refeicoes) }));
  const comDesfazer = (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta, onde: OndeDesfazer = {}) => {
    setDesfazer({ rotulo, conteudo: c, ...onde });
    editor.alterarConteudo(mudanca);
  };
  const alternar = (uid: string) =>
    setAbertas((a) => {
      const novo = new Set(a);
      if (novo.has(uid)) novo.delete(uid);
      else novo.add(uid);
      return novo;
    });

  const titulo = modelo ? tituloDoModelo(unica ? 'REFEICAO' : 'PLANO_DIETA') : tituloDoPlanoDoAluno('dieta', nomeDoAluno);
  const semValor = itensSemValorNoTotal(c);
  const escolhida = c.refeicoes.find((r) => r.uid === escolhidaUid) ?? c.refeicoes[0];
  /** Abre (empilhado) e escolhe (duas colunas) a refeição; a rolagem, quando há, é de quem chama. */
  const abrirRefeicao = (uid: string) => { setEscolhidaUid(uid); setAbertas((a) => new Set(a).add(uid)); };
  const adicionarRefeicao = () => {
    const nova = novaRefeicao();
    mudarRefeicoes((r) => [...r, nova]);
    abrirRefeicao(nova.uid);
  };

  // O único lugar de adicionar: no fim da lista (PC) ou dos cartões (celular), como o "Adicionar próximo exercício" do treino.
  const adicionar = unica ? null : (
    <BlocoAdicionar titulo="Adicionar próxima refeição" descricao="Comece em branco ou acrescente uma refeição pronta dos modelos.">
      <Botao rotulo="Adicionar refeição" tipo="secundario" Icone={Plus} aoTocar={adicionarRefeicao} />
      <Botao rotulo="Modelos prontos" tipo="secundario" Icone={NotebookTabs} aoTocar={() => setFolha({ tipo: 'modelos' })} />
    </BlocoAdicionar>
  );

  const barra = desfazer ? (
    <BarraDesfazer
      key="desfazer"
      desfazer={desfazer}
      aoDesfazer={() => {
        const anterior = desfazer.conteudo;
        setDesfazer(null);
        editor.alterarConteudo(() => anterior);
      }}
      aoFechar={() => setDesfazer(null)}
    />
  ) : null;

  return (
    <TelaDoEditor
      colunas={!unica}
      cabecalho={<Cabecalho titulo={titulo} trilha={trilhaDoPlano(modelo, estado.plano.alunoId, titulo)} subtitulo={modelo ? undefined : estado.plano.titulo} voltar={modelo ? '/treinador/planejamento' : `/treinador/alunos/${estado.plano.alunoId}`} />}
      barra={modelo ? <BarraDoModeloDoEditor editor={editor} receita={receita} /> : <BarraDoPlano tipo="dieta" editor={editor} aoProblemas={setProblemas} />}>
      {/* Plano de uma pasta: volta à Folha dela e lê a atualização sem perder o rascunho (reunião de 30/10). */}
      {!modelo && estado.plano.pastaId ? (
        <LinhaDeAcoes>
          <VoltarParaAPasta alunoId={estado.plano.alunoId} pastaId={estado.plano.pastaId} />
          <AtualizacaoDoPlano alunoId={estado.plano.alunoId} pastaId={estado.plano.pastaId} />
        </LinhaDeAcoes>
      ) : null}
      {modelo ? null : <ProblemasDoPlano editor={editor} problemas={problemas} aoProblemas={setProblemas}
        aoIrAoPrimeiro={(uids) => {
          const comProblema = c.refeicoes.filter((r) => uids.includes(r.uid)).map((r) => r.uid);
          if (comProblema[0]) setEscolhidaUid(comProblema[0]);
          setAbertas((a) => new Set([...a, ...comProblema]));
        }} />}
      {/* Contexto (de quem é o plano, o ciclo da aluna) junto; depois o plano; depois as refeições. */}
      <View style={estilos.grupo}>
        {modelo ? <FaixaDoModelo /> : <FaixaDoPlanoDoAluno tipo="dieta" />}
        {modelo ? null : <CartaoCicloNoPeriodo alunoId={estado.plano.alunoId} inicio={estado.plano.inicio} fim={estado.plano.fim} />}
      </View>
      {modelo ? <NomeDoModelo editor={editor} /> : null}
      {unica ? null : <ConfiguracaoDoPlano
        editor={editor}
        modelo={modelo}
        recolhido={c.refeicoes.length > 0 && estado.titulo.trim() !== ''}
        descricao="Título, período, objetivo e profissional da dieta.">
        <CamposDaDieta conteudo={c} aoMudar={mudar} />
      </ConfiguracaoDoPlano>}
      <TotalDoDia conteudo={c} semValor={semValor} aoAbrirRefeicao={abrirRefeicao} aoMudarAgua={unica ? undefined : (aguaLitros) => mudar({ aguaLitros })} />
      <ComColunas>{(duas) => {
        // Empilhadas, várias refeições abertas empurravam o aviso do topo para fora da janela. Opção removida: o aviso fica
        // na refeição dela (se ela está aberta); refeição removida: no lugar dela. Em duas colunas e no resto, no topo.
        const avisoNaRefeicao = !duas && desfazer?.refeicaoDaOpcao !== undefined
          && c.refeicoes.some((r) => r.uid === desfazer.refeicaoDaOpcao && (unica || abertas.has(r.uid)));
        const avisoNoLugar = !duas && desfazer?.indiceDaRefeicao !== undefined ? Math.min(desfazer.indiceDaRefeicao, c.refeicoes.length) : null;
        const cartao = (r: ConteudoDieta['refeicoes'][number], ri: number, noInspetor: boolean) => (
          <CartaoRefeicao
            key={r.uid}
            refeicao={r}
            posicao={ri}
            total={c.refeicoes.length}
            aberta={noInspetor || unica || abertas.has(r.uid)}
            comProblema={comErro}
            alimentos={porId}
            aviso={avisoNaRefeicao && desfazer?.refeicaoDaOpcao === r.uid ? barra : undefined}
            aoAbrir={noInspetor || unica ? undefined : () => alternar(r.uid)}
            aoMudar={(nova) => mudarRefeicoes((lista) => substituir(lista, ri, nova))}
            aoRemoverOpcao={(oi) => comDesfazer(`Opção ${r.opcoes[oi]?.rotulo ?? oi + 1} removida.`, (a) =>
              ({ ...a, refeicoes: substituir(a.refeicoes, ri, { ...a.refeicoes[ri], opcoes: remover(a.refeicoes[ri].opcoes, oi) }) }),
              { refeicaoDaOpcao: r.uid })}
            aoMover={(d) => mudarRefeicoes((lista) => mover(lista, ri, d))}
            aoRemover={unica ? undefined : () => {
              const depois = remover(c.refeicoes, ri);
              setEscolhidaUid(proximaSelecao(c.refeicoes.map((x) => x.uid), depois.map((x) => x.uid), escolhida?.uid ?? null));
              comDesfazer(`Refeição “${r.nome || ri + 1}” removida.`, (a) => ({ ...a, refeicoes: remover(a.refeicoes, ri) }), { indiceDaRefeicao: ri });
            }}
            aoSalvarModelo={unica ? undefined : () => setFolha({ tipo: 'salvarRefeicao', indice: ri })}
            aoEscolherAlimento={(opcao) => setFolha({ tipo: 'alimento', refeicao: ri, opcao })}
          />
        );
        return <>
          <View style={estilos.cabecalhoRefeicoes}>
            <Texto variante="bloco" nivel={2}>Refeições ({c.refeicoes.length})</Texto>
            <LinhaDeAcoes>
              <Botao rotulo="Lista de compras" tipo="fantasma" Icone={ShoppingCart} desabilitado={c.refeicoes.length === 0}
                motivo="Adicione uma refeição primeiro." aoTocar={() => setFolha({ tipo: 'compras' })} />
              {/* Em duas colunas a escolhida já está aberta: não há o que abrir todas. */}
              {!duas && !unica && c.refeicoes.length > 1 ? (
                <Botao rotulo={todasAbertas ? 'Fechar todas' : 'Abrir todas'} tipo="fantasma" Icone={todasAbertas ? ChevronsDownUp : ChevronsUpDown}
                  aoTocar={() => setAbertas(todasAbertas ? new Set() : new Set(c.refeicoes.map((r) => r.uid)))} />
              ) : null}
            </LinhaDeAcoes>
          </View>
          {avisoNaRefeicao || avisoNoLugar !== null || desfazer?.secao === 'complementos' ? null : barra}
          {c.refeicoes.length === 0 ? <Vazio texto="Nenhuma refeição ainda. Adicione a primeira ou comece de um modelo pronto." /> : null}
          {duas && escolhida ? (
            <View style={estilos.colunas}>
              <View style={estilos.lista}>
                <View style={estilos.itens} role="group" accessibilityLabel="Refeições do plano">
                  {c.refeicoes.map((r, ri) => {
                    const tituloDaLinha = tituloDaRefeicao(r, ri);
                    const resumo = resumoDaRefeicao(r);
                    const problema = comErro.has(r.uid);
                    return (
                      <ItemDaListaDoEditor key={r.uid} numero={ri + 1} titulo={tituloDaLinha} linha={resumo} escolhido={r.uid === escolhida.uid}
                        comProblema={problema} selo={problema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
                        rotulo={`Refeição ${ri + 1} de ${c.refeicoes.length}: ${tituloDaLinha}${problema ? ', corrigir' : ''}. ${resumo}`}
                        aoEscolher={() => setEscolhidaUid(r.uid)} />
                    );
                  })}
                </View>
                {adicionar}
              </View>
              <View style={estilos.inspetor}>{cartao(escolhida, c.refeicoes.indexOf(escolhida), true)}</View>
            </View>
          ) : <>
            {c.refeicoes.flatMap((r, ri) => (ri === avisoNoLugar ? [barra, cartao(r, ri, false)] : [cartao(r, ri, false)]))}
            {avisoNoLugar === c.refeicoes.length ? barra : null}
            {adicionar}
          </>}
        </>;
      }}</ComColunas>
      {/* Modelo de uma refeição só: os complementos seriam descartados ao aplicar o modelo numa dieta. */}
      {unica ? null : (
        <ComplementosDaDieta
          conteudo={c}
          aoMudar={mudar}
          comDesfazer={comDesfazer}
          aviso={desfazer?.secao === 'complementos' ? barra : undefined}
          aoEscolherDaBiblioteca={(tipo) => setFolha({ tipo })}
          porcoes={porcoes}
          veBiblioteca={veBiblioteca}
          veErgogenicos={veErgogenicos}
          editaErgogenicos={editaErgogenicos}
        />
      )}
      <FolhasDaDieta
        folha={folha}
        abrir={setFolha}
        fechar={() => setFolha(null)}
        conteudo={c}
        titulo={estado.titulo}
        modelo={modelo}
        unica={unica}
        nomeDoAluno={nomeDoAluno}
        planoId={id}
        salvar={editor.salvar}
        alimentos={alimentos}
        suplementos={suplementosDaBiblioteca}
        ergogenicos={ergogenicosDaBiblioteca}
        mudar={mudar}
        mudarRefeicoes={mudarRefeicoes}
        comDesfazer={comDesfazer}
        aoPorcao={(uid, porcao) => setPorcoes((atual) => ({ ...atual, [uid]: porcao }))}
      />
    </TelaDoEditor>
  );
}

/** De onde saiu o que o "Desfazer" devolve: a refeição da opção removida ou a posição da refeição removida. */
interface OndeDesfazer {
  refeicaoDaOpcao?: string;
  indiceDaRefeicao?: number;
  secao?: 'complementos';
}

/** Objetivo, data de início e profissional (como no topo do PDF do Saraiva). A água fica no "Total do dia". */
function CamposDaDieta({ conteudo, aoMudar }: { conteudo: ConteudoDieta; aoMudar: (p: Partial<ConteudoDieta>) => void }) {
  const [inicio, setInicio] = useState(dataParaTela(conteudo.dataInicio));
  return (
    <>
      <Campo rotulo="Objetivo (opcional)" valor={conteudo.objetivo ?? ''} aoMudar={(t) => aoMudar({ objetivo: t || null })} maxLength={200} />
      <View style={estilos.grade}>
        <View style={estilos.campo}>
          <CampoData
            rotulo="Data de início (opcional)"
            nome="Data de início da dieta"
            regra="PLANEJAMENTO"
            valor={inicio}
            aoMudar={(t) => {
              setInicio(t);
              const iso = dataDaTelaNaFaixa(t, 'PLANEJAMENTO');
              if (iso !== undefined) aoMudar({ dataInicio: iso });
            }}
          />
        </View>
        <View style={estilos.cresce}>
          <Campo rotulo="Profissional (opcional)" valor={conteudo.profissional ?? ''} aoMudar={(t) => aoMudar({ profissional: t || null })} maxLength={120} />
        </View>
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1.5) },
  // Lista (mestre) estreita: em 1280 o inspetor fica com uns 700 px e duas opções da refeição cabem lado a lado.
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  lista: { width: 280, flexShrink: 0, gap: espaco(2) },
  itens: { gap: espaco(1) },
  inspetor: { flex: 1, minWidth: 0 },
  cabecalhoRefeicoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  cresce: { flex: 1, gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campo: { minWidth: 190, flex: 1 },
});
