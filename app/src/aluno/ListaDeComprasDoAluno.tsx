import { FileDown, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type PointerEvent } from 'react-native';

import type { ConteudoDieta } from '../api/tipos';
import {
  listaDeCompras,
  detalheDaConversao,
  NOTA_DA_LISTA_ALUNO,
  textosDasOpcoes,
  tituloDaLista,
  type LinhaDaLista as LinhaDaConta,
  type PeriodoDaLista,
} from '../dominio/listaDeCompras';
import {
  ajustarQuantidade,
  alternarComprado,
  contagemDeComprados,
  errosDoAjuste,
  errosDoAvulso,
  gravarAvulso,
  gruposDaTelaDoAluno,
  itensDoAluno,
  LIMITE_NOME_AVULSO,
  LIMITE_QUANTIDADE_LIVRE,
  LIMITE_UNIDADE_LIVRE,
  limparComprados,
  quantidadeParaAjustar,
  removerAvulso,
  restaurarAvulso,
  restaurarComprados,
  semErros,
  textoDaContagem,
  textoDaOrigem,
  voltarAoCalculado,
  type ErrosDoItem,
  type ItemAvulso,
  type ItemDaListaDoAluno,
} from '../dominio/listaDeComprasDoAluno';
import { contagemDoGrupo } from '../dominio/gruposDaLista';
import { novoUid } from '../dominio/uid';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Botao } from '../ui/Botao';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Campo } from '../ui/Campo';
import { CaixaRedonda } from '../ui/CaixaRedonda';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { IconeBotao } from '../ui/IconeBotao';
import { ListaDeLinhas } from '../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { EscolhasDaLista } from '../ui/ListaDeCompras';
import { NoPlano } from '../ui/NoPlano';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useListaDoAparelho } from './useListaDoAparelho';

/** O que o PDF do aluno precisa: o período, as opções escolhidas e os itens com ajustes e avulsos. */
export interface ListaParaPdf {
  periodo: PeriodoDaLista;
  opcoes: string[];
  /** A conta da dieta, sem os ajustes (o PDF mostra o calculado ao lado do ajuste). */
  linhas: LinhaDaConta[];
  itens: ItemDaListaDoAluno[];
}

type Edicao = { tipo: 'ajuste'; item: ItemDaListaDoAluno } | { tipo: 'avulso'; item: ItemDaListaDoAluno | null };

/**
 * Lista de compras do aluno: a conta da dieta (`listaDeCompras`, a mesma da prévia do treinador) mais o que é dele, só
 * neste aparelho: marcar comprado, ajustar a quantidade de um item e acrescentar itens. Nada disso muda a dieta nem vai
 * ao treinador. Período e opções por refeição também ficam guardados, por versão da dieta. Os itens vêm em linhas, num
 * cartão por grupo do alimento, com os comprados riscados no fim do grupo (`gruposDaTelaDoAluno`); o "N de M comprados"
 * conta a lista toda.
 */
