import { ArrowDown, ArrowLeftRight, ArrowUp, PencilLine, Plus, Trash2, TriangleAlert } from 'lucide-react-native';
import { Fragment, type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Alimento, ItemDieta, OpcaoRefeicao, Refeicao, UnidadeAlimento } from '../../api/tipos';
import {
  colunasDasOpcoes,
  erroDaFibra,
  ESPACO_ENTRE_OPCOES,
  MODO_DE_PREPARO_MAXIMO,
  modoDePreparoValido,
  novaOpcao,
  novoItem,
  recalcularItem,
  semConversao,
  somar,
} from '../../dominio/dieta';
import { corDaRefeicao } from '../../dominio/corDaSerie';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { numeroParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_EDITOR } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Divisor } from '../../ui/Divisor';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { CampoDoMacro, MACROS, TotalParaLeitor, ValoresDaDieta } from '../../ui/ValoresDaDieta';
import { UNIDADES } from '../biblioteca/AbaAlimentos';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { BotaoDeTexto } from '../treino/BotaoDeAbrir';
import { rotuloSalvarComo } from '../planejamento/modelos';

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
  /** O "Desfazer" da opção removida, logo abaixo das opções (empilhado, para ficar à vista). */
  aviso?: ReactNode;
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
 * uma; o total do dia usa só a A): ficam lado a lado quando o cartão é largo (`colunasDasOpcoes`, no PC) e empilhadas no
 * celular. Duas molduras no máximo (S4 de `editor-treino-inspetor.md`): a refeição e o item; a opção é uma seção com o
 * título e um fio, sem caixa. Nada é comparado nem calculado entre as opções.
 */
export function CartaoRefeicao(p: Props) {
  const { cores, identificacao } = useTema();
  // A cor diz qual refeição é (pela posição na seção aberta: na dieta por dia, dentro da variação), nunca status.
  const corDaBarra = identificacao?.[corDaRefeicao(p.posicao)]?.cor;
  const r = p.refeicao;
  const [largura, setLargura] = useState(0);
  const mudar = (parcial: Partial<Refeicao>) => p.aoMudar({ ...r, ...parcial });
  const colunas = colunasDasOpcoes(largura, r.opcoes.length);
  const larguraDaColuna = colunas > 1 ? (largura - ESPACO_ENTRE_OPCOES * (colunas - 1)) / colunas : undefined;
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
          posicao={p.posicao}
          total={p.total}
          aoMover={p.aoMover}
          remover={p.aoRemover ? <Botao tipo="perigoTexto" rotulo="Excluir" rotuloAcessivel={`Remover ${titulo}`} Icone={Trash2} aoTocar={p.aoRemover} /> : undefined}
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
          {varias ? (
            <Texto variante="suave">Cada opção substitui a refeição inteira: o aluno escolhe uma. O total do dia soma só a opção {r.opcoes[0].rotulo}.</Texto>
          ) : (
            <Texto variante="secao">Alimentos ({r.opcoes[0]?.itens.length ?? 0})</Texto>
          )}
          <View style={estilos.opcoes} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
            {r.opcoes.map((opcao, indice) => (
              <Fragment key={opcao.uid}>
                {/* Empilhadas, um fio entre as opções; lado a lado, a coluna e o título já separam. */}
                {indice > 0 && colunas === 1 ? <Divisor style={estilos.opcaoInteira} /> : null}
                <OpcaoDaRefeicao
                  opcao={opcao}
                  largura={larguraDaColuna}
                  varias={varias}
                  comProblema={p.comProblema}
                  alimentos={p.alimentos}
                  aoMudarItens={(fn) => mudarItens(indice, fn)}
                  aoEscolherAlimento={() => p.aoEscolherAlimento(indice)}
                  aoTrocarAlimento={p.aoTrocarAlimento}
                  aoRemover={varias ? () => p.aoRemoverOpcao(indice) : undefined}
                  aoRemoverItem={p.aoRemoverItem ? (ii, nome) => p.aoRemoverItem!(indice, ii, nome) : undefined}
                />
              </Fragment>
            ))}
          </View>
          {p.aviso}
          {r.opcoes.length < 6 || p.aoSalvarModelo ? (
            <>
              <Divisor />
              <LinhaDeAcoes>
                {r.opcoes.length < 6 ? (
                  <Botao
                    rotulo="Adicionar opção"
                    rotuloAcessivel={`Adicionar opção em ${titulo}`}
                    tipo="secundario"
                    Icone={Plus}
                    aoTocar={() => mudar({ opcoes: [...r.opcoes, novaOpcao(r.opcoes)] })}
                  />
                ) : null}
                {p.aoSalvarModelo ? <Botao rotulo={rotuloSalvarComo('REFEICAO')} rotuloAcessivel={`${rotuloSalvarComo('REFEICAO')}: ${titulo}`} tipo="fantasma" aoTocar={p.aoSalvarModelo} /> : null}
              </LinhaDeAcoes>
            </>
          ) : null}
        </View>
      ) : null}
    </Cartao></View></AlvoDeRolagem>
  );
}

