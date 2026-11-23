import { ArrowLeftRight, Ellipsis, GripVertical, PencilLine, Plus, Trash2, TriangleAlert } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { Alimento, ItemDieta, OpcaoRefeicao, Refeicao, UnidadeAlimento } from '../../api/tipos';
import {
  erroDaFibra,
  MODO_DE_PREPARO_MAXIMO,
  modoDePreparoValido,
  novaOpcao,
  novoItem,
  recalcularItem,
  semConversao,
  somar,
  type TotaisComFibra,
} from '../../dominio/dieta';
import { corDaRefeicao } from '../../dominio/corDaSerie';
import { remover, substituir } from '../../dominio/editorTreino';
import { proximaSelecao } from '../../dominio/inspetorDoTreino';
import { abaComProblema, chaveDosProblemas, gramasSemUnidade, MAXIMO_DE_OPCOES, MOTIVO_NO_LIMITE_DE_OPCOES } from '../../dominio/opcoesDaRefeicao';
import { moverPara } from '../../dominio/reordenar';
import { numeroParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_EDITOR, RAIO_CONTROLE } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { AlcaDeArraste, ItemArrastavel, LARGURA_DA_ALCA as LARGURA_DA_PECA, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Divisor } from '../../ui/Divisor';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { NumeroInvertido } from '../../ui/NumeroInvertido';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { CampoDoMacro, FIBRA, fibraParcial, kcalNaTela, MACROS, MarcaDoMacro, TotalParaLeitor, ValoresDaDieta, type ValoresComFibra } from '../../ui/ValoresDaDieta';
import { UNIDADES } from '../biblioteca/AbaAlimentos';
import { acoesDeMover } from '../acoesDeMover';
import { type AcaoDoMenu, FolhaDeAcoes } from '../FolhaDeAcoes';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { BotaoDeTexto } from '../treino/BotaoDeAbrir';
import { rotuloSalvarComo } from '../planejamento/modelos';
import { AbasDeOpcao } from './AbasDeOpcao';
import { CampoDaQuantidade } from './CampoDaQuantidade';
import { type ColunasDaTabela, ComparacaoDasOpcoes } from './ComparacaoDasOpcoes';

/** Id no DOM (web) do cartão da refeição: `mostrarAbaixoDaBarra` rola até ele ao adicionar uma refeição. */
export const idDaRefeicao = (uid: string) => `refeicao-${uid}`;

/** "Almoço · 12:00" no título do cartão e do item da lista: "12:00 · Almoço" ("Refeição N" sem nome). */
export function tituloDaRefeicao(r: Refeicao, posicao: number): string {
  return `${r.horario ? `${r.horario} · ` : ''}${r.nome || `Refeição ${posicao + 1}`}`;
}

/** "3 itens · 2 opções": os itens são os da opção A. */
export function contagemDaRefeicao(r: Refeicao): string {
  const nItens = r.opcoes[0]?.itens.length ?? 0;
  return `${nItens} ${nItens === 1 ? 'item' : 'itens'}${r.opcoes.length > 1 ? ` · ${r.opcoes.length} opções` : ''}`;
}

/** "540 kcal · 3 itens · 2 opções" (lista do inspetor, que é estreita): o total e os itens são os da opção A ("—" sem valor). */
export function resumoDaRefeicao(r: Refeicao): string {
  const totalA = somar(r.opcoes[0]?.itens ?? []);
  return `${totalA.kcal === null ? '—' : numeroParaTela(totalA.kcal, 0)} kcal · ${contagemDaRefeicao(r)}`;
}

/** Barra lateral do cartão na cor da refeição (C63), a mesma largura da dieta do aluno; o resto do cartão fica neutro (Dose de cor). */
const BARRA_DA_REFEICAO = 6;

interface Props {
  refeicao: Refeicao;
  posicao: number;
  total: number;
  aberta: boolean;
  comProblema: Set<string>;
  alimentos: Map<string, Alimento>;
  /** Sem ele, a refeição fica sempre aberta (inspetor do editor em duas colunas, modelo de uma refeição só). */
  aoAbrir?: () => void;
  aoMudar: (r: Refeicao) => void;
  /** Ao sair do campo Nome: o editor preenche "Refeição N" se ele ficou vazio. */
  aoSairDoNome?: () => void;
  /** Remove a opção com "Desfazer" (leva os itens dela junto). */
  aoRemoverOpcao: (indice: number) => void;
  aoRemoverItem?: (opcaoIndice: number, itemIndice: number, nomeItem: string) => void;
  /**
   * O "Desfazer" da opção ou do alimento removido (empilhado, para ficar à vista): o da opção logo acima da opção aberta,
   * embaixo das abas, onde ficava o "Excluir opção" tocado; o do alimento depois da lista (`avisoDoAlimento`).
   */
  aviso?: ReactNode;
  /** O aviso é do alimento removido: fica depois da opção aberta, perto da lista (o da opção fica acima dela). */
  avisoDoAlimento?: boolean;
  aoMover: (delta: -1 | 1) => void;
  /** Lixeira no cabeçalho; sem ele, a refeição não se remove (modelo de uma refeição só). */
  aoRemover?: () => void;
  aoSalvarModelo?: () => void;
  /** Abre a escolha de alimento; o item entra na opção indicada. */
  aoEscolherAlimento: (opcao: number) => void;
  /** "Trocar alimento" de um item da biblioteca (C56): abre a escolha para o item `uid`. */
  aoTrocarAlimento?: (uid: string) => void;
}

/**
 * Refeição: o cabeçalho (posição, título, um selo, ↑↓ e a lixeira com o nome), os dados dela (nome, horário, observação,
 * modo de preparo) e as opções (A, B...) com os itens e o total de cada uma. As opções são alternativas (o aluno escolhe
 * uma; o total do dia usa só a primeira). Opções em abas (19/11): com duas ou mais, a comparação dos totais, as abas
 * (`AbasDeOpcao`) e a opção aberta na largura toda; com uma só, nada de abas, só o "+ Opção" discreto. Duas molduras no
 * máximo (S4 de `editor-treino-inspetor.md`): a refeição e o item; a opção é o painel da aba, sem caixa. Nada é
 * calculado entre as opções: cada uma mostra o próprio total.
 */
