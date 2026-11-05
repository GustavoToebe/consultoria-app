import { router, useLocalSearchParams } from 'expo-router';
import { ChevronsDownUp, ChevronsUpDown, NotebookTabs, Plus, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarAlimentos, listarErgogenicos, listarSuplementos, salvarPlanoComoReceita, criarReceita } from '../../api/rotas';
import type { Alimento, ConteudoDieta, Receita, ResultadoValidacao } from '../../api/tipos';
import { uidsComProblema } from '../../dominio/caminhos';
import { AGUA_MAXIMA, AGUA_MINIMA, aguaValida, aplicarReceitaDeDieta, itensSemValorNoTotal, type ItemSemValor, novaRefeicao, novoItem, normalizarDieta, textoDoMacro, textoItensSemValor, totalDoDia } from '../../dominio/dieta';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { linhaDeErgogenico } from '../../dominio/ergogenicos';
import { dataDaTelaNaFaixa } from '../../dominio/datasValidas';
import { dataParaTela, numeroParaTela, SEM_DADO } from '../../dominio/formatos';
import { descricaoDaPorcao, linhaDeSuplementacao } from '../../dominio/suplementos';
import { novoUid } from '../../dominio/uid';
import { proximaSelecao } from '../../dominio/inspetorDoTreino';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO, LARGURA_EDITOR } from '../../tema/tokens';
import { CartaoRefeicao, resumoDaRefeicao, tituloDaRefeicao } from '../../treinador/dieta/CartaoRefeicao';
import { ComplementosDaDieta } from '../../treinador/dieta/ComplementosDaDieta';
import { FolhaAlimentos } from '../../treinador/dieta/FolhaAlimentos';
import { FolhaErgogenicos } from '../../treinador/dieta/FolhaErgogenicos';
import { FolhaListaDeCompras } from '../../treinador/dieta/FolhaListaDeCompras';
import { FolhaSuplementos } from '../../treinador/dieta/FolhaSuplementos';
import { FolhaReceitas } from '../../treinador/FolhaReceitas';
import { FolhaSalvarReceita } from '../../treinador/FolhaSalvarReceita';
import { BarraDesfazer, type Desfazer } from '../../treinador/plano/BarraDesfazer';
import { BarraDoModeloDoEditor, NomeDoModelo } from '../../treinador/plano/TopoModelo';
import { BarraDoPlano, ProblemasDoPlano } from '../../treinador/plano/TopoPlano';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { ComColunas } from '../plano/ColunasDoEditor';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';
import { avisoModeloSalvo, rotuloSalvarComo } from '../planejamento/modelos';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { useRolagem } from '../../ui/RolagemComTopo';
import { usePlanoEditor } from '../../treinador/plano/usePlanoEditor';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { CampoData, CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Incompleto, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { coresDoDesabilitado } from '../../ui/desabilitado';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { tituloDoModelo, tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { CartaoCicloNoPeriodo } from '../ciclo/CicloNaFicha';
import { FaixaDoModelo, FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { trilhaDoPlano } from '../plano/trilha';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { AtualizacaoDoPlano } from '../plano/AtualizacaoDoPlano';
import { VoltarParaAPasta } from '../plano/VoltarParaAPasta';
import { Folha } from '../../ui/Folha';

type FolhaAberta = { tipo: 'alimento'; refeicao: number; opcao: number } | { tipo: 'receita' } | { tipo: 'suplemento' } | { tipo: 'ergogenico' } | { tipo: 'salvar' } | { tipo: 'refeicao' } | { tipo: 'salvarRefeicao'; indice: number } | { tipo: 'compras' };

/**
 * Editor do plano de dieta, no formato dos PDFs do Saraiva. Os valores dos itens vêm da
 * biblioteca e são gravados no item; o total do dia soma só a opção A de cada refeição. Suplementação é texto livre (nome e link podem vir da biblioteca de suplementos).
 * "Lista de compras" abre a prévia da lista do aluno sobre o que está na tela (`FolhaListaDeCompras`).
 * Com 960 px de conteúdo (como o treino, `TelaDoEditor colunas`), as refeições viram uma lista à esquerda e a escolhida
 * abre inteira à direita (inspetor); abaixo disso, os cartões empilhados que abrem e fecham. O modelo de uma refeição só
 * fica sempre empilhado.
 */
export default function EditorDeDieta({ modelo = false, unica = false, receita }: { modelo?: boolean; unica?: boolean; receita?: Receita }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { avisar } = useAviso();
  const editor = usePlanoEditor<ConteudoDieta>('dieta', id, normalizarDieta, modelo);
  const nomeDoAluno = useNomeDoAluno(modelo ? null : editor.estado?.plano.alunoId);
  const alimentos = useCarregar('biblioteca-alimentos', () => listarAlimentos()).dados ?? [];
  const { pode } = useSessao();
  // Sem BIBLIOTECA_LER a API recusa a lista: nem pede, e o botão "Escolher da biblioteca" some.
  const veBiblioteca = pode('BIBLIOTECA_LER');
  const suplementosDaBiblioteca = useCarregar(veBiblioteca ? 'biblioteca-suplementos' : null, () => listarSuplementos()).dados ?? [];
  // Medicação e ergogênicos é dado sensível: sem ERGOGENICO_LER a lista nem é pedida; modelos nunca a levam.
  const veErgogenicos = !modelo && pode('ERGOGENICO_LER');
  const editaErgogenicos = veErgogenicos && pode('ERGOGENICO_ALTERAR');
  const ergogenicosDaBiblioteca = useCarregar(veErgogenicos && editaErgogenicos ? 'biblioteca-ergogenicos' : null, () => listarErgogenicos()).dados ?? [];
  const porId = new Map<string, Alimento>(alimentos.map((a) => [a.id, a]));
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  // Refeição do inspetor (duas colunas); a que sumiu da lista (desfazer, modelo aplicado) cai na primeira.
  const [escolhidaUid, setEscolhidaUid] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<ResultadoValidacao | null>(null);
  const [folha, setFolha] = useState<FolhaAberta | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazer<ConteudoDieta> | null>(null);
  const [modelos, setModelos] = useState(false);
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
  const comDesfazer = (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta) => {
    setDesfazer({ rotulo, conteudo: c });
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
  /** Abre (empilhado) e escolhe (duas colunas) a refeição do primeiro item sem valor; a rolagem é do `TotalDoDia`. */
  const abrirRefeicao = (uid: string) => { setEscolhidaUid(uid); setAbertas((a) => new Set(a).add(uid)); };

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
      {modelo ? <FaixaDoModelo /> : <FaixaDoPlanoDoAluno tipo="dieta" />}
      {modelo ? null : <CartaoCicloNoPeriodo alunoId={estado.plano.alunoId} inicio={estado.plano.inicio} fim={estado.plano.fim} />}
      {modelo ? <NomeDoModelo editor={editor} /> : <ProblemasDoPlano editor={editor} problemas={problemas} aoProblemas={setProblemas}
        aoIrAoPrimeiro={(uids) => {
          const comProblema = c.refeicoes.filter((r) => uids.includes(r.uid)).map((r) => r.uid);
          if (comProblema[0]) setEscolhidaUid(comProblema[0]);
          setAbertas((a) => new Set([...a, ...comProblema]));
        }} />}
      {desfazer ? (
        <BarraDesfazer
          desfazer={desfazer}
          aoDesfazer={() => {
            const anterior = desfazer.conteudo;
            setDesfazer(null);
            editor.alterarConteudo(() => anterior);
          }}
          aoFechar={() => setDesfazer(null)}
        />
      ) : null}
      <TotalDoDia conteudo={c} semValor={semValor} aoAbrirRefeicao={abrirRefeicao} aoMudarAgua={unica ? undefined : (aguaLitros) => mudar({ aguaLitros })} />
      {unica ? null : <ConfiguracaoDoPlano
        editor={editor}
        modelo={modelo}
        recolhido={c.refeicoes.length > 0 && estado.titulo.trim() !== ''}
        descricao="Título, período, objetivo e profissional da dieta.">
        <CamposDaDieta conteudo={c} aoMudar={mudar} />
      </ConfiguracaoDoPlano>}
      <ComColunas>{(duas) => {
        const cartao = (r: ConteudoDieta['refeicoes'][number], ri: number, noInspetor: boolean) => (
          <CartaoRefeicao
            key={r.uid}
            refeicao={r}
            posicao={ri}
            total={c.refeicoes.length}
            aberta={noInspetor || abertas.has(r.uid)}
            comProblema={comErro}
            alimentos={porId}
            aoAbrir={noInspetor ? undefined : () => alternar(r.uid)}
            aoMudar={(nova) => mudarRefeicoes((lista) => substituir(lista, ri, nova))}
            aoMover={(d) => mudarRefeicoes((lista) => mover(lista, ri, d))}
            removivel={!unica}
            aoRemover={() => {
              const depois = remover(c.refeicoes, ri);
              setEscolhidaUid(proximaSelecao(c.refeicoes.map((x) => x.uid), depois.map((x) => x.uid), escolhida?.uid ?? null));
              comDesfazer(`Refeição “${r.nome || ri + 1}” removida.`, (a) => ({ ...a, refeicoes: remover(a.refeicoes, ri) }));
            }}
            aoSalvarModelo={unica ? undefined : () => setFolha({ tipo: 'salvarRefeicao', indice: ri })}
            aoEscolherAlimento={(opcao) => setFolha({ tipo: 'alimento', refeicao: ri, opcao })}
          />
        );
        const adicionarRefeicao = <Botao rotulo="Adicionar refeição" tipo="secundario" Icone={Plus} aoTocar={() => {
          const nova = novaRefeicao();
          mudarRefeicoes((r) => [...r, nova]);
          setAbertas((a) => new Set(a).add(nova.uid));
          setEscolhidaUid(nova.uid);
        }} />;
        return <>
          <View style={estilos.cabecalhoRefeicoes}>
            <Texto variante="bloco" nivel={2}>Refeições ({c.refeicoes.length})</Texto>
            {/* Em duas colunas a escolhida já está aberta: não há o que abrir todas. */}
            {!duas && c.refeicoes.length > 1 ? (
              <Botao
                rotulo={todasAbertas ? 'Fechar todas' : 'Abrir todas'}
                tipo="fantasma"
                Icone={todasAbertas ? ChevronsDownUp : ChevronsUpDown}
                aoTocar={() => setAbertas(todasAbertas ? new Set() : new Set(c.refeicoes.map((r) => r.uid)))}
              />
            ) : null}
          </View>
          {/* Em 390 px os quatro botões não cabiam numa linha e "Lista de compras" e "Abrir todas" saíam cortados. */}
          <LinhaDeAcoes>
            {/* Em duas colunas o botão fica só no pé da lista; em uma coluna, ou sem refeição escolhida, fica aqui. */}
            {unica || (duas && escolhida) ? null : adicionarRefeicao}
            {unica ? null : <Botao rotulo="Modelos" tipo="secundario" Icone={NotebookTabs} aoTocar={() => setModelos(true)} />}
            <Botao
              rotulo="Lista de compras"
              tipo="secundario"
              Icone={ShoppingCart}
              desabilitado={c.refeicoes.length === 0}
              motivo="Adicione uma refeição primeiro."
              aoTocar={() => setFolha({ tipo: 'compras' })}
            />
          </LinhaDeAcoes>
          {c.refeicoes.length === 0 ? <Vazio texto="Nenhuma refeição ainda. Adicione uma ou comece de um modelo." /> : null}
          {/* Modelo de uma refeição só: nunca em duas colunas (a lista teria um item), a refeição abre em largura total. */}
          {!unica && duas && escolhida ? (
            <View style={estilos.colunas}>
              <View style={estilos.lista}>
                <View style={estilos.itensDaLista} role="group" accessibilityLabel="Refeições do plano">
                  {c.refeicoes.map((r, ri) => {
                    const titulo = tituloDaRefeicao(r, ri);
                    const resumo = resumoDaRefeicao(r);
                    const problema = comErro.has(r.uid);
                    return (
                      <ItemDaListaDoEditor key={r.uid} numero={ri + 1} titulo={titulo} linha={resumo} escolhido={r.uid === escolhida.uid}
                        comProblema={problema} selo={problema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
                        rotulo={`Refeição ${ri + 1} de ${c.refeicoes.length}: ${titulo}${problema ? ', corrigir' : ''}. ${resumo}`}
                        aoEscolher={() => setEscolhidaUid(r.uid)} />
                    );
                  })}
                </View>
                {/* No pé da lista, como "Adicionar seção" na mobilidade e "Adicionar próximo exercício" no treino. */}
                <View style={estilos.acoes}>{adicionarRefeicao}</View>
              </View>
              <View style={estilos.inspetor}>{cartao(escolhida, c.refeicoes.indexOf(escolhida), true)}</View>
            </View>
          ) : c.refeicoes.map((r, ri) => cartao(r, ri, unica))}
        </>;
      }}</ComColunas>
      {/* Modelo de uma refeição só: os complementos seriam descartados ao aplicar o modelo numa dieta. */}
      {unica ? null : (
        <ComplementosDaDieta conteudo={c} aoMudar={mudar} comDesfazer={comDesfazer} porcoes={porcoes} veBiblioteca={veBiblioteca}
          veErgogenicos={veErgogenicos} editaErgogenicos={editaErgogenicos}
          aoEscolherSuplemento={() => setFolha({ tipo: 'suplemento' })} aoEscolherErgogenico={() => setFolha({ tipo: 'ergogenico' })} />
      )}

      {modelos ? (
        <Folha visivel titulo="Modelos" aoFechar={() => setModelos(false)}>
          <OpcaoDeModelo titulo="Usar modelo de dieta" descricao="Troca as refeições do plano pelas do modelo (orientações, observações e suplementação ficam). Dá para desfazer." desabilitado={unica} aoEscolher={() => { setModelos(false); setFolha({ tipo: 'receita' }); }} />
          <OpcaoDeModelo titulo="Adicionar refeição" descricao="Acrescenta ao plano as refeições de um modelo de refeição." desabilitado={unica} aoEscolher={() => { setModelos(false); setFolha({ tipo: 'refeicao' }); }} />
          {!modelo && c.refeicoes.length ? <OpcaoDeModelo titulo={rotuloSalvarComo('PLANO_DIETA')} descricao="Guarda as refeições, opções e itens deste rascunho para reutilizar. O plano continua igual." aoEscolher={() => { setModelos(false); setFolha({ tipo: 'salvar' }); }} /> : null}
        </Folha>
      ) : null}

      {folha?.tipo === 'compras' ? (
        <FolhaListaDeCompras conteudo={c} titulo={estado.titulo} aluno={modelo ? null : nomeDoAluno} aoFechar={() => setFolha(null)} />
      ) : null}
      {folha?.tipo === 'refeicao' ? <FolhaReceitas tipo="REFEICAO" titulo="Adicionar refeição" aoFechar={() => setFolha(null)} aoUsar={(r) => {
        setFolha(null); comDesfazer('Refeição adicionada.', (a) => ({ ...a, refeicoes: [...a.refeicoes, ...aplicarReceitaDeDieta(normalizarDieta(null), r.conteudo).refeicoes] }));
      }} /> : null}
      {folha?.tipo === 'salvarRefeicao' ? <FolhaSalvarReceita titulo={rotuloSalvarComo('REFEICAO')} aoFechar={() => setFolha(null)} aoSalvar={async (nome, descricao) => {
        await criarReceita({ tipo: 'REFEICAO', nome, descricao, conteudo: { ...normalizarDieta(null), refeicoes: [c.refeicoes[folha.indice]] } });
        setFolha(null); avisar(avisoModeloSalvo('REFEICAO'), 'sucesso');
      }} /> : null}
      {folha?.tipo === 'alimento' ? (
        <FolhaAlimentos
          alimentos={alimentos}
          aoFechar={() => setFolha(null)}
          aoEscolher={(alimento) => {
            const { refeicao: ri, opcao: oi } = folha;
            setFolha(null);
            mudarRefeicoes((lista) => {
              const r = lista[ri];
              const o = r?.opcoes[oi];
              if (!o) return lista;
              return substituir(lista, ri, { ...r, opcoes: substituir(r.opcoes, oi, { ...o, itens: [...o.itens, novoItem(alimento)] }) });
            });
          }}
        />
      ) : null}
      {folha?.tipo === 'suplemento' ? (
        <FolhaSuplementos
          suplementos={suplementosDaBiblioteca}
          aoFechar={() => setFolha(null)}
          aoEscolher={(s) => {
            setFolha(null);
            const linha = linhaDeSuplementacao(s, novoUid());
            const porcao = descricaoDaPorcao(s);
            if (porcao !== SEM_DADO) setPorcoes((atual) => ({ ...atual, [linha.uid]: porcao }));
            mudar({ suplementacao: [...c.suplementacao, linha] });
          }}
        />
      ) : null}
      {folha?.tipo === 'ergogenico' ? (
        <FolhaErgogenicos
          itens={ergogenicosDaBiblioteca}
          aoFechar={() => setFolha(null)}
          aoEscolher={(e) => {
            setFolha(null);
            mudar({ ergogenicos: [...(c.ergogenicos ?? []), linhaDeErgogenico(e, novoUid())] });
          }}
        />
      ) : null}
      {folha?.tipo === 'receita' ? (
        <FolhaReceitas
          tipo="PLANO_DIETA"
          titulo="Modelo de dieta"
          explicacao="As refeições do plano são trocadas pelas do modelo (orientações, observações e suplementação ficam). Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            setFolha(null);
            comDesfazer(`Modelo “${r.nome}” aplicado.`, (a) => aplicarReceitaDeDieta(a, r.conteudo));
          }}
        />
      ) : null}
      {folha?.tipo === 'salvar' && id ? (
        <FolhaSalvarReceita
          titulo={rotuloSalvarComo('PLANO_DIETA')}
          explicacao="Guarda as refeições, opções e itens do rascunho como modelo de dieta no Planejamento. O plano continua igual."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            if (!(await editor.salvar())) throw new Error('Não deu para salvar o rascunho antes.');
            await salvarPlanoComoReceita('dieta', id, nome, descricao);
            setFolha(null);
            avisar(avisoModeloSalvo('PLANO_DIETA'), 'sucesso');
          }}
        />
      ) : null}
    </TelaDoEditor>
  );
}