/** Uma opção da refeição: título com a lixeira (só com várias), itens, total da opção ("—" no que faltar) e os botões dela. */
function OpcaoDaRefeicao({
  opcao,
  largura,
  varias,
  comProblema,
  alimentos,
  aoMudarItens,
  aoEscolherAlimento,
  aoTrocarAlimento,
  aoRemover,
  aoRemoverItem,
}: {
  opcao: OpcaoRefeicao;
  /** Largura da coluna no PC; sem ela, a opção ocupa a linha toda (celular). */
  largura: number | undefined;
  varias: boolean;
  comProblema: Set<string>;
  alimentos: Map<string, Alimento>;
  aoMudarItens: (fn: (itens: ItemDieta[]) => ItemDieta[]) => void;
  aoEscolherAlimento: () => void;
  aoTrocarAlimento?: (uid: string) => void;
  aoRemover?: () => void;
  aoRemoverItem?: (itemIndice: number, nomeItem: string) => void;
}) {
  const { cores } = useTema();
  // Com várias opções, o nome acessível diz a qual delas o botão serve (o texto visível é o mesmo em cada coluna).
  const naOpcao = varias ? ` na opção ${opcao.rotulo}` : '';
  return (
    <View style={[estilos.opcao, largura ? { width: largura } : estilos.opcaoInteira]}>
      {varias ? (
        <View style={estilos.tituloDaOpcao}>
          <Texto variante="secao" nivel={3} style={estilos.cresce}>Opção {opcao.rotulo}</Texto>
          {aoRemover ? <IconeBotao Icone={Trash2} rotulo={`Remover opção ${opcao.rotulo}`} cor={cores.perigo} aoTocar={aoRemover} /> : null}
        </View>
      ) : null}
      {opcao.itens.length === 0 ? <Texto variante="suave">Nenhum item nesta opção.</Texto> : null}
      {opcao.itens.map((item, ii) => (
        <LinhaItem
          key={item.uid}
          item={item}
          posicao={ii}
          total={opcao.itens.length}
          comProblema={comProblema.has(item.uid)}
          alimento={item.alimentoId ? alimentos.get(item.alimentoId) : undefined}
          aoMudar={(novo) => aoMudarItens((itens) => substituir(itens, ii, recalcularItem(novo, novo.alimentoId ? alimentos.get(novo.alimentoId) : undefined)))}
          aoRemover={() => (aoRemoverItem ? aoRemoverItem(ii, item.nome || `Item ${ii + 1}`) : aoMudarItens((itens) => remover(itens, ii)))}
          aoMover={(d) => aoMudarItens((itens) => mover(itens, ii, d))}
          aoTrocar={aoTrocarAlimento && !item.manual ? () => aoTrocarAlimento(item.uid) : undefined}
        />
      ))}
      {/* Total separado dos itens por um fio suave: o nome à esquerda, os números à direita (guia pág. 10). */}
      <View role="group" aria-label={`Total da opção ${opcao.rotulo}`} style={[estilos.total, { borderTopColor: cores.divisor }]}>
        <TotalParaLeitor rotulo={`Total da opção ${opcao.rotulo}`} totais={somar(opcao.itens)} />
        <Texto variante="rotulo" cor={cores.texto} aria-hidden>Total da opção {opcao.rotulo}</Texto>
        <View style={estilos.cresce} aria-hidden><ValoresDaDieta totais={somar(opcao.itens)} forte /></View>
      </View>
      <LinhaDeAcoes>
        <Botao rotulo="Adicionar alimento" rotuloAcessivel={`Adicionar alimento${naOpcao}`} tipo="acao" Icone={Plus} aoTocar={aoEscolherAlimento} />
        <Botao rotulo="Item manual" rotuloAcessivel={`Item manual${naOpcao}`} tipo="secundario" Icone={PencilLine} aoTocar={() => aoMudarItens((itens) => [...itens, novoItem()])} />
      </LinhaDeAcoes>
    </View>
  );
}