export function CartaoRefeicao(p: Props) {
  const { cores, identificacao } = useTema();
  // A cor diz qual refeição é (pela posição na seção aberta: na dieta por dia, dentro da variação), nunca status.
  const corDaBarra = identificacao?.[corDaRefeicao(p.posicao)]?.cor;
  const r = p.refeicao;
  const [largura, setLargura] = useState(0);
  const mudar = (parcial: Partial<Refeicao>) => p.aoMudar({ ...r, ...parcial });
  // A aba aberta é estado da tela; a que sumiu (excluída, desfeita, modelo aplicado) cai na primeira.
  const [abertaUid, setAbertaUid] = useState<string | null>(null);
  const aberta = r.opcoes.find((o) => o.uid === abertaUid) ?? r.opcoes[0];
  // Problemas novos da validação: a opção com erro abre sozinha, para ele não ficar escondido atrás de uma aba fechada.
  // Pela chave (o conjunto chega outro a cada desenho), então digitar ou validar de novo com os mesmos erros não muda a aba.
  // Começa vazia: a refeição que abre já com erro (o "Ir ao primeiro" monta o cartão no inspetor) também vai à opção dele.
  const chaveDeProblemas = chaveDosProblemas(r.opcoes, p.comProblema);
  const [problemasVistos, setProblemasVistos] = useState('');
  if (chaveDeProblemas !== problemasVistos) {
    setProblemasVistos(chaveDeProblemas);
    if (aberta) setAbertaUid(abaComProblema(r.opcoes, aberta.uid, p.comProblema));
  }
  // Foco depois de criar ou excluir uma opção: na aba dela (ou no "+ Opção" quando as abas somem). O botão que a pessoa
  // tocou muda de lugar ou some, e sem isto o foco cairia no fim da página. Na web, depois do diálogo devolver o foco.
  const alvosDoFoco = useRef(new Map<string, View | null>());
  const focoPendente = useRef<string | null>(null);
  useEffect(() => {
    const alvo = focoPendente.current;
    if (!alvo || Platform.OS !== 'web') return;
    const espera = setTimeout(() => { focoPendente.current = null; alvosDoFoco.current.get(alvo)?.focus(); }, 0);
    return () => clearTimeout(espera);
  });
  const [confirmarExclusao, setConfirmarExclusao] = useState<OpcaoRefeicao | null>(null);
  const mudarItens = (indice: number, fn: (itens: ItemDieta[]) => ItemDieta[]) =>
    mudar({ opcoes: substituir(r.opcoes, indice, { ...r.opcoes[indice], itens: fn(r.opcoes[indice].itens) }) });
  const modoDePreparo = r.modoDePreparo ?? '';
  // Observação e modo de preparo ficam recolhidos num link, também com texto gravado (regra de 18/11: nasce fechado); o
  // toque abre e não volta a fechar, para os campos não sumirem enquanto a pessoa digita. Só o modo de preparo acima do
  // limite (erro apontado por "ir ao primeiro") os abre, para o erro aparecer.
  const [extrasAbertos, setExtrasAbertos] = useState(false);
  const mostrarExtras = extrasAbertos || !modoDePreparoValido(modoDePreparo);
  const titulo = tituloDaRefeicao(r, p.posicao);
  const problema = p.comProblema.has(r.uid);
  const varias = r.opcoes.length > 1;
  const opcaoA = r.opcoes[0];
  // Arrastar (18/11): subir e descer a refeição saíram da faixa e foram para o ⋯ ("Mover para cima/baixo").
  const [menu, setMenu] = useState(false);
  const acoesDaRefeicao = acoesDeMover({ nome: titulo, posicao: p.posicao, total: p.total, aoMover: p.aoMover });
  // Subtotal da refeição (C66): a opção A, a que entra no "Total do dia", também com a refeição aberta.
  const rotuloDoSubtotal = varias ? `Subtotal da refeição, opção ${opcaoA?.rotulo}` : 'Subtotal da refeição';
  // O leitor ouve uma frase só (rótulo e os quatro valores por extenso); o que se vê fica escondido dele.
  const subtotal = opcaoA ? (
    <View role="group" aria-label={rotuloDoSubtotal}>
      <TotalParaLeitor rotulo={rotuloDoSubtotal} totais={somar(opcaoA.itens)} />
      <View aria-hidden style={estilos.subtotal}>
        {varias ? <Texto variante="pequeno">Opção {opcaoA.rotulo}:</Texto> : null}
        <ValoresDaDieta totais={somar(opcaoA.itens)} inicio />
      </View>
    </View>
  ) : undefined;

  // A opção nova abre selecionada, com o foco na aba dela.
  const adicionarOpcao = () => {
    const nova = novaOpcao(r.opcoes);
    mudar({ opcoes: [...r.opcoes, nova] });
    setAbertaUid(nova.uid);
    focoPendente.current = nova.uid;
  };
  // Excluir a aberta abre a vizinha (a da direita; sendo a última, a da esquerda), como a refeição removida no inspetor.
  const excluirOpcao = (o: OpcaoRefeicao) => {
    const depois = r.opcoes.filter((x) => x.uid !== o.uid);
    const proxima = proximaSelecao(r.opcoes.map((x) => x.uid), depois.map((x) => x.uid), o.uid);
    setAbertaUid(proxima);
    focoPendente.current = depois.length > 1 ? proxima : MAIS_OPCAO;
    p.aoRemoverOpcao(r.opcoes.indexOf(o));
  };
  const maisOpcao = (
    <Botao ref={(b) => { alvosDoFoco.current.set(MAIS_OPCAO, b); }} rotulo="Opção" rotuloAcessivel={`Adicionar opção em ${titulo}`} tipo="acao" Icone={Plus}
      aoTocar={adicionarOpcao} desabilitado={r.opcoes.length >= MAXIMO_DE_OPCOES} motivo={MOTIVO_NO_LIMITE_DE_OPCOES} />
  );
  const indiceAberto = aberta ? r.opcoes.indexOf(aberta) : -1;
  // `key`: o arraste, o ⋯ e a confirmação de cada opção não passam para a outra ao trocar de aba.
  const opcaoAberta = aberta ? (
    <OpcaoDaRefeicao
      key={aberta.uid}
      opcao={aberta}
      larguraDisponivel={largura}
      varias={varias}
      comProblema={p.comProblema}
      alimentos={p.alimentos}
      acao={varias ? (
        <Botao tipo="perigoTexto" rotulo="Excluir opção" rotuloAcessivel={`Excluir opção ${aberta.rotulo}`} Icone={Trash2}
          aoTocar={() => (aberta.itens.length ? setConfirmarExclusao(aberta) : excluirOpcao(aberta))} />
      ) : maisOpcao}
      aoMudarItens={(fn) => mudarItens(indiceAberto, fn)}
      aoEscolherAlimento={() => p.aoEscolherAlimento(indiceAberto)}
      aoTrocarAlimento={p.aoTrocarAlimento}
      aoRemoverItem={p.aoRemoverItem ? (ii, nome) => p.aoRemoverItem!(indiceAberto, ii, nome) : undefined}
    />
  ) : null;
  const itensDaExclusao = confirmarExclusao?.itens.length ?? 0;
  const avisoAcima = p.avisoDoAlimento ? null : p.aviso;

  return (
    <AlvoDeRolagem chave={r.uid}><View nativeID={idDaRefeicao(r.uid)}><Cartao
      style={[corDaBarra ? { borderLeftWidth: BARRA_DA_REFEICAO, borderLeftColor: corDaBarra } : null, problema ? { borderColor: cores.perigo } : null]}
      cabecalho={
        <CabecalhoDoItem
          faixa
          // A posição por extenso só no inspetor: empilhadas, a ordem já está à vista.
          contexto={p.aoAbrir ? undefined : `Refeição ${p.posicao + 1} de ${p.total}`}
          titulo={titulo}
          // Fechada, a contagem; os valores (kcal e P/C/G da opção A) ficam embaixo, aberta ou fechada.
          resumo={p.aberta ? undefined : contagemDaRefeicao(r)}
          detalhe={subtotal}
          selo={problema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
          aberto={p.aberta}
          aoAlternar={p.aoAbrir}
          nomeDoItem={titulo}
          remover={p.aoRemover || acoesDaRefeicao.length ? <>
            {p.aoRemover ? <Botao tipo="perigoTexto" rotulo="Excluir" rotuloAcessivel={`Remover ${titulo}`} Icone={Trash2} aoTocar={p.aoRemover} /> : null}
            {acoesDaRefeicao.length ? <IconeBotao Icone={Ellipsis} rotulo={`Mais ações de ${titulo}`} aoTocar={() => setMenu(true)} /> : null}
          </> : undefined}
        />
      }>
      {p.aberta ? (
        <View style={estilos.corpo}>
          {/* Os dados da refeição seguram a medida do editor (em 1920 px o inspetor passa de 1300 px); as opções usam a largura toda. */}
          <View style={estilos.dados}>
            <View style={estilos.linha}>
              <View style={estilos.nome}>
                <Campo rotulo="Nome" valor={r.nome} aoMudar={(nome) => mudar({ nome })} onBlur={p.aoSairDoNome} maxLength={80} placeholder="Ex.: Café da manhã" />
              </View>
              <View style={estilos.horario}>
                <Campo rotulo="Horário" valor={r.horario ?? ''} aoMudar={(t) => mudar({ horario: t || null })} maxLength={5} placeholder="07:00" />
              </View>
            </View>
            {mostrarExtras ? (
              <>
                <Campo rotulo="Observação (opcional)" valor={r.observacao ?? ''} aoMudar={(t) => mudar({ observacao: t || null })} linhas={2} maxLength={1000} />
                <Campo
                  rotulo="Modo de preparo (opcional)"
                  valor={modoDePreparo}
                  aoMudar={(t) => mudar({ modoDePreparo: t || null })}
                  linhas={4}
                  maxLength={MODO_DE_PREPARO_MAXIMO}
                  ajuda={`O aluno vê como você escrever, com as quebras de linha. Até ${numeroParaTela(MODO_DE_PREPARO_MAXIMO)} caracteres.`}
                  erro={modoDePreparoValido(modoDePreparo) ? null : `Até ${numeroParaTela(MODO_DE_PREPARO_MAXIMO)} caracteres.`}
                />
              </>
            ) : (
              <BotaoDeTexto texto="Observação ou modo de preparo (opcional)" Icone={Plus} aoTocar={() => setExtrasAbertos(true)} />
            )}
          </View>
          <Divisor />
          <View testID="opcoes-da-refeicao" style={estilos.opcoes} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
            {varias && aberta ? <>
              <ComparacaoDasOpcoes opcoes={r.opcoes} aberta={aberta.uid} aoAbrir={setAbertaUid}
                colunas={largura >= larguraDaTabela() ? COLUNAS_DA_COMPARACAO : undefined} />
              <AbasDeOpcao rotulo={`Opções de ${titulo}`} opcoes={r.opcoes} aberta={aberta.uid} comProblema={p.comProblema} aoAbrir={setAbertaUid}
                depois={maisOpcao} registrar={(uid, aba) => alvosDoFoco.current.set(uid, aba)}
                apoio={<>
                  <Texto variante="suave">Cada opção substitui a refeição inteira: o aluno escolhe uma.</Texto>
                  {avisoAcima}
                </>}>
                {opcaoAberta}
              </AbasDeOpcao>
            </> : <>{avisoAcima}{opcaoAberta}</>}
          </View>
          {p.avisoDoAlimento ? p.aviso : null}
          {p.aoSalvarModelo ? (
            <>
              <Divisor />
              <LinhaDeAcoes>
                <Botao rotulo={rotuloSalvarComo('REFEICAO')} rotuloAcessivel={`${rotuloSalvarComo('REFEICAO')}: ${titulo}`} tipo="fantasma" aoTocar={p.aoSalvarModelo} />
              </LinhaDeAcoes>
            </>
          ) : null}
        </View>
      ) : null}
    </Cartao>
    {menu ? <FolhaDeAcoes titulo={titulo} aoFechar={() => setMenu(false)} acoes={acoesDaRefeicao} /> : null}
    <PainelConfirmacao
      visivel={!!confirmarExclusao}
      titulo={`Excluir a opção ${confirmarExclusao?.rotulo ?? ''}?`}
      mensagem={`${itensDaExclusao === 1 ? 'O alimento dela sai' : `Os ${itensDaExclusao} alimentos dela saem`} junto. Dá para desfazer logo depois.`}
      rotuloConfirmar="Excluir opção"
      perigo
      aoConfirmar={() => {
        const o = confirmarExclusao;
        setConfirmarExclusao(null);
        if (o) excluirOpcao(o);
      }}
      aoCancelar={() => setConfirmarExclusao(null)}
    />
    </View></AlvoDeRolagem>
  );
}

/** Alvo do foco do "+ Opção" (as outras chaves são os uids das opções). */
const MAIS_OPCAO = 'mais-opcao';

/**
 * A opção aberta: "Alimentos (N)" com a ação do cabeçalho (o "Excluir opção" com várias, o "+ Opção" com uma só), os
 * itens, o total da opção ("—" no que faltar, alinhado às colunas na tabela) e os botões de adicionar.
 */
function OpcaoDaRefeicao({
  opcao,
  larguraDisponivel,
  varias,
  comProblema,
  alimentos,
  acao,
  aoMudarItens,
  aoEscolherAlimento,
  aoTrocarAlimento,
  aoRemoverItem,
}: {
  opcao: OpcaoRefeicao;
  /** Largura medida da opção (a do editor, sem colunas): decide entre a tabela e o item empilhado. */
  larguraDisponivel: number;
  varias: boolean;
  comProblema: Set<string>;
  alimentos: Map<string, Alimento>;
  acao: ReactNode;
  aoMudarItens: (fn: (itens: ItemDieta[]) => ItemDieta[]) => void;
  aoEscolherAlimento: () => void;
  aoTrocarAlimento?: (uid: string) => void;
  aoRemoverItem?: (itemIndice: number, nomeItem: string) => void;
}) {
  const { cores } = useTema();
  // Com várias opções, o nome acessível diz a qual delas o botão serve (o texto visível é o mesmo em cada aba).
  const naOpcao = varias ? ` na opção ${opcao.rotulo}` : '';
  const modo: ModoDoItem = larguraDisponivel >= larguraDaTabela() ? 'tabela' : 'empilhado';
  const larguraDasAcoes = ACOES_RESERVADAS * ALVO_TOQUE;
  const rotuloDoTotal = `Total da opção ${opcao.rotulo}`;
  const totais = somar(opcao.itens);
  // Arrastar o alimento pela alça (18/11): a mesma regra da seta, de uma casa em uma (`moverPara`).
  const arraste = useArrasteDaLista({ total: opcao.itens.length, folga: 3, aoSoltar: (de, para) => aoMudarItens((itens) => moverPara(itens, de, para)) });
  return (
    <View style={estilos.opcao}>
      <View style={estilos.tituloDaOpcao}>
        <Texto variante="secao" style={estilos.cresce}>Alimentos ({opcao.itens.length})</Texto>
        {acao}
      </View>
      {opcao.itens.length === 0 ? <Texto variante="suave">Nenhum alimento nesta opção ainda. Adicione um da biblioteca ou um item manual.</Texto> : (
        <View style={estilos.itens}>
          {modo === 'tabela' ? <CabecalhoDosItens larguraDasAcoes={larguraDasAcoes} /> : null}
          {opcao.itens.map((item, ii) => (
            <ItemArrastavel key={item.uid} arraste={arraste} indice={ii}><LinhaItem
              // Com um item só a alça aparece desativada: o nome começa sempre no mesmo lugar.
              alca={opcao.itens.length > 1 ? <AlcaDeArraste arraste={arraste} indice={ii} /> : <AlcaDesativada />}
              modo={modo}
              larguraDasAcoes={larguraDasAcoes}
              item={item}
              posicao={ii}
              total={opcao.itens.length}
              comProblema={comProblema.has(item.uid)}
              alimento={item.alimentoId ? alimentos.get(item.alimentoId) : undefined}
              aoMudar={(novo) => aoMudarItens((itens) => substituir(itens, ii, recalcularItem(novo, novo.alimentoId ? alimentos.get(novo.alimentoId) : undefined)))}
              aoRemover={() => (aoRemoverItem ? aoRemoverItem(ii, item.nome || `Item ${ii + 1}`) : aoMudarItens((itens) => remover(itens, ii)))}
              aoMover={(d) => aoMudarItens((itens) => moverPara(itens, ii, ii + d))}
              aoTrocar={aoTrocarAlimento && !item.manual ? () => aoTrocarAlimento(item.uid) : undefined}
            /></ItemArrastavel>
          ))}
        </View>
      )}
      {/* Total separado dos itens por um fio suave. Na tabela, cada número embaixo da coluna dele; empilhado, o nome à
          esquerda e os números à direita (guia pág. 10). O leitor ouve uma frase só. Opção vazia não tem total (seria "0 kcal"). */}
      {opcao.itens.length === 0 ? null : <View role="group" aria-label={rotuloDoTotal} style={[estilos.total, { borderTopColor: cores.divisor }]}>
        <TotalParaLeitor rotulo={rotuloDoTotal} totais={totais} />
        {modo === 'tabela' ? <TotalNaTabela rotulo={rotuloDoTotal} totais={totais} larguraDasAcoes={larguraDasAcoes} /> : <>
          <Texto variante="rotulo" cor={cores.texto} aria-hidden>{rotuloDoTotal}</Texto>
          <View style={estilos.cresce} aria-hidden><ValoresDaDieta totais={totais} forte /></View>
        </>}
      </View>}
      <LinhaDeAcoes>
        <Botao rotulo="Adicionar alimento" rotuloAcessivel={`Adicionar alimento${naOpcao}`} tipo="acao" Icone={Plus} aoTocar={aoEscolherAlimento} />
        <Botao rotulo="Item manual" rotuloAcessivel={`Item manual${naOpcao}`} tipo="secundario" Icone={PencilLine} aoTocar={() => aoMudarItens((itens) => [...itens, novoItem()])} />
      </LinhaDeAcoes>
    </View>
  );
}

/** Os números do item que podem virar coluna (os do total que o item também tem): a fibra (V089) é a última coluna: opcional, com a marca própria, fora da kcal. */
type ChaveDoValor = Extract<keyof TotaisComFibra, keyof ItemDieta>;
type ModoDoItem = 'tabela' | 'empilhado';
/**
 * O nome nunca fica mais estreito que isto na tabela: abaixo, a opção volta ao item empilhado. É a largura do "Trocar
 * alimento" embaixo dele (139 px, medida em 20/11); o nome mais longo corta com reticências e fica inteiro na dica.
 */
const LARGURA_MINIMA_DO_NOME = 140;

/**
 * Colunas da tabela de itens da opção (dieta em tabela, 18/11; em 1280 desde 20/11): o cabeçalho, a linha e a largura
 * mínima da tabela leem daqui, então uma coluna nova é uma linha a mais. `largura` é fixa, menos a do `nome`, que é o
 * mínimo dela (estica). `valor` liga a coluna ao número do item. A `alca` é o encaixe da alça de arrastar: com largura 0
 * não aparece; com largura, vira a primeira célula da faixa, nos dois modos, e mostra a prop `alca` da `LinhaItem`.
 * Quantidade e unidade são um campo só ("50 g ▾", 100 px: cabe "1.000"). Os números vão sem o "g", que está no título
 * da coluna (como na comparação): "126,5" e "1.234" cabem em 48 na fonte numérica; a fibra tem 56 para o título
 * "Fibras (g)" quebrar em duas linhas ao lado da marca.
 */
const COLUNAS_DO_ITEM: readonly { chave: string; rotulo: string; largura: number; valor?: ChaveDoValor }[] = [
  { chave: 'alca', rotulo: '', largura: LARGURA_DA_PECA },
  { chave: 'numero', rotulo: '#', largura: 28 },
  { chave: 'nome', rotulo: 'Alimento', largura: LARGURA_MINIMA_DO_NOME },
  { chave: 'quantidade', rotulo: 'Quantidade', largura: 100 },
  { chave: 'kcal', rotulo: 'Kcal', largura: 48, valor: 'kcal' },
  { chave: 'proteina', rotulo: 'P (g)', largura: 48, valor: 'proteina' },
  { chave: 'carboidrato', rotulo: 'C (g)', largura: 48, valor: 'carboidrato' },
  { chave: 'gordura', rotulo: 'G (g)', largura: 48, valor: 'gordura' },
  { chave: 'fibra', rotulo: 'Fibras (g)', largura: 56, valor: 'fibra' },
];
const COLUNAS = COLUNAS_DO_ITEM.filter((c) => c.largura > 0);
const COLUNAS_DE_VALOR = COLUNAS.filter((c) => c.valor);
const PARES_DE_VALOR = COLUNAS_DE_VALOR.flatMap((c, i, todas) => (i % 2 === 0 ? [todas.slice(i, i + 2)] : []));
const LARGURA_DA_ALCA = COLUNAS_DO_ITEM[0].largura;
const VAO_DA_TABELA = 6;
/** Recuo da faixa do item (e do cabeçalho, para as colunas baterem) mais o contorno de 1 px. */
const RECUO_DA_FAIXA = espaco(1);
const CONTORNO_DA_FAIXA = 1;
/** Os campos do item manual, na tabela, descem para a linha de baixo a partir da coluna do nome (não cabem nas colunas). */
const RECUO_DOS_CAMPOS_DO_MANUAL = LARGURA_DA_ALCA + 28 + 2 * VAO_DA_TABELA;

/**
 * Botões de 44 que a coluna das ações reserva na tabela: só o ⋯ (20/11), sempre, com "Mover para cima/baixo" (desde o
 * arrastar de 18/11) e "Excluir alimento". O "Trocar alimento" (19/11) fica embaixo do nome, então as colunas não mudam
 * com ele. Mude junto com o JSX das `acoes` da `LinhaItem`.
 */
const ACOES_RESERVADAS = 1;
/** Na opção em tabela, os números da comparação ficam embaixo das colunas de valor dos alimentos. */
const COLUNAS_DA_COMPARACAO: ColunasDaTabela = { larguras: COLUNAS_DE_VALOR.map((c) => c.largura), fim: ACOES_RESERVADAS * ALVO_TOQUE, vao: VAO_DA_TABELA };

/** Largura da opção a partir da qual os itens viram tabela: as colunas, os vãos, o recuo da faixa e os botões das ações. */
export function larguraDaTabela(): number {
  const colunas = COLUNAS.reduce((soma, c) => soma + c.largura, 0) + ACOES_RESERVADAS * ALVO_TOQUE;
  return colunas + VAO_DA_TABELA * COLUNAS.length + 2 * (RECUO_DA_FAIXA + CONTORNO_DA_FAIXA);
}

const estiloDaColuna = (c: (typeof COLUNAS)[number]) => (c.chave === 'nome' ? estilos.colunaDoNomeNaTabela : { width: c.largura });
// A fibra também tem marca (19/11); a kcal não.
const macroDa = (chave: ChaveDoValor | undefined) => (chave === 'fibra' ? FIBRA : MACROS.find((m) => m.chave === chave));
/** Na tabela, sem o "g" (está no título da coluna); empilhado, com ele (`ValoresDaDieta`). */
const valorNaTela = (chave: ChaveDoValor, v: number | null) => (chave === 'kcal' ? kcalNaTela(v) : gramasSemUnidade(v));

/**
 * O total da opção na tabela: o rótulo na coluna do nome e cada número embaixo da coluna dele, com o mesmo recuo do
 * cabeçalho. A fibra parcial leva "parcial" embaixo do número (como na comparação).
 */
function TotalNaTabela({ rotulo, totais, larguraDasAcoes }: { rotulo: string; totais: ValoresComFibra & TotaisComFibra; larguraDasAcoes: number }) {
  const { cores } = useTema();
  return (
    <View aria-hidden style={[estilos.linhaDaTabela, estilos.cabecalhoDosItens, estilos.cresce]}>
      {COLUNAS.map((c) => (
        <View key={c.chave} style={[estiloDaColuna(c), c.valor ? estilos.aDireita : null]}>
          {c.chave === 'nome' ? <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto> : null}
          {c.valor ? <Texto numerico cor={cores.texto} style={[estilos.textoADireita, estilos.numeroDoTotal]}>{valorNaTela(c.valor, totais[c.valor])}</Texto> : null}
          {c.valor === 'fibra' && fibraParcial(totais) ? <Texto variante="pequeno" style={estilos.textoADireita}>parcial</Texto> : null}
        </View>
      ))}
      <View style={{ width: larguraDasAcoes }} />
    </View>
  );
}

/** A alça com um item só: o mesmo ícone, apagado e sem gesto (não há para onde arrastar), no mesmo lugar da de verdade. */
function AlcaDesativada() {
  const { cores } = useTema();
  return (
    <View aria-hidden style={estilos.alcaDesativada}>
      <GripVertical size={18} color={cores.borda} strokeWidth={2} />
    </View>
  );
}

/**
 * "Trocar alimento" do item da biblioteca: compacto e secundário neutro (`superficie2`, contorno `borda` / `bordaCampo`
 * ao passar o mouse, rótulo e ícone `texto`), para não multiplicar a cor de ação com "+ Opção" e os demais botões. O
 * desenho tem 32 px e o alvo, 44 (como o `IconeBotao compacto`); o `Botao` não tem tamanho compacto (o padding e a
 * fonte dele não cabem embaixo do nome).
 */
function BotaoTrocar({ nome, aoTocar }: { nome: string; aoTocar: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Trocar alimento: ${nome}`} onPress={aoTocar} style={estilos.alvoDoTrocar}>
      {(estado) => (
        <View style={[estilos.desenhoDoTrocar, { backgroundColor: cores.superficie2, borderColor: sobre(estado) ? cores.bordaCampo : cores.borda }]}>
          <ArrowLeftRight size={14} color={cores.texto} strokeWidth={2} />
          <Texto style={[estilos.textoDoTrocar, { color: cores.texto }]}>Trocar alimento</Texto>
        </View>
      )}
    </Pressable>
  );
}

/**
 * O nome do alimento na tabela: uma linha com reticências; o leitor de tela lê o texto inteiro e, na web, o nome completo
 * fica na dica do mouse (o react-native-web não repassa `title`; vai direto no elemento, como o `NomeDoMembro` dos Números).
 */
function NomeNaTabela({ nome }: { nome: string }) {
  const comDica = (el: View | null) => {
    if (Platform.OS === 'web' && el && 'setAttribute' in el && typeof el.setAttribute === 'function') el.setAttribute('title', nome);
  };
  return <View ref={comDica}><Texto numberOfLines={1} style={estilos.nomeDoItem}>{nome}</Texto></View>;
}

/** Cabeçalho das colunas, uma vez por opção. Fora do leitor de tela: cada campo já tem nome e cada linha lê os valores. */
function CabecalhoDosItens({ larguraDasAcoes }: { larguraDasAcoes: number }) {
  return (
    <View aria-hidden style={[estilos.linhaDaTabela, estilos.cabecalhoDosItens]}>
      {COLUNAS.map((c) => {
        const macro = macroDa(c.valor);
        return (
          <View key={c.chave} style={[estiloDaColuna(c), c.valor ? estilos.aDireita : null, estilos.celulaDoCabecalho]}>
            {macro ? <MarcaDoMacro cor={macro.cor} /> : null}
            {/* O mesmo texto do rótulo do campo empilhado: na tabela ele só sobe para o cabeçalho. */}
            {c.rotulo ? <Texto variante="rotulo" numberOfLines={2} style={estilos.tituloDaColuna}>{c.rotulo}</Texto> : null}
          </View>
        );
      })}
      <View style={{ width: larguraDasAcoes }} />
    </View>
  );
}

/**
 * Um item da opção numa faixa própria (`superficie2`, cantos de 12), com o número no começo. Em `tabela`, cada coisa na
 * coluna do cabeçalho, sem rótulo em cima; em `empilhado` (opção estreita), o cartão de antes, com os rótulos à vista.
 * Item com pendência ganha o contorno na cor do problema (o contorno existe sempre, transparente, para nada pular).
 */
function LinhaItem({ modo, larguraDasAcoes, alca, item, posicao, total, comProblema, alimento, aoMudar, aoRemover, aoMover, aoTrocar }: {
  modo: ModoDoItem;
  larguraDasAcoes: number;
  /** Encaixe da alça de arrastar (parte 2): aparece quando a coluna `alca` tem largura. */
  alca?: ReactNode;
  item: ItemDieta;
  posicao: number;
  total: number;
  comProblema: boolean;
  alimento: Alimento | undefined;
  aoMudar: (i: ItemDieta) => void;
  aoRemover: () => void;
  aoMover: (d: -1 | 1) => void;
  /** Só item da biblioteca: o manual troca pelo campo de nome. */
  aoTrocar?: () => void;
}) {
  const { cores } = useTema();
  const mudar = (parcial: Partial<ItemDieta>) => aoMudar({ ...item, ...parcial });
  const mudarValor = (chave: ChaveDoValor, v: number | null) => aoMudar({ ...item, [chave]: v });
  const nome = item.nome || 'item';
  const emTabela = modo === 'tabela';
  // Quantidade vazia ou zero, a condição que a publicação recusa (`ValidadorDieta`). Vazia é pendência de preenchimento:
  // "Falta a quantidade" em âmbar com o ícone, como o "Falta a carga" do treino; zero ou negativa é valor errado: a
  // mensagem da API no próprio campo, em vermelho (cores-de-destaque D12: três sentidos, três textos).
  const semQuantidade = !(item.quantidade && item.quantidade > 0);
  const faltaQuantidade = item.quantidade == null;
  const tom = faltaQuantidade ? 'atencao' : 'perigo';
  const erroDaQuantidade = semQuantidade && !faltaQuantidade ? 'Quantidade precisa ser maior que zero.' : null;
  const totais = somar([item]);
  const [menu, setMenu] = useState(false);
  // Na tabela, a lixeira foi para o ⋯ (20/11): o mesmo `aoRemover` (aviso com Desfazer), por isso o ⋯ aparece sempre.
  const excluir: AcaoDoMenu = { rotulo: 'Excluir alimento', detalhe: 'Dá para desfazer logo depois.', Icone: Trash2, perigo: true, aoTocar: aoRemover };
  const acoesDoMenu = [...acoesDeMover({ nome, posicao, total, aoMover }), ...(emTabela ? [excluir] : [])];
  // Na tabela, o "Trocar alimento" fica embaixo do nome, sempre primeiro (os selos vêm depois dele); empilhado, nas ações.
  const trocar = aoTrocar ? <BotaoTrocar nome={nome} aoTocar={aoTrocar} /> : null;
  const semGramas = semConversao(item, alimento);

  const nomeDoItem = (
    <>
      {item.manual ? (
        <Campo rotulo="Item" rotuloOculto={emTabela} valor={item.nome} aoMudar={(n) => mudar({ nome: n })} maxLength={160} />
      ) : emTabela ? <NomeNaTabela nome={item.nome} /> : (
        <Texto style={estilos.nomeDoItem}>{item.nome}</Texto>
      )}
      {(emTabela && trocar) || faltaQuantidade || semGramas || item.manual ? (
        <View style={estilos.linhaDeBaixo}>
          {emTabela ? trocar : null}
          {faltaQuantidade ? <Selo texto="Falta a quantidade" tipo="atencao" Icone={TriangleAlert} /> : null}
          {/* A unidade escolhida não converte para a base do alimento: o valor fica "—" e não se inventa gramatura. */}
          {semGramas ? <Selo texto="Informe gramas por unidade no alimento" tipo="atencao" Icone={TriangleAlert} /> : null}
          {item.manual ? <Selo texto="Item manual" tipo="neutro" /> : null}
        </View>
      ) : null}
      {/* Na tabela os valores da biblioteca são números soltos nas colunas: o leitor ouve a linha numa frase só. */}
      {emTabela && !item.manual ? <TotalParaLeitor rotulo={nome} totais={totais} /> : null}
    </>
  );
  // Campo estreito: a caixa marca o erro e a mensagem vai na linha inteira abaixo, sem empurrar a Unidade. Na tabela,
  // quantidade e unidade num campo só ("50 g ▾").
  const quantidade = emTabela ? (
    <CampoDaQuantidade quantidade={item.quantidade} unidade={item.unidade} erro={erroDaQuantidade}
      aoMudarQuantidade={(q) => mudar({ quantidade: q })} aoMudarUnidade={(u) => mudar({ unidade: u })} />
  ) : (
    <CampoNumerico rotulo="Quantidade" rotuloOculto={emTabela} valor={item.quantidade} aoMudar={(q) => mudar({ quantidade: q })} erro={erroDaQuantidade} erroSemTexto />
  );
  const unidade = (
    <EscolhaSuspensa<UnidadeAlimento> rotulo="Unidade" titulo={`Unidade de ${nome}`} opcoes={UNIDADES} valor={item.unidade}
      aoMudar={(u) => mudar({ unidade: u })} style={estilos.unidade} />
  );
  // Os valores do item manual são campos; P, C, G e a fibra com a marca da cor no rótulo (na tabela, no cabeçalho).
  const campoDoValor = (c: (typeof COLUNAS)[number]) => {
    const macro = macroDa(c.valor);
    const chave = c.valor;
    if (!chave) return null;
    return macro ? (
      <CampoDoMacro macro={macro} rotulo={c.rotulo} valor={item[chave] ?? null} aoMudar={(v) => mudarValor(chave, v)}
        erro={chave === 'fibra' ? erroDaFibra(item.fibra) : undefined} />
    ) : (
      <CampoNumerico rotulo={c.rotulo} valor={item[chave] ?? null} aoMudar={(v) => mudarValor(chave, v)} />
    );
  };
  // Na tabela, só o ⋯ (`ACOES_RESERVADAS`); empilhado, o de antes: o "Trocar", o ⋯ (com dois ou mais) e a lixeira.
  const acoes = (
    <>
      {emTabela ? null : trocar}
      {acoesDoMenu.length ? <IconeBotao Icone={Ellipsis} rotulo={`Mais ações de ${nome}`} aoTocar={() => setMenu(true)} /> : null}
      {emTabela ? null : <IconeBotao Icone={Trash2} rotulo={`Remover ${nome}`} cor={cores.perigo} aoTocar={aoRemover} />}
    </>
  );
  // Em pares (kcal e P, C e G): sem largura para os quatro, descem dois a dois (com número ímpar, o último fica só).
  const camposDoManual = (
    <View style={estilos.valores}>
      {PARES_DE_VALOR.map((par) => (
        <View key={par[0].chave} style={estilos.parDeValores}>
          {par.map((c) => <View key={c.chave} style={estilos.valor}>{campoDoValor(c)}</View>)}
        </View>
      ))}
    </View>
  );
  const celula = (c: (typeof COLUNAS)[number]): ReactNode => {
    if (c.chave === 'alca') return alca;
    if (c.chave === 'numero') return <NumeroInvertido numero={posicao + 1} invertido={false} />;
    if (c.chave === 'nome') return nomeDoItem;
    if (c.chave === 'quantidade') return quantidade;
    // O item manual digita os valores na linha de baixo (os campos não cabem nas colunas de 48).
    if (!c.valor || item.manual) return null;
    return <Texto numerico cor={cores.texto} style={estilos.textoADireita} aria-hidden>{valorNaTela(c.valor, totais[c.valor])}</Texto>;
  };

  return (
    <View style={[estilos.faixa, { backgroundColor: cores.superficie2, borderColor: comProblema ? cores[tom] : 'transparent' }]}>
      {emTabela ? (
        <View style={estilos.linhaDaTabela}>
          {COLUNAS.map((c) => (
            <View key={c.chave} style={[estiloDaColuna(c), c.chave === 'nome' ? estilos.celulaDoNome : null, c.valor && !item.manual ? estilos.aDireita : null]}>
              {celula(c)}
            </View>
          ))}
          <View style={[estilos.acoesDaTabela, { width: larguraDasAcoes }]}>{acoes}</View>
        </View>
      ) : (
        <View style={estilos.empilhado}>
          {LARGURA_DA_ALCA > 0 ? <View style={{ width: LARGURA_DA_ALCA }}>{alca}</View> : null}
          <View style={estilos.numeroEmpilhado}><NumeroInvertido numero={posicao + 1} invertido={false} /></View>
          <View style={estilos.item}>
            <View style={estilos.colunaDoNome}>{nomeDoItem}</View>
            <View style={estilos.quantidade}>{quantidade}</View>
            {unidade}
            {item.manual ? camposDoManual : (
              <View style={estilos.valoresDoItem}><ValoresDaDieta totais={totais} /></View>
            )}
            <View style={estilos.acoesDoItem}>{acoes}</View>
          </View>
        </View>
      )}
      {emTabela && item.manual ? <View style={estilos.camposDoManualNaTabela}>{camposDoManual}</View> : null}
      {erroDaQuantidade ? <View style={estilos.erroDaLinha}><MensagemDeErro erro={erroDaQuantidade} /></View> : null}
      {menu ? <FolhaDeAcoes titulo={item.nome || 'Item sem nome'} aoFechar={() => setMenu(false)} acoes={acoesDoMenu} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.5) },
  titulo: { flex: 1, gap: espaco(0.5), minHeight: 44, justifyContent: 'center' },
  corpo: { gap: espaco(1.5) },
  dados: { width: '100%', maxWidth: LARGURA_EDITOR, gap: espaco(1.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-end' },
  nome: { flex: 1, minWidth: 200 },
  horario: { width: 100 },
  // Comparação, abas e a opção aberta: 16 entre os blocos, o dobro do que há dentro deles.
  opcoes: { gap: espaco(2) },
  opcao: { gap: espaco(1), minWidth: 0 },
  tituloDaOpcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: 44 },
  cresce: { flex: 1 },
  // Os itens ficam a 6 px um do outro: cada faixa já separa pelo fundo.
  itens: { gap: 6 },
  faixa: { borderRadius: 12, borderWidth: CONTORNO_DA_FAIXA, paddingHorizontal: RECUO_DA_FAIXA, paddingVertical: espaco(1), gap: espaco(0.5) },
  linhaDaTabela: { flexDirection: 'row', alignItems: 'center', gap: VAO_DA_TABELA },
  // Mesmo recuo e contorno da faixa, para cada título ficar em cima da sua coluna.
  cabecalhoDosItens: { paddingHorizontal: RECUO_DA_FAIXA + CONTORNO_DA_FAIXA },
  celulaDoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  // "Fibras (g)" quebra em duas linhas ao lado da marca, sem sair da coluna; à esquerda, as duas linhas ficam coladas à
  // marca (à direita, a marca ficava mais perto do "G (g)" da coluna ao lado que do próprio título).
  tituloDaColuna: { flexShrink: 1, textAlign: 'left' },
  colunaDoNomeNaTabela: { flex: 1, minWidth: LARGURA_MINIMA_DO_NOME },
  celulaDoNome: { gap: espaco(0.5), justifyContent: 'center', minHeight: 44 },
  aDireita: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  textoADireita: { textAlign: 'right' },
  acoesDaTabela: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  empilhado: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  // O número desce até o meio da primeira linha (o nome tem 44 de altura mínima).
  numeroEmpilhado: { paddingTop: 8 },
  item: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(1.5), rowGap: espaco(1) },
  colunaDoNome: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 180, gap: espaco(0.5), minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  nomeDoItem: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  acoesDoItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', alignSelf: 'center' },
  erroDaLinha: { flexBasis: '100%' },
  camposDoManualNaTabela: { flexDirection: 'row', paddingLeft: RECUO_DOS_CAMPOS_DO_MANUAL },
  quantidade: { width: 104 },
  // Mesma altura do campo da quantidade ao lado (a lista suspensa tem 52 de mínimo), como o RIR na série.
  unidade: { width: 104, minHeight: 44, alignSelf: 'flex-end' },
  valores: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 },
  parDeValores: { flexDirection: 'row', gap: espaco(1), flexGrow: 1, flexBasis: 2 * 64 + espaco(1) },
  valor: { flex: 1, minWidth: 64 },
  total: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.5), borderTopWidth: 1, paddingTop: espaco(1) },
  // Embaixo do nome: o "Trocar alimento" (na tabela) e os selos do item, quebrando linha quando não cabem.
  linhaDeBaixo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  numeroDoTotal: { fontFamily: fontes.monoSemi },
  alcaDesativada: { width: LARGURA_DA_PECA, minHeight: ALVO_TOQUE, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  alvoDoTrocar: { minHeight: ALVO_TOQUE, justifyContent: 'center', alignSelf: 'flex-start', borderRadius: RAIO_CONTROLE },
  desenhoDoTrocar: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: espaco(1.25), borderWidth: 1, borderRadius: RAIO_CONTROLE },
  textoDoTrocar: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18 },
  subtotal: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 2, marginTop: 2 },
  // Sem espaço ao lado da quantidade e da unidade (opção estreita), os valores descem para a linha de baixo inteiros.
  valoresDoItem: { alignSelf: 'center', flexGrow: 1, flexShrink: 1, flexBasis: 220 },
});
