import { ArrowDown, ArrowUp, PencilLine, Plus, Trash2 } from 'lucide-react-native';
import { Fragment, type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Alimento, ItemDieta, OpcaoRefeicao, Refeicao, UnidadeAlimento } from '../../api/tipos';
import {
  colunasDasOpcoes,
  ESPACO_ENTRE_OPCOES,
  MODO_DE_PREPARO_MAXIMO,
  modoDePreparoValido,
  novaOpcao,
  novoItem,
  recalcularItem,
  somar,
  type Totais,
} from '../../dominio/dieta';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { numeroParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_EDITOR, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Divisor } from '../../ui/Divisor';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { UNIDADES } from '../biblioteca/AbaAlimentos';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { BotaoDeTexto } from '../treino/BotaoDeAbrir';
import { rotuloSalvarComo } from '../planejamento/modelos';

/** "2.236 kcal · P 180,2 g · C 250 g · G 60,1 g"; valor que falta aparece como "—" (nunca inventado). */
export function textoTotais(t: Totais): string {
  const g = (v: number | null) => (v === null ? '—' : `${numeroParaTela(v, 1)} g`);
  return `${t.kcal === null ? '—' : numeroParaTela(t.kcal, 0)} kcal · P ${g(t.proteina)} · C ${g(t.carboidrato)} · G ${g(t.gordura)}`;
}

/** "Almoço · 12:00" no título do cartão e do item da lista: "12:00 · Almoço" ("Refeição N" sem nome). */
export function tituloDaRefeicao(r: Refeicao, posicao: number): string {
  return `${r.horario ? `${r.horario} · ` : ''}${r.nome || `Refeição ${posicao + 1}`}`;
}

/** "540 kcal · 3 itens · 2 opções": o total e os itens são os da opção A ("—" sem valor). */
export function resumoDaRefeicao(r: Refeicao): string {
  const totalA = somar(r.opcoes[0]?.itens ?? []);
  const nItens = r.opcoes[0]?.itens.length ?? 0;
  return `${totalA.kcal === null ? '—' : numeroParaTela(totalA.kcal, 0)} kcal · ${nItens} ${nItens === 1 ? 'item' : 'itens'}${r.opcoes.length > 1 ? ` · ${r.opcoes.length} opções` : ''}`;
}

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
}

/**
 * Refeição: o cabeçalho (posição, título, um selo, ↑↓ e a lixeira com o nome), os dados dela (nome, horário, observação,
 * modo de preparo) e as opções (A, B...) com os itens e o total de cada uma. As opções são alternativas (o aluno escolhe
 * uma; o total do dia usa só a A): ficam lado a lado quando o cartão é largo (`colunasDasOpcoes`, no PC) e empilhadas no
 * celular. Duas molduras no máximo (S4 de `editor-treino-inspetor.md`): a refeição e o item; a opção é uma seção com o
 * título e um fio, sem caixa. Nada é comparado nem calculado entre as opções.
 */
export function CartaoRefeicao(p: Props) {
  const { cores } = useTema();
  const r = p.refeicao;
  const [largura, setLargura] = useState(0);
  const mudar = (parcial: Partial<Refeicao>) => p.aoMudar({ ...r, ...parcial });
  const colunas = colunasDasOpcoes(largura, r.opcoes.length);
  const larguraDaColuna = colunas > 1 ? (largura - ESPACO_ENTRE_OPCOES * (colunas - 1)) / colunas : undefined;
  const mudarItens = (indice: number, fn: (itens: ItemDieta[]) => ItemDieta[]) =>
    mudar({ opcoes: substituir(r.opcoes, indice, { ...r.opcoes[indice], itens: fn(r.opcoes[indice].itens) }) });
  const modoDePreparo = r.modoDePreparo ?? '';
  // Observação e modo de preparo vazios ficam recolhidos num link (04/11); com texto gravado já abrem. A escolha nasce do
  // conteúdo e não volta a fechar ao apagar o texto, para os campos não sumirem enquanto a pessoa digita.
  const [extrasAbertos, setExtrasAbertos] = useState(() => !!r.observacao || !!r.modoDePreparo);
  const mostrarExtras = extrasAbertos || !!r.observacao || !!r.modoDePreparo;
  const titulo = tituloDaRefeicao(r, p.posicao);
  const problema = p.comProblema.has(r.uid);
  const varias = r.opcoes.length > 1;

  return (
    <AlvoDeRolagem chave={r.uid}><Cartao
      style={problema ? { borderColor: cores.perigo } : undefined}
      cabecalho={
        <CabecalhoDoItem
          faixa
          // A posição por extenso só no inspetor: empilhadas, a ordem já está à vista.
          contexto={p.aoAbrir ? undefined : `Refeição ${p.posicao + 1} de ${p.total}`}
          titulo={titulo}
          // Aberta, o resumo repetiria o que está logo abaixo (e, no PC, no item da lista).
          resumo={p.aberta ? undefined : resumoDaRefeicao(r)}
          selo={problema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
          aberto={p.aberta}
          aoAlternar={p.aoAbrir}
          nomeDoItem={titulo}
          posicao={p.posicao}
          total={p.total}
          aoMover={p.aoMover}
          remover={p.aoRemover ? <IconeBotao Icone={Trash2} rotulo={`Remover ${titulo}`} cor={cores.perigo} aoTocar={p.aoRemover} /> : undefined}
        />
      }>
      {p.aberta ? (
        <View style={estilos.corpo}>
          {/* Os dados da refeição seguram a medida do editor (em 1920 px o inspetor passa de 1300 px); as opções usam a largura toda. */}
          <View style={estilos.dados}>
            <View style={estilos.linha}>
              <View style={estilos.nome}>
                <Campo rotulo="Nome" valor={r.nome} aoMudar={(nome) => mudar({ nome })} maxLength={80} placeholder="Ex.: Café da manhã" />
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
            <Texto variante="suave">O aluno escolhe uma das opções. O total do dia usa só a opção {r.opcoes[0].rotulo}.</Texto>
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
    </Cartao></AlvoDeRolagem>
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
          aoMudar={(novo) => aoMudarItens((itens) => substituir(itens, ii, recalcularItem(novo, novo.alimentoId ? alimentos.get(novo.alimentoId) : undefined)))}
          aoRemover={() => (aoRemoverItem ? aoRemoverItem(ii, item.nome || `Item ${ii + 1}`) : aoMudarItens((itens) => remover(itens, ii)))}
          aoMover={(d) => aoMudarItens((itens) => mover(itens, ii, d))}
        />
      ))}
      <Texto numerico style={estilos.total}>Total da opção {opcao.rotulo}: {textoTotais(somar(opcao.itens))}</Texto>
      <LinhaDeAcoes>
        <Botao rotulo="Adicionar alimento" rotuloAcessivel={`Adicionar alimento${naOpcao}`} tipo="secundario" Icone={Plus} aoTocar={aoEscolherAlimento} />
        <Botao rotulo="Item manual" rotuloAcessivel={`Item manual${naOpcao}`} tipo="secundario" Icone={PencilLine} aoTocar={() => aoMudarItens((itens) => [...itens, novoItem()])} />
      </LinhaDeAcoes>
    </View>
  );
}