/** Um item da opção: caixa própria (a segunda moldura), com o nome, ↑↓ desabilitadas na ponta, a lixeira e as quantidades. */
function LinhaItem({ item, posicao, total, comProblema, alimento, aoMudar, aoRemover, aoMover, aoTrocar }: {
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
  const nome = item.nome || 'item';
  // Quantidade vazia ou zero, a condição que a publicação recusa (`ValidadorDieta`). Vazia é pendência de preenchimento:
  // "Falta a quantidade" em âmbar com o ícone, como o "Falta a carga" do treino; zero ou negativa é valor errado: a
  // mensagem da API no próprio campo, em vermelho (cores-de-destaque D12: três sentidos, três textos).
  const semQuantidade = !(item.quantidade && item.quantidade > 0);
  const faltaQuantidade = item.quantidade == null;
  const tom = faltaQuantidade ? 'atencao' : 'perigo';
  const erroDaQuantidade = semQuantidade && !faltaQuantidade ? 'Quantidade precisa ser maior que zero.' : null;
  // Visual-ponytail (17/11): o alimento é uma LINHA da tabela da refeição (nome, quantidade, unidade, valores e ações lado a
  // lado, separados por filete), não mais um cartão alto por item; no celular a linha quebra. Item com pendência ganha a
  // barra lateral na cor do problema.
  return (
    <View style={[estilos.item, { borderBottomColor: cores.divisor }, comProblema ? { borderLeftWidth: 3, borderLeftColor: cores[tom], paddingLeft: espaco(1) } : null]}>
      <View style={estilos.colunaDoNome}>
        {item.manual ? (
          <Campo rotulo="Item" valor={item.nome} aoMudar={(n) => mudar({ nome: n })} maxLength={160} />
        ) : (
          <Texto style={estilos.nomeDoItem}>{item.nome}</Texto>
        )}
        {faltaQuantidade ? <View style={estilos.selo}><Selo texto="Falta a quantidade" tipo="atencao" Icone={TriangleAlert} /></View> : null}
        {/* A unidade escolhida não converte para a base do alimento: o valor fica "—" e não se inventa gramatura. */}
        {semConversao(item, alimento) ? <View style={estilos.selo}><Selo texto="Informe gramas por unidade no alimento" tipo="atencao" Icone={TriangleAlert} /></View> : null}
        {item.manual ? <View style={estilos.selo}><Selo texto="Item manual" tipo="neutro" /></View> : null}
      </View>
      <View style={estilos.quantidade}>
        {/* Campo estreito: a caixa marca o erro e a mensagem vai na linha inteira abaixo, sem empurrar a Unidade. */}
        <CampoNumerico rotulo="Quantidade" valor={item.quantidade} aoMudar={(quantidade) => mudar({ quantidade })} erro={erroDaQuantidade} erroSemTexto />
      </View>
      <EscolhaSuspensa<UnidadeAlimento> rotulo="Unidade" titulo={`Unidade de ${nome}`} opcoes={UNIDADES} valor={item.unidade}
        aoMudar={(unidade) => mudar({ unidade })} style={estilos.unidade} />
      {item.manual ? (
        // Os quatro valores do item manual na própria linha; P, C e G com a marca da cor no rótulo.
        <View style={estilos.valores}>
          <View style={estilos.valor}><CampoNumerico rotulo="Kcal" valor={item.kcal} aoMudar={(kcal) => mudar({ kcal })} /></View>
          <View style={estilos.valor}><CampoDoMacro macro={MACROS[0]} rotulo="P (g)" valor={item.proteina} aoMudar={(proteina) => mudar({ proteina })} /></View>
          <View style={estilos.valor}><CampoDoMacro macro={MACROS[1]} rotulo="C (g)" valor={item.carboidrato} aoMudar={(carboidrato) => mudar({ carboidrato })} /></View>
          <View style={estilos.valor}><CampoDoMacro macro={MACROS[2]} rotulo="G (g)" valor={item.gordura} aoMudar={(gordura) => mudar({ gordura })} /></View>
        </View>
      ) : (
        <View style={estilos.valoresDoItem}><ValoresDaDieta totais={somar([item])} /></View>
      )}
      {/* Fibra do item manual (V089): opcional, fora da kcal e sem marca de cor; o da biblioteca a mostra nos valores acima. */}
      {item.manual ? <View style={estilos.quantidade}><CampoNumerico rotulo="Fibras (g)" valor={item.fibra ?? null} aoMudar={(fibra) => mudar({ fibra })} erro={erroDaFibra(item.fibra)} /></View> : null}
      <View style={estilos.acoesDoItem}>
        {aoTrocar ? <IconeBotao Icone={ArrowLeftRight} rotulo={`Trocar ${nome}`} aoTocar={aoTrocar} /> : null}
        {total > 1 ? (
          <>
            <IconeBotao Icone={ArrowUp} rotulo={`Subir ${nome}`} desabilitado={posicao === 0} aoTocar={() => aoMover(-1)} />
            <IconeBotao Icone={ArrowDown} rotulo={`Descer ${nome}`} desabilitado={posicao === total - 1} aoTocar={() => aoMover(1)} />
          </>
        ) : null}
        <IconeBotao Icone={Trash2} rotulo={`Remover ${nome}`} cor={cores.perigo} aoTocar={aoRemover} />
      </View>
      {erroDaQuantidade ? <View style={estilos.erroDaLinha}><MensagemDeErro erro={erroDaQuantidade} /></View> : null}
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
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO_ENTRE_OPCOES, alignItems: 'flex-start' },
  opcao: { gap: espaco(1), minWidth: 0 },
  opcaoInteira: { width: '100%' },
  tituloDaOpcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: 44 },
  cresce: { flex: 1 },
  item: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(1.5), rowGap: espaco(1), borderBottomWidth: 1, paddingVertical: espaco(1.25) },
  colunaDoNome: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 180, gap: espaco(0.5), minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  nomeDoItem: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  acoesDoItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', alignSelf: 'center' },
  erroDaLinha: { flexBasis: '100%' },
  quantidade: { width: 104 },
  // Mesma altura do campo da quantidade ao lado (a lista suspensa tem 52 de mínimo), como o RIR na série.
  unidade: { width: 104, minHeight: 44, alignSelf: 'flex-end' },
  valores: { flexDirection: 'row', gap: espaco(1), flexGrow: 1, flexBasis: 320 },
  valor: { flex: 1, minWidth: 64 },
  total: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.5), borderTopWidth: 1, paddingTop: espaco(1) },
  selo: { flexDirection: 'row' },
  subtotal: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 2, marginTop: 2 },
  // Sem espaço ao lado da quantidade e da unidade (opções lado a lado), os valores descem para a linha de baixo inteiros.
  valoresDoItem: { alignSelf: 'center', flexGrow: 1, flexShrink: 1, flexBasis: 220 },
});
