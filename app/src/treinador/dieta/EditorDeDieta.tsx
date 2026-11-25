import { router, useLocalSearchParams } from 'expo-router';
import { ChevronsDownUp, ChevronsUpDown, NotebookTabs, Plus, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { listarAlimentos, listarErgogenicos, suplementoDaResposta } from '../../api/rotas';
import type { Alimento, ConteudoDieta, Receita, Refeicao, ResultadoValidacao } from '../../api/tipos';
import { uidsComProblema } from '../../dominio/caminhos';
import { dataDaTelaNaFaixa } from '../../dominio/datasValidas';
import { comNomesPadrao, itensSemValorNoTotal, novaRefeicao, normalizarDieta } from '../../dominio/dieta';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { dataParaTela } from '../../dominio/formatos';
import { proximaSelecao } from '../../dominio/inspetorDoTreino';
import { moverPara } from '../../dominio/reordenar';
import { tituloDoModelo, tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { mudarRefeicoesDaSecao, refeicoesDaSecao, secoesDaDieta, variacaoAberta } from '../../dominio/variacoesDaDieta';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR, LARGURA_EDITOR_DE_CAMPOS } from '../../tema/tokens';
import { AlcaDeArraste, ItemArrastavel, useArrasteDaLista } from '../../ui/ArrasteDaLista';
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
import { useRolagem } from '../../ui/RolagemComTopo';
import { useCarregar } from '../../ui/useCarregar';
import { useSecoesAbertas } from '../../ui/useSecoesAbertas';
import { CartaoCicloNoPeriodo } from '../ciclo/CicloNaFicha';
import { AtualizacaoDoPlano } from '../plano/AtualizacaoDoPlano';
import { BarraDesfazer, type Desfazer } from '../plano/BarraDesfazer';
import { BlocoAdicionar } from '../plano/BlocoAdicionar';
import { ComColunas } from '../plano/ColunasDoEditor';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { FaixaDoModelo, FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';
import { FixoAbaixoDaBarra, mostrarAbaixoDaBarra, TelaDoEditor } from '../plano/TelaDoEditor';
import { BarraDoModeloDoEditor, NomeDoModelo } from '../plano/TopoModelo';
import { BarraDoPlano, ProblemasDoPlano } from '../plano/TopoPlano';
import { trilhaDoPlano } from '../plano/trilha';
import { usePlanoEditor } from '../plano/usePlanoEditor';
import { VoltarParaAPasta } from '../plano/VoltarParaAPasta';
import { ESPERA_DA_SELECAO } from '../treino/ContadoresDoTreino';
import { CartaoRefeicao, idDaRefeicao, resumoDaRefeicao, tituloDaRefeicao } from './CartaoRefeicao';
import { ComplementosDaDieta } from './ComplementosDaDieta';
import { type FolhaDaDieta, FolhasDaDieta } from './FolhasDaDieta';
import { TotalDoDia } from './TotalDoDia';
import { VariacoesDaDieta } from './VariacoesDaDieta';

/**
 * Editor do plano de dieta, no formato dos PDFs do Saraiva. Os valores dos itens vêm da biblioteca e são gravados no item;
 * o total do dia soma só a opção A de cada refeição. O topo segue a ordem do editor de treino (pasta, problemas, contexto,
 * configuração) e depois vêm o total, as refeições e os complementos. Com 960 px de conteúdo (`TelaDoEditor colunas`), as
 * refeições viram uma lista à esquerda e a escolhida abre inteira à direita (inspetor); abaixo disso, os cartões empilhados
 * que abrem e fecham. O modelo de uma refeição só fica sempre empilhado e aberto. Com variações por dia, total, refeições e
 * folhas agem na variação aberta (`secao`): toda escrita passa por `mudarRefeicoesDaSecao` com o uid dela, nunca na raiz.
 */
export default function EditorDeDieta({ modelo = false, unica = false, receita }: { modelo?: boolean; unica?: boolean; receita?: Receita }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Ao abrir: nome vazio vira "Refeição N" e o modelo não leva data de início (C57, C59; o campo nem aparece nele).
  const abrirConteudo = (c: unknown): ConteudoDieta => {
    const d = comNomesPadrao(normalizarDieta(c));
    return modelo ? { ...d, dataInicio: null } : d;
  };
  const editor = usePlanoEditor<ConteudoDieta>('dieta', id, abrirConteudo, modelo);
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
  // Refeição do inspetor (duas colunas); a que sumiu da lista (desfazer, modelo aplicado) cai na primeira.
  const [escolhidaUid, setEscolhidaUid] = useState<string | null>(null);
  // Variação aberta (dieta por dia); a que sumiu (excluída, desfeita, modelo aplicado) cai na primeira.
  const [abertaUid, setAbertaUid] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<ResultadoValidacao | null>(null);
  // "Ir ao primeiro" que atinge Suplementação ou Outros: o cartão deles é sem estado de fora, então reabre remontando.
  const [irAoComplemento, setIrAoComplemento] = useState<{ uids: string[]; vez: number } | null>(null);
  const [folha, setFolha] = useState<FolhaDaDieta | null>(null);
  // `refeicaoDaOpcao`/`indiceDaRefeicao`: onde o aviso aparece empilhado (no lugar do que saiu, para o Desfazer ficar à vista).
  const [desfazer, setDesfazer] = useState<(Desfazer<ConteudoDieta> & OndeDesfazer) | null>(null);
  // Porção da embalagem dos produtos escolhidos nesta abertura, só para referência ao escrever a dose (não é gravada).
  const [porcoes, setPorcoes] = useState<Record<string, string>>({});

  const estado = editor.estado;
  // Refeições da seção que o editor mostra: a raiz sem variações, senão a variação aberta (antes do hook, que não pode
  // ficar depois do retorno do carregamento).
  const aberta = estado ? variacaoAberta(estado.conteudo, abertaUid) : null;
  // A única seção abre sozinha (D2); a que chega depois (outra variação, refeição de modelo) entra fechada. Nova, erro e desfazer abrem à mão.
  const refeicoesAbertas = useSecoesAbertas((estado ? refeicoesDaSecao(estado.conteudo, aberta?.uid ?? null) : []).map((r) => r.uid));
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
  // A seção que o editor mostra: a raiz sem variações (`null`), senão a variação aberta.
  const secao = aberta?.uid ?? null;
  const refs = refeicoesDaSecao(c, secao);
  const temRefeicao = secoesDaDieta(c).some((s) => s.refeicoes.length > 0);
  const naSecao = (a: ConteudoDieta, fn: (r: Refeicao[]) => Refeicao[]) => mudarRefeicoesDaSecao(a, secao, fn);
  const comErro = uidsComProblema(c, (problemas?.erros ?? []).map((p) => p.caminho));
  // Toda mudança (menos digitar no Nome da refeição, que o cartão manda direto) sai com "Refeição N" nos nomes vazios:
  // refeição nova, de modelo ou de desfazer nunca chega ao rascunho sem nome (C57; o validador recusa "Refeição sem nome").
  const mudar = (parcial: Partial<ConteudoDieta>) => editor.alterarConteudo((a) => comNomesPadrao({ ...a, ...parcial }));
  const mudarRefeicoes = (fn: (r: ConteudoDieta['refeicoes']) => ConteudoDieta['refeicoes']) =>
    editor.alterarConteudo((a) => comNomesPadrao(naSecao(a, fn)));
  const comDesfazer = (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta, onde: OndeDesfazer = {}) => {
    setDesfazer({ rotulo, conteudo: c, variacao: secao, ...onde });
    editor.alterarConteudo((a) => comNomesPadrao(mudanca(a)));
  };

  const titulo = modelo ? tituloDoModelo(unica ? 'REFEICAO' : 'PLANO_DIETA') : tituloDoPlanoDoAluno('dieta', nomeDoAluno);
  const semValor = itensSemValorNoTotal(refs);
  const escolhida = refs.find((r) => r.uid === escolhidaUid) ?? refs[0];
  /** Abre (empilhado) e escolhe (duas colunas) a refeição; a rolagem, quando há, é de quem chama. */
  const abrirRefeicao = (uid: string) => { setEscolhidaUid(uid); refeicoesAbertas.abrir(uid); };
  const adicionarRefeicao = () => {
    const nova = novaRefeicao();
    mudarRefeicoes((r) => [...r, nova]);
    abrirRefeicao(nova.uid);
    return nova.uid;
  };

  // O único lugar de adicionar: no fim da lista (PC) ou dos cartões (celular), como o "Adicionar próximo exercício" do treino.
  const adicionar = unica ? null : (
    <BlocoAdicionar titulo="Adicionar próxima refeição" descricao="Comece em branco ou acrescente uma refeição pronta dos modelos.">
      <BotaoAdicionarRefeicao aoAdicionar={adicionarRefeicao} />
      <Botao rotulo="Modelos prontos" tipo="acao" Icone={NotebookTabs} aoTocar={() => setFolha({ tipo: 'modelos' })} />
    </BlocoAdicionar>
  );

  const barra = desfazer ? (
    <BarraDesfazer
      key="desfazer"
      desfazer={desfazer}
      aoDesfazer={() => {
        const anterior = desfazer.conteudo;
        setDesfazer(null);
        // A refeição removida volta como estava: o estado de abertas a esqueceu quando ela saiu da lista.
        if (desfazer.reabrir) refeicoesAbertas.abrir(desfazer.reabrir);
        editor.alterarConteudo(() => anterior);
      }}
      aoFechar={() => setDesfazer(null)}
    />
  ) : null;

  return (
    <TelaDoEditor
      colunas={!unica}
      cabecalho={<Cabecalho titulo={titulo} descricao={modelo ? 'O molde que você reaproveita: monte aqui e aplique a um aluno, que recebe uma cópia sem ligação com o modelo.' : 'Monte as refeições, os alimentos e a suplementação em rascunho. O aluno só vê o que você publica, e cada publicação vira uma versão.'} trilha={trilhaDoPlano(modelo, estado.plano.alunoId, titulo)} subtitulo={modelo ? undefined : estado.plano.titulo} voltar={modelo ? '/treinador/planejamento' : `/treinador/alunos/${estado.plano.alunoId}`} />}
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
          // Com variações, abre antes a primeira variação com problema (nela ou numa refeição dela).
          const alvo = secoesDaDieta(c).find((s) => (s.uid !== null && uids.includes(s.uid)) || s.refeicoes.some((r) => uids.includes(r.uid)));
          if (alvo?.uid) setAbertaUid(alvo.uid);
          const comProblema = (alvo?.refeicoes ?? refs).filter((r) => uids.includes(r.uid)).map((r) => r.uid);
          if (comProblema[0]) setEscolhidaUid(comProblema[0]);
          refeicoesAbertas.abrir(comProblema);
          setIrAoComplemento((p) => ({ uids, vez: (p?.vez ?? 0) + 1 }));
        }} />}
      {/* Contexto (de quem é o plano, o ciclo da aluna) junto; depois o plano; depois as refeições. */}
      <View style={estilos.grupo}>
        {modelo ? <FaixaDoModelo /> : <FaixaDoPlanoDoAluno tipo="dieta" alunoId={estado.plano.alunoId} />}
        {modelo ? null : <CartaoCicloNoPeriodo alunoId={estado.plano.alunoId} inicio={estado.plano.inicio} fim={estado.plano.fim} />}
      </View>
      {modelo ? <NomeDoModelo editor={editor} /> : null}
      {unica ? null : <ConfiguracaoDoPlano
        editor={editor}
        modelo={modelo}
        descricao="Título, período, objetivo e profissional da dieta.">
        <CamposDaDieta conteudo={c} aoMudar={mudar} modelo={modelo} />
      </ConfiguracaoDoPlano>}
      {unica ? null : (
        <VariacoesDaDieta conteudo={c} aberta={aberta} comProblema={comErro} aoAbrir={setAbertaUid}
          alterar={(mudanca) => editor.alterarConteudo(mudanca)}
          comDesfazer={(rotulo, mudanca) => comDesfazer(rotulo, mudanca, { secao: 'variacoes' })}
          aviso={desfazer?.secao === 'variacoes' ? barra : undefined} />
      )}
      <ComColunas>{(duas, tres) => {
        const totalDoDiaEl = (
          <TotalDoDia conteudo={c} refeicoes={refs} rotulo={aberta?.rotulo} semValor={semValor} aoAbrirRefeicao={abrirRefeicao} aoMudarAgua={unica ? undefined : (aguaLitros) => mudar({ aguaLitros })} />
        );
        const totalNaColuna = tres && !!escolhida;
        // Empilhadas, várias refeições abertas empurravam o aviso do topo para fora da janela. Opção removida: o aviso fica
        // na refeição dela (se ela está aberta); refeição removida: no lugar dela. Em duas colunas e no resto, no topo.
        const avisoNaRefeicao = !duas && desfazer?.refeicaoDaOpcao !== undefined
          && refs.some((r) => r.uid === desfazer.refeicaoDaOpcao && (unica || refeicoesAbertas.estaAberta(r.uid)));
        // A posição só vale na variação de onde a refeição saiu; em outra, o aviso vai para o topo da lista.
        const avisoNoLugar = !duas && desfazer?.indiceDaRefeicao !== undefined && desfazer.variacao === secao
          ? Math.min(desfazer.indiceDaRefeicao, refs.length) : null;
        const cartao = (r: ConteudoDieta['refeicoes'][number], ri: number, noInspetor: boolean) => (
          <CartaoRefeicao
            key={r.uid}
            refeicao={r}
            posicao={ri}
            total={refs.length}
            aberta={noInspetor || unica || refeicoesAbertas.estaAberta(r.uid)}
            comProblema={comErro}
            alimentos={porId}
            aviso={avisoNaRefeicao && desfazer?.refeicaoDaOpcao === r.uid ? barra : undefined}
            avisoDoAlimento={desfazer?.doAlimento}
            aoAbrir={noInspetor || unica ? undefined : () => refeicoesAbertas.alternar(r.uid)}
            // Direto, sem o nome padrão: apagar o Nome para digitar outro não pode preencher na hora (preenche ao sair do campo).
            aoMudar={(nova) => editor.alterarConteudo((a) => naSecao(a, (lista) => substituir(lista, ri, nova)))}
            aoSairDoNome={() => { if (refs.some((x) => x.nome.trim() === '')) editor.alterarConteudo(comNomesPadrao); }}
            aoRemoverOpcao={(oi) => comDesfazer(`Opção ${r.opcoes[oi]?.rotulo ?? oi + 1} removida.`, (a) =>
              naSecao(a, (lista) => substituir(lista, ri, { ...lista[ri], opcoes: remover(lista[ri].opcoes, oi) })),
              { refeicaoDaOpcao: r.uid })}
            aoRemoverItem={(oi, ii, nomeItem) => comDesfazer(`Alimento “${nomeItem}” removido.`, (a) =>
              naSecao(a, (lista) => substituir(lista, ri, {
                ...lista[ri],
                opcoes: substituir(lista[ri].opcoes, oi, {
                  ...lista[ri].opcoes[oi],
                  itens: remover(lista[ri].opcoes[oi].itens, ii),
                }),
              })),
              { refeicaoDaOpcao: r.uid, doAlimento: true })}
            aoMover={(d) => mudarRefeicoes((lista) => mover(lista, ri, d))}
            aoRemover={unica ? undefined : () => {
              const depois = remover(refs, ri);
              setEscolhidaUid(proximaSelecao(refs.map((x) => x.uid), depois.map((x) => x.uid), escolhida?.uid ?? null));
              comDesfazer(`Refeição “${r.nome || ri + 1}” removida.`, (a) => naSecao(a, (lista) => remover(lista, ri)),
                { indiceDaRefeicao: ri, reabrir: refeicoesAbertas.estaAberta(r.uid) ? [r.uid] : undefined });
            }}
            aoSalvarModelo={unica ? undefined : () => setFolha({ tipo: 'salvarRefeicao', indice: ri })}
            aoEscolherAlimento={(opcao) => setFolha({ tipo: 'alimento', refeicao: ri, opcao })}
            aoTrocarAlimento={(uid) => setFolha({ tipo: 'trocar', refeicao: ri, uid })}
          />
        );
        return <>
          {totalNaColuna ? null : totalDoDiaEl}
          <View style={estilos.cabecalhoRefeicoes}>
            <Texto variante="bloco" nivel={2}>Refeições ({refs.length})</Texto>
            <LinhaDeAcoes>
              <Botao rotulo="Lista de compras" tipo="fantasma" Icone={ShoppingCart} desabilitado={!temRefeicao}
                motivo="Adicione uma refeição primeiro." aoTocar={() => setFolha({ tipo: 'compras' })} />
              {/* Em duas colunas a escolhida já está aberta: não há o que abrir todas. */}
              {!duas && !unica && refs.length > 1 ? (
                <Botao rotulo={refeicoesAbertas.todasAbertas ? 'Fechar todas' : 'Abrir todas'} tipo="fantasma" Icone={refeicoesAbertas.todasAbertas ? ChevronsDownUp : ChevronsUpDown}
                  aoTocar={refeicoesAbertas.todasAbertas ? refeicoesAbertas.fecharTodas : refeicoesAbertas.abrirTodas} />
              ) : null}
            </LinhaDeAcoes>
          </View>
          {avisoNaRefeicao || avisoNoLugar !== null || desfazer?.secao ? null : barra}
          {refs.length === 0 ? <Vazio texto={aberta ? 'Nenhuma refeição nesta variação ainda. Adicione a primeira ou comece de um modelo pronto.' : 'Nenhuma refeição ainda. Adicione a primeira ou comece de um modelo pronto.'} /> : null}
          {duas && escolhida ? (
            <View style={estilos.colunas}>
              <View style={estilos.lista}>
                <ListaDeRefeicoes refs={refs} escolhidaUid={escolhida.uid} comErro={comErro} aoEscolher={setEscolhidaUid}
                  aoSoltar={(de, para) => {
                    const anterior = c;
                    mudarRefeicoes((lista) => moverPara(lista, de, para));
                    return () => editor.alterarConteudo(() => anterior);
                  }} />
                {adicionar}
              </View>
              <View style={estilos.inspetor}>{cartao(escolhida, refs.indexOf(escolhida), true)}</View>
              {totalNaColuna ? <FixoAbaixoDaBarra rola style={estilos.colunaTotal} testID="coluna-total-dieta">{totalDoDiaEl}</FixoAbaixoDaBarra> : null}
            </View>
          ) : <>
            {refs.flatMap((r, ri) => (ri === avisoNoLugar ? [barra, cartao(r, ri, false)] : [cartao(r, ri, false)]))}
            {avisoNoLugar === refs.length ? barra : null}
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
          irPara={irAoComplemento}
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
        refeicoes={refs}
        temRefeicao={temRefeicao}
        naSecao={naSecao}
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

/**
 * Lista (mestre) das refeições em duas colunas: um item por refeição, com a alça de arrastar (arrastar, 18/11). Soltar
 * leva a refeição pela mesma regra das setas (`moverPara`, de uma casa em uma); as setas ficam no ⋯ da refeição.
 */
function ListaDeRefeicoes({ refs, escolhidaUid, comErro, aoEscolher, aoSoltar }: {
  refs: Refeicao[];
  escolhidaUid: string;
  comErro: ReadonlySet<string>;
  aoEscolher: (uid: string) => void;
  aoSoltar: (de: number, para: number) => () => void;
}) {
  const arraste = useArrasteDaLista({ total: refs.length, aoSoltar });
  return (
    <View style={estilos.itens} role="group" accessibilityLabel="Refeições do plano">
      {refs.map((r, ri) => {
        const tituloDaLinha = tituloDaRefeicao(r, ri);
        const resumo = resumoDaRefeicao(r);
        const problema = comErro.has(r.uid);
        return (
          <ItemArrastavel key={r.uid} arraste={arraste} indice={ri}>
            <ItemDaListaDoEditor numero={ri + 1} titulo={tituloDaLinha} linha={resumo} escolhido={r.uid === escolhidaUid}
              comProblema={problema} selo={problema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
              rotulo={`Refeição ${ri + 1} de ${refs.length}: ${tituloDaLinha}${problema ? ', corrigir' : ''}. ${resumo}`}
              aoEscolher={() => aoEscolher(r.uid)} alca={<AlcaDeArraste arraste={arraste} indice={ri} />} />
          </ItemArrastavel>
        );
      })}
    </View>
  );
}

/**
 * "Adicionar refeição" e a rolagem até a refeição nova (C61): o cartão novo nasce abaixo do botão e o campo Nome ficava
 * cortado na borda de baixo. Um componente à parte porque o `useRolagem` só vale dentro da `TelaDoEditor`. Na web a barra
 * grudada fica dentro da rolagem (`mostrarAbaixoDaBarra`); no nativo o alvo é o cartão (`AlvoDeRolagem chave={uid}`).
 */
function BotaoAdicionarRefeicao({ aoAdicionar }: { aoAdicionar: () => string }) {
  const { rolarAte } = useRolagem();
  return (
    <Botao rotulo="Adicionar refeição" tipo="acao" Icone={Plus} aoTocar={() => {
      const uid = aoAdicionar();
      // Depois de o cartão abrir (o `rolarAte` já espera um pouco por conta própria).
      if (Platform.OS === 'web') setTimeout(() => mostrarAbaixoDaBarra(idDaRefeicao(uid), true), ESPERA_DA_SELECAO);
      else rolarAte([uid]);
    }} />
  );
}

/**
 * De onde saiu o que o "Desfazer" devolve: a refeição da opção removida ou a posição da refeição removida (na `variacao`
 * que estava aberta; `null` = dieta sem variação), ou a seção do editor.
 */
interface OndeDesfazer {
  refeicaoDaOpcao?: string;
  /** Na refeição da opção, foi um alimento que saiu: o aviso fica depois da lista, não acima da opção. */
  doAlimento?: boolean;
  indiceDaRefeicao?: number;
  /** Refeição removida que estava aberta: o "Desfazer" a abre de novo. */
  reabrir?: string[];
  variacao?: string | null;
  secao?: 'complementos' | 'variacoes';
}

/** Objetivo, data de início e profissional (como no topo do PDF do Saraiva). A água fica no "Total do dia". O modelo não tem data de início (C59). */
function CamposDaDieta({ conteudo, aoMudar, modelo }: { conteudo: ConteudoDieta; aoMudar: (p: Partial<ConteudoDieta>) => void; modelo: boolean }) {
  const [inicio, setInicio] = useState(dataParaTela(conteudo.dataInicio));
  return (
    <>
      <Campo rotulo="Objetivo (opcional)" valor={conteudo.objetivo ?? ''} aoMudar={(t) => aoMudar({ objetivo: t || null })} maxLength={200} />
      <View style={estilos.grade}>
        {modelo ? null : <View style={estilos.campo}>
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
        </View>}
        <View style={estilos.cresce}>
          <Campo rotulo="Profissional (opcional)" valor={conteudo.profissional ?? ''} aoMudar={(t) => aoMudar({ profissional: t || null })} maxLength={120} />
        </View>
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1.5) },
  // Lista (mestre) estreita: o inspetor fica com o resto (a opção aberta, em abas desde 19/11, tem uns 668 px em 1280 com o menu aberto).
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  // 260 px de base (20/11, era 280: os 20 px a mais deixam a tabela de alimentos aparecer em 1280 com o menu aberto); só
  // cresce (até 400) quando o painel já parou no teto e sobra espaço, para ele terminar na borda dos cartões de cima.
  lista: { flexGrow: 1, flexShrink: 0, flexBasis: 260, maxWidth: 400, gap: espaco(2) },
  itens: { gap: espaco(1) },
  // Na tela larga o painel para em ~1400 px, junto da lista; o peso 1000 faz a sobra ir primeiro à lista (nunca campo esticado).
  inspetor: { flexGrow: 1000, flexShrink: 1, flexBasis: 0, minWidth: 0, maxWidth: LARGURA_EDITOR_DE_CAMPOS },
  colunaTotal: { width: 380, flexShrink: 0, alignSelf: 'flex-start' },
  cabecalhoRefeicoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  cresce: { flex: 1, gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campo: { minWidth: 190, flex: 1 },
});