/** Um item da opção: caixa própria (a segunda moldura), com o nome, ↑↓ desabilitadas na ponta, a lixeira e as quantidades. */
function LinhaItem({ item, posicao, total, comProblema, aoMudar, aoRemover, aoMover }: {
  item: ItemDieta;
  posicao: number;
  total: number;
  comProblema: boolean;
  aoMudar: (i: ItemDieta) => void;
  aoRemover: () => void;
  aoMover: (d: -1 | 1) => void;
}) {
  const { cores } = useTema();
  const mudar = (parcial: Partial<ItemDieta>) => aoMudar({ ...item, ...parcial });
  const nome = item.nome || 'item';
  return (
    <View style={[estilos.item, { borderColor: comProblema ? cores.perigo : cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.topo}>
        <View style={estilos.titulo}>
          {item.manual ? (
            <Campo rotulo="Item" valor={item.nome} aoMudar={(n) => mudar({ nome: n })} maxLength={160} />
          ) : (
            <Texto style={estilos.nomeItem}>{item.nome}</Texto>
          )}
        </View>
        {total > 1 ? (
          <>
            <IconeBotao Icone={ArrowUp} rotulo={`Subir ${nome}`} desabilitado={posicao === 0} aoTocar={() => aoMover(-1)} />
            <IconeBotao Icone={ArrowDown} rotulo={`Descer ${nome}`} desabilitado={posicao === total - 1} aoTocar={() => aoMover(1)} />
          </>
        ) : null}
        <IconeBotao Icone={Trash2} rotulo={`Remover ${nome}`} cor={cores.perigo} aoTocar={aoRemover} />
      </View>
      <View style={estilos.linha}>
        <View style={estilos.quantidade}>
          <CampoNumerico rotulo="Quantidade" valor={item.quantidade} aoMudar={(quantidade) => mudar({ quantidade })} />
        </View>
        {/* Unidade numa lista suspensa ao lado da quantidade (04/11): os chips abertos repetiam em cada alimento e quebravam
            a linha com as opções lado a lado. */}
        <EscolhaSuspensa<UnidadeAlimento> rotulo="Unidade" titulo={`Unidade de ${nome}`} opcoes={UNIDADES} valor={item.unidade}
          aoMudar={(unidade) => mudar({ unidade })} style={estilos.unidade} />
        {/* Item da biblioteca: os valores ficam na mesma linha da quantidade; só o manual abre os campos de valor. */}
        {item.manual ? null : <Texto variante="suave" numerico style={estilos.valoresDoItem}>{textoTotais(somar([item]))}</Texto>}
      </View>
      {item.manual ? (
        // Os quatro valores numa linha só, também no celular (antes quebravam em 3 + 1).
        <View style={estilos.valores}>
          <View style={estilos.valor}><CampoNumerico rotulo="Kcal" valor={item.kcal} aoMudar={(kcal) => mudar({ kcal })} /></View>
          <View style={estilos.valor}><CampoNumerico rotulo="P (g)" valor={item.proteina} aoMudar={(proteina) => mudar({ proteina })} /></View>
          <View style={estilos.valor}><CampoNumerico rotulo="C (g)" valor={item.carboidrato} aoMudar={(carboidrato) => mudar({ carboidrato })} /></View>
          <View style={estilos.valor}><CampoNumerico rotulo="G (g)" valor={item.gordura} aoMudar={(gordura) => mudar({ gordura })} /></View>
        </View>
      ) : null}
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
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(1) },
  nomeItem: { fontFamily: fontes.semi },
  quantidade: { width: 120 },
  // Mesma altura do campo da quantidade ao lado (a lista suspensa tem 52 de mínimo), como o RIR na série.
  unidade: { width: 112, minHeight: 44, alignSelf: 'flex-end' },
  valores: { flexDirection: 'row', gap: espaco(1) },
  valor: { flex: 1, minWidth: 0 },
  total: { fontFamily: fontes.semi },
  // Sem espaço ao lado da quantidade e da unidade (opções lado a lado), os valores descem para a linha de baixo inteiros.
  valoresDoItem: { alignSelf: 'center', flexGrow: 1, flexShrink: 1, flexBasis: 180 },
});