/**
 * "Total do dia" (opção A de cada refeição): kcal em destaque, macros com o nome por extenso ("Proteína —" sem
 * unidade quando falta valor), a água por dia e, se algum item deixa o total incompleto, quantos são e um atalho
 * para o primeiro (antes só aparecia "— g de proteína" sem dizer por quê). A água é editada aqui, sempre à vista: dentro
 * da "Configuração do plano", que fecha sozinha quando a dieta já tem refeições, o treinador não a encontrava (30/10).
 * Modelo de uma refeição só não tem água.
 */
function TotalDoDia({ conteudo: c, semValor, aoAbrirRefeicao, aoMudarAgua }: {
  conteudo: ConteudoDieta; semValor: ItemSemValor[]; aoAbrirRefeicao: (uid: string) => void; aoMudarAgua?: (litros: number | null) => void;
}) {
  const { rolarAte } = useRolagem();
  const t = totalDoDia(c);
  const primeiro = semValor[0];
  return (
    <Cartao faixa titulo="Total do dia" descricao="Soma da opção A de cada refeição.">
      <Texto variante="destaque" numerico>{t.kcal === null ? 'kcal —' : `${numeroParaTela(t.kcal, 0)} kcal`}</Texto>
      <Texto numerico>
        {[textoDoMacro('Proteína', t.proteina, 'g'), textoDoMacro('Carboidrato', t.carboidrato, 'g'), textoDoMacro('Gordura', t.gordura, 'g')].join(' · ')}
      </Texto>
      {aoMudarAgua ? (
        <View style={estilos.campoSup}>
          <CampoNumerico
            rotulo="Água por dia (opcional)"
            sufixo="L"
            valor={c.aguaLitros ?? null}
            aoMudar={aoMudarAgua}
            erro={aguaValida(c.aguaLitros ?? null) ? null : `De ${numeroParaTela(AGUA_MINIMA)} a ${AGUA_MAXIMA} L, com uma casa decimal.`}
            ajuda="Quantos litros o aluno deve tomar por dia. Aparece no início e na dieta dele. Vazio não aparece."
          />
        </View>
      ) : null}
      {primeiro ? (
        <View style={estilos.semValor}>
          <Incompleto texto={textoItensSemValor(semValor.length)} />
          <Botao rotulo="Ir ao primeiro" rotuloAcessivel={`Ir ao primeiro item sem valor: ${primeiro.nome || 'sem nome'}`} tipo="fantasma"
            aoTocar={() => { aoAbrirRefeicao(primeiro.refeicaoUid); rolarAte([primeiro.refeicaoUid]); }} />
        </View>
      ) : null}
    </Cartao>
  );
}