export function ListaDeComprasDoAluno({
  conteudo,
  versaoId,
  aoGerarPdf,
}: {
  conteudo: ConteudoDieta;
  versaoId: string;
  aoGerarPdf: (lista: ListaParaPdf) => Promise<void>;
}) {
  const { avisar } = useAviso();
  const { cores, marcaPeca } = useTema();
  const lista = useListaDoAparelho(versaoId);
  const [ajustando, setAjustando] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [gerando, setGerando] = useState(false);

  if (lista.carregando) return <Esqueleto />;

  const { periodo, escolhas, marcacoes } = lista;
  const linhas = listaDeCompras(conteudo, escolhas, periodo);
  const itens = itensDoAluno(linhas, marcacoes);
  const contagem = contagemDeComprados(itens);
  const grupos = gruposDaTelaDoAluno(itens);

  const limpar = () => {
    const antes = marcacoes.comprados;
    lista.mudarMarcacoes(limparComprados);
    avisar('Marcações limpas.', 'neutro', { rotulo: 'Desfazer', aoTocar: () => lista.mudarMarcacoes((m) => restaurarComprados(m, antes), periodo) });
  };

  const remover = (item: ItemDaListaDoAluno) => {
    const avulso = item.avulso;
    if (!avulso) return;
    const indice = marcacoes.avulsos.findIndex((a) => a.id === avulso.id);
    lista.mudarMarcacoes((m) => removerAvulso(m, avulso.id));
    avisar(`"${avulso.nome}" saiu da lista.`, 'neutro', {
      rotulo: 'Desfazer',
      aoTocar: () => lista.mudarMarcacoes((m) => restaurarAvulso(m, avulso, indice, item.comprado), periodo),
    });
  };

  const pdf = async () => {
    setGerando(true);
    try {
      await aoGerarPdf({ periodo, opcoes: textosDasOpcoes(conteudo, escolhas), linhas, itens });
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <Cartao titulo="Para quanto tempo">
        <EscolhasDaLista conteudo={conteudo} periodo={periodo} aoMudarPeriodo={lista.escolherPeriodo} escolhas={escolhas} aoMudarEscolhas={lista.escolherOpcoes} />
      </Cartao>
      <Cartao titulo={tituloDaLista(periodo)}>
        {itens.length ? (
          <View style={estilos.progresso}>
            <Texto numerico style={estilos.forte} accessibilityLiveRegion="polite">{textoDaContagem(contagem)}</Texto>
            <BarraProgresso feitas={contagem.comprados} total={contagem.total} cor={marcaPeca} trilho={cores.superficie3} />
          </View>
        ) : (
          <Vazio titulo="Nada para listar" texto="A dieta não tem itens com quantidade." />
        )}
        <LinhaDeAcoes>
          {contagem.comprados > 0 && !ajustando ? <Botao rotulo="Limpar marcações" tipo="secundario" aoTocar={limpar} /> : null}
          {itens.length ? (
            <Botao rotulo={ajustando ? 'Concluir ajustes' : 'Ajustar lista'} tipo="secundario" Icone={SlidersHorizontal} aoTocar={() => setAjustando(!ajustando)} />
          ) : null}
          <Botao rotulo="Adicionar item" tipo="acao" Icone={Plus} aoTocar={() => setEdicao({ tipo: 'avulso', item: null })} />
        </LinhaDeAcoes>
        <Texto variante="suave">{NOTA_DA_LISTA_ALUNO}</Texto>
        <Texto variante="suave">Marcações, ajustes e itens adicionados ficam só neste aparelho e não mudam a dieta.</Texto>
      </Cartao>
      {grupos.map((g) => (
        <Cartao key={g.chave} cabecalho={<CabecalhoDeGrupo titulo={g.titulo} resumo={contagemDoGrupo(g.itens.length)} />}>
          <ListaDeLinhas divisorias>
            {g.itens.map((item) => (
              <LinhaDoItem
                key={item.chave}
                item={item}
                ajustando={ajustando}
                aoMarcar={() => lista.mudarMarcacoes((m) => alternarComprado(m, item.chave))}
                aoAjustar={() => setEdicao(item.avulso ? { tipo: 'avulso', item } : { tipo: 'ajuste', item })}
                aoRemover={() => remover(item)}
              />
            ))}
          </ListaDeLinhas>
        </Cartao>
      ))}
      <NoPlano funcionalidade="PDF">
        <Botao rotulo="Baixar PDF da lista" tipo="secundario" cheio Icone={FileDown} carregando={gerando} desabilitado={!itens.length} motivo="A lista está vazia." aoTocar={() => void pdf()} />
      </NoPlano>
      {edicao?.tipo === 'ajuste' ? (
        <FolhaAjuste
          item={edicao.item}
          ajustado={!!marcacoes.ajustes[edicao.item.chave]}
          inicial={edicao.item.linha ? quantidadeParaAjustar(edicao.item.linha, marcacoes.ajustes[edicao.item.chave]) : { quantidade: '', unidade: '' }}
          aoFechar={() => setEdicao(null)}
          aoSalvar={(q) => {
            lista.mudarMarcacoes((m) => ajustarQuantidade(m, edicao.item.chave, q));
            setEdicao(null);
          }}
          aoVoltarAoCalculado={() => {
            lista.mudarMarcacoes((m) => voltarAoCalculado(m, edicao.item.chave));
            setEdicao(null);
          }}
        />
      ) : null}
      {edicao?.tipo === 'avulso' ? (
        <FolhaAvulso
          item={edicao.item?.avulso ?? null}
          quantos={marcacoes.avulsos.length}
          aoFechar={() => setEdicao(null)}
          aoSalvar={(avulso) => {
            lista.mudarMarcacoes((m) => gravarAvulso(m, avulso));
            setEdicao(null);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Uma linha da lista (A7, 25/11): caixa redonda à esquerda, nome e, à direita, a quantidade. Tocar no nome também marca
 * (fora do modo de ajuste); o foco e o leitor de tela ficam na caixa. Comprado = nome e quantidade riscados em
 * `textoSuave` (sem opacidade, que derrubava o contraste, A12) e o item desce para o fim do grupo. No modo de ajuste
 * entram o lápis (ajustar ou editar o avulso) e a lixeira do avulso; no celular a quantidade desce para baixo do nome
 * para o nome não espremer entre ela e os botões.
 */
function LinhaDoItem({ item, ajustando, aoMarcar, aoAjustar, aoRemover }: {
  item: ItemDaListaDoAluno;
  ajustando: boolean;
  aoMarcar: () => void;
  aoAjustar: () => void;
  aoRemover: () => void;
}) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const [aceso, setAceso] = useState(false);
  const origem = textoDaOrigem(item.origem);
  const descricao = item.calculado ? `Calculado: ${item.calculado}` : item.linha ? detalheDaConversao(item.linha) : null;
  const riscado = item.comprado ? [estilos.riscado, { color: cores.textoSuave }] : null;
  const quantidadeAbaixo = ajustando && width < LARGURA_MENU_LATERAL;
  const quantidade = (
    <Texto numerico style={[quantidadeAbaixo ? null : estilos.quantidade, riscado]}>{item.quantidade}</Texto>
  );
  // Realce só com o mouse e só quando a linha marca: com o dedo, a linha piscaria ao rolar.
  const realce = ajustando ? null : {
    onPointerEnter: (e: PointerEvent) => { if (e.nativeEvent.pointerType === 'mouse') setAceso(true); },
    onPointerLeave: () => setAceso(false),
  };
  return (
    <View {...realce} style={[estilos.linha, { backgroundColor: aceso && !ajustando ? cores.sobre : 'transparent' }]}>
      <CaixaRedonda rotulo={`${item.nome}, marcar como comprado`} marcado={item.comprado} aoMudar={aoMarcar} />
      <Pressable focusable={false} accessible={false} disabled={ajustando} onPress={aoMarcar} style={estilos.miolo}>
        <View style={estilos.textos}>
          <Texto style={[estilos.nome, riscado]}>{item.nome}</Texto>
          {quantidadeAbaixo ? quantidade : null}
          {descricao ? <Texto variante="suave" numberOfLines={2}>{descricao}</Texto> : null}
          {origem ? <View style={estilos.selos}><Selo texto={origem} tipo="neutro" /></View> : null}
        </View>
        {quantidadeAbaixo ? null : quantidade}
      </Pressable>
      {ajustando ? (
        <View style={estilos.acoes}>
          <IconeBotao Icone={Pencil} rotulo={`${item.avulso ? 'Editar' : 'Ajustar'} ${item.nome}`} aoTocar={aoAjustar} />
          {item.avulso ? <IconeBotao Icone={Trash2} rotulo={`Remover ${item.nome}`} aoTocar={aoRemover} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Quantidade própria de um item calculado. Não muda a dieta: só o que aparece na lista e no PDF deste aparelho. */
function FolhaAjuste({ item, ajustado, inicial, aoFechar, aoSalvar, aoVoltarAoCalculado }: {
  item: ItemDaListaDoAluno;
  ajustado: boolean;
  inicial: { quantidade: string; unidade: string };
  aoFechar: () => void;
  aoSalvar: (q: { quantidade: string; unidade: string }) => void;
  aoVoltarAoCalculado: () => void;
}) {
  const [quantidade, setQuantidade] = useState(inicial.quantidade);
  const [unidade, setUnidade] = useState(inicial.unidade);
  const [erros, setErros] = useState<ErrosDoItem>({});
  const salvar = () => {
    const e = errosDoAjuste({ quantidade, unidade });
    setErros(e);
    if (semErros(e)) aoSalvar({ quantidade, unidade });
  };
  const calculado = item.calculado ?? item.quantidade;
  return (
    <Folha
      visivel
      titulo="Ajustar quantidade"
      aoFechar={aoFechar}
      rodape={
        <LinhaDeAcoes alinhar="entre">
          <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={aoFechar} />
          <LinhaDeAcoes>
            {ajustado ? <Botao rotulo="Voltar ao calculado" tipo="secundario" aoTocar={aoVoltarAoCalculado} /> : null}
            <Botao rotulo="Salvar" aoTocar={salvar} />
          </LinhaDeAcoes>
        </LinhaDeAcoes>
      }>
      <Texto variante="bloco">{item.nome}</Texto>
      <Texto variante="suave">Calculado pela dieta: {calculado}. O ajuste vale só na sua lista, neste aparelho.</Texto>
      <View style={estilos.campos}>
        <Campo rotulo="Quantidade" valor={quantidade} aoMudar={setQuantidade} erro={erros.quantidade} maxLength={LIMITE_QUANTIDADE_LIVRE} />
        <Campo rotulo="Unidade (opcional)" valor={unidade} aoMudar={setUnidade} erro={erros.unidade} maxLength={LIMITE_UNIDADE_LIVRE} ajuda="Ex.: kg, pacote, bandeja" />
      </View>
    </Folha>
  );
}

/** Item acrescentado pelo aluno: nome obrigatório, quantidade e unidade livres. */
function FolhaAvulso({ item, quantos, aoFechar, aoSalvar }: {
  item: ItemAvulso | null;
  quantos: number;
  aoFechar: () => void;
  aoSalvar: (item: ItemAvulso) => void;
}) {
  const [nome, setNome] = useState(item?.nome ?? '');
  const [quantidade, setQuantidade] = useState(item?.quantidade ?? '');
  const [unidade, setUnidade] = useState(item?.unidade ?? '');
  const [erros, setErros] = useState<ErrosDoItem>({});
  const salvar = () => {
    const dados = { nome, quantidade, unidade };
    const e = errosDoAvulso(dados, item ? 0 : quantos);
    setErros(e);
    if (semErros(e)) aoSalvar({ id: item?.id ?? novoUid(), ...dados });
  };
  return (
    <Folha
      visivel
      titulo={item ? 'Editar item' : 'Adicionar item'}
      aoFechar={aoFechar}
      rodape={
        <LinhaDeAcoes alinhar="entre">
          <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={aoFechar} />
          <Botao rotulo={item ? 'Salvar' : 'Adicionar'} aoTocar={salvar} />
        </LinhaDeAcoes>
      }>
      <Texto variante="suave">O item entra só na sua lista, neste aparelho; a dieta não muda.</Texto>
      <View style={estilos.campos}>
        <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={erros.nome} maxLength={LIMITE_NOME_AVULSO} />
        <Campo rotulo="Quantidade (opcional)" valor={quantidade} aoMudar={setQuantidade} erro={erros.quantidade} maxLength={LIMITE_QUANTIDADE_LIVRE} />
        <Campo rotulo="Unidade (opcional)" valor={unidade} aoMudar={setUnidade} erro={erros.unidade} maxLength={LIMITE_UNIDADE_LIVRE} ajuda="Ex.: kg, pacote, bandeja" />
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  progresso: { gap: espaco(1) },
  forte: { fontFamily: fontes.semi, fontSize: 16 },
  acoes: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: 56, paddingHorizontal: espaco(0.5) },
  miolo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: espaco(2), paddingVertical: espaco(1), minHeight: 48 },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  nome: { fontFamily: fontes.semi },
  // A quantidade não encolhe até sumir: no máximo 45% da linha, quebrando dentro dela ("1 pacote de 1 kg").
  quantidade: { flexShrink: 0, maxWidth: '45%', textAlign: 'right' },
  riscado: { textDecorationLine: 'line-through' },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  campos: { gap: espaco(2) },
});