/** Objetivo, data de início e profissional (como no topo do PDF do Saraiva). A água fica no "Total do dia". */
function CamposDaDieta({ conteudo, aoMudar }: { conteudo: ConteudoDieta; aoMudar: (p: Partial<ConteudoDieta>) => void }) {
  const [inicio, setInicio] = useState(dataParaTela(conteudo.dataInicio));
  return (
    <>
      <Campo rotulo="Objetivo (opcional)" valor={conteudo.objetivo ?? ''} aoMudar={(t) => aoMudar({ objetivo: t || null })} maxLength={200} />
      <View style={estilos.grade}>
        <View style={estilos.campoSup}>
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

/** Linha de ação da folha "Modelos": título, o que faz e um toque para escolher. */
function OpcaoDeModelo({ titulo, descricao, desabilitado, aoEscolher }: { titulo: string; descricao: string; desabilitado?: boolean; aoEscolher: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      disabled={desabilitado}
      onPress={aoEscolher}
      style={({ pressed }) => [
        estilos.opcaoModelo,
        { backgroundColor: desabilitado ? coresDoDesabilitado(cores).fundo : pressed ? cores.superficie3 : cores.superficie2, borderColor: cores.borda },
      ]}>
      <Texto variante="bloco" cor={desabilitado ? cores.textoSuave : undefined}>{titulo}</Texto>
      <Texto variante="suave">{descricao}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  // Lista (mestre) estreita: em 1280 o inspetor fica com uns 700 px e duas opções da refeição cabem lado a lado.
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  lista: { width: 280, flexShrink: 0, gap: espaco(1.5) },
  itensDaLista: { gap: espaco(1) },
  inspetor: { flex: 1, minWidth: 0 },
  cabecalhoRefeicoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), marginBottom: -espaco(1.5) },
  // Coluna: o aviso de item sem valor ocupa a linha toda (em 390 px cortava ao lado do botão).
  semValor: { gap: espaco(0.5), alignItems: 'flex-start' },
  opcaoModelo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: 4, minHeight: 56 },
  cresce: { flex: 1, gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campoSup: { minWidth: 190, flex: 1 },
});
