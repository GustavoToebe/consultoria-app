import { ArrowDown, ArrowUp, FolderCog, Plus, Store } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { itensDaVitrine, ordenarItensDaVitrine } from '../../api/rotas';
import { categoriasDaVitrine } from '../../api/vitrineCategorias';
import type { ItemDaVitrine } from '../../api/vitrineTipos';
import { colunasDaVitrine, contagemDeItens, LARGURA_DA_GRADE_COMPACTA, podeAdicionarItem } from '../../dominio/vitrine';
import { agruparPorCategoria, categoriaDoItemDaEquipe, idsDepoisDeMoverNoGrupo, type GrupoDaVitrine } from '../../dominio/vitrineCategorias';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FORMULARIO, LARGURA_LISTA } from '../../tema/tokens';
import { ItemArrastavel, ListaArrastavel } from '../../ui/ArrasteDaLista';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tela, useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { ehConflito } from '../financeiro/comum';
import { CartaoDoProduto, rotuloDoMenuDoItem } from './CartaoDoProduto';
import { CartaoPaginaPublica } from './CartaoPaginaPublica';
import { FolhaCategorias } from './FolhaCategorias';
import { FolhaDoItem } from './FolhaDoItem';

/** 16 px entre os cartões (o vão também guarda a linha guia do arrastar). */
const VAO_DA_GRADE = espaco(2);
/** Largura da coluna da Página pública ao lado da grade. */
const LARGURA_DA_LATERAL = 380;

/**
 * Vitrine da consultoria (F1.3 de `docs/planos/vitrine-e-loja.md`; grade e categorias em `docs/planos/vitrine-categorias.md`):
 * os itens que a equipe mostra aos alunos, ativos e inativos, numa grade de cartões agrupada por categoria, na ordem que o
 * aluno vê. Criar, editar, ordenar, foto, categorias e excluir pedem `VITRINE_ALTERAR`; sem ela, só leitura. A chave
 * desligada e a falta de `VITRINE_LER` ficam na guarda da rota (`GuardaDePermissao`).
 */
export function TelaVitrine() {
  const { pode, lojaHabilitada } = useSessao();
  const { avisar } = useAviso();
  const podeAlterar = pode('VITRINE_ALTERAR');
  const lista = useCarregar('vitrine-da-equipe', () => itensDaVitrine());
  const categorias = useCarregar('vitrine-categorias', () => categoriasDaVitrine());
  const { recarregar, definir } = lista;
  const recarregarCategorias = categorias.recarregar;
  const recarregarTudo = useCallback(() => { recarregar(); recarregarCategorias(); }, [recarregar, recarregarCategorias]);
  useFocusEffect(recarregarTudo);
  const [aberto, setAberto] = useState<ItemDaVitrine | 'novo' | null>(null);
  const [organizando, setOrganizando] = useState(false);
  const [menuDe, setMenuDe] = useState<ItemDaVitrine | null>(null);
  const [movendo, setMovendo] = useState(false);
  const { largura, aoMedir } = useFaixaDeLargura();
  const itens = lista.dados;
  const grupos = itens ? agruparPorCategoria(itens, categoriaDoItemDaEquipe) : [];
  const adicionar = podeAdicionarItem(itens?.length ?? 0);

  /** A ordem nova aparece na hora; a API recebe a lista completa (categorias na ordem, sem categoria por último). */
  const aplicarOrdem = (ids: string[]) => {
    if (!itens) return;
    definir(ids.map((x) => itens.find((i) => i.id === x)).filter((i): i is ItemDaVitrine => !!i));
    setMovendo(true);
    ordenarItensDaVitrine(ids).then(
      () => { setMovendo(false); recarregar(); },
      (e: unknown) => {
        setMovendo(false);
        avisar(ehConflito(e) ? 'A vitrine mudou em outro lugar. Recarregamos para você conferir.' : textoDoErro(e), ehConflito(e) ? 'neutro' : 'perigo');
        recarregar();
      },
    );
  };
  const soltar = (chave: string | null, de: number, para: number) => {
    const antes = itens?.map((i) => i.id) ?? [];
    aplicarOrdem(idsDepoisDeMoverNoGrupo(grupos, chave, de, para));
    return () => aplicarOrdem(antes);
  };
  /** O caminho sem arrastar (⋯ → Mover para cima/baixo): uma posição dentro da categoria; o foco volta ao ⋯ do item. */
  const moverUm = (item: ItemDaVitrine, sentido: -1 | 1) => {
    const g = grupos.find((x) => x.itens.some((i) => i.id === item.id));
    if (!g) return;
    const de = g.itens.findIndex((i) => i.id === item.id);
    aplicarOrdem(idsDepoisDeMoverNoGrupo(grupos, g.chave, de, de + sentido));
    avisar('Ordem alterada.', 'neutro');
    if (Platform.OS === 'web') setTimeout(() => (document.querySelector(`[aria-label="${CSS.escape(rotuloDoMenuDoItem(item.nome))}"]`) as HTMLElement | null)?.focus());
  };
  const grupoDoMenu = menuDe ? grupos.find((g) => g.itens.some((i) => i.id === menuDe.id)) : undefined;
  const posicaoNoMenu = menuDe && grupoDoMenu ? grupoDoMenu.itens.findIndex((i) => i.id === menuDe.id) : -1;

  const compacto = largura > 0 && largura < LARGURA_DA_GRADE_COMPACTA;
  const ordenavel = podeAlterar && !movendo && !lista.carregando;
  return (
    <Tela largura={LARGURA_LISTA}>
      <Cabecalho titulo="Vitrine" subtitulo="Produtos e serviços que seus alunos veem no app."
        acoes={podeAlterar && itens ? (
          <LinhaDeAcoes>
            <Botao rotulo="Organizar categorias" tipo="secundario" Icone={FolderCog} aoTocar={() => setOrganizando(true)} />
            <Botao rotulo="Novo item" Icone={Plus} aoTocar={() => setAberto('novo')} desabilitado={!adicionar.pode} motivo={adicionar.motivo ?? undefined} />
          </LinhaDeAcoes>
        ) : undefined} />
      <Colunas lateral={lojaHabilitada ? <CartaoPaginaPublica podeAlterar={podeAlterar} /> : null}>
        {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
        {!itens && lista.carregando ? <Esqueleto texto="Carregando a vitrine" /> : null}
        {itens && itens.length === 0 ? (
          <Vazio Icone={Store} titulo="Nenhum item na vitrine"
            texto={podeAlterar ? 'Toque em "Novo item" para mostrar aos alunos um produto ou serviço, com foto, preço, cupom e link.' : 'A equipe ainda não colocou itens na vitrine.'} />
        ) : null}
        {itens && itens.length > 0 ? (
          <View style={estilos.itens} onLayout={aoMedir}>
            <View style={estilos.topoDosItens}>
              <Texto variante="subtitulo" nivel={2}>Itens</Texto>
              <Texto variante="suave">{`${contagemDeItens(itens.length)} itens. Os alunos veem só os ativos, nesta ordem.`}</Texto>
            </View>
            {grupos.map((g) => (
              <GrupoDeItens key={g.chave ?? 'sem-categoria'} grupo={g} compacto={compacto} ordenavel={ordenavel}
                aoSoltar={(de, para) => soltar(g.chave, de, para)}
                cartao={(item, arraste) => (
                  <CartaoDoProduto item={item} podeAlterar={podeAlterar} lojaHabilitada={lojaHabilitada} compacto={compacto} arraste={arraste}
                    aoMenu={podeAlterar && g.itens.length > 1 ? () => setMenuDe(item) : undefined} aoEditar={() => setAberto(item)} />
                )} />
            ))}
          </View>
        ) : null}
      </Colunas>
      <FolhaDoItem item={aberto} podeAlterar={podeAlterar} categorias={categorias.dados} aoFechar={() => setAberto(null)} aoMudar={recarregarTudo} />
      {organizando ? (
        <FolhaCategorias categorias={categorias.dados} erroDasCategorias={categorias.erro} aoFechar={() => setOrganizando(false)}
          definir={categorias.definir} atualizar={recarregarTudo} />
      ) : null}
      {menuDe && grupoDoMenu ? (
        <FolhaDeAcoes titulo={`Ações de “${menuDe.nome}”`} aoFechar={() => setMenuDe(null)} acoes={[
          posicaoNoMenu > 0 && { rotulo: 'Mover para cima', detalhe: movendo ? 'Aguarde salvar a ordem.' : 'Uma posição antes na categoria.', Icone: ArrowUp, desabilitado: movendo, aoTocar: () => moverUm(menuDe, -1) },
          posicaoNoMenu < grupoDoMenu.itens.length - 1 && { rotulo: 'Mover para baixo', detalhe: movendo ? 'Aguarde salvar a ordem.' : 'Uma posição depois na categoria.', Icone: ArrowDown, desabilitado: movendo, aoTocar: () => moverUm(menuDe, 1) },
        ]} />
      ) : null}
    </Tela>
  );
}

/** Um grupo da grade: o subtítulo da categoria (sem ele quando nenhum item tem categoria) e os cartões, que se arrastam dentro dele. */
function GrupoDeItens({ grupo, compacto, ordenavel, aoSoltar, cartao }: {
  grupo: GrupoDaVitrine<ItemDaVitrine>;
  compacto: boolean;
  ordenavel: boolean;
  aoSoltar: (de: number, para: number) => () => void;
  cartao: (item: ItemDaVitrine, arraste?: Parameters<typeof CartaoDoProduto>[0]['arraste']) => ReactNode;
}) {
  const { cores } = useTema();
  return (
    <View style={estilos.grupo}>
      {grupo.titulo ? <Texto variante="secao" nivel={3} cor={cores.texto}>{grupo.titulo}</Texto> : null}
      {/* Durante o PUT a alça some (total 0): soltar de novo antes do 204 mostraria "Ordem alterada." sem ter mudado nada. */}
      <ListaArrastavel total={ordenavel ? grupo.itens.length : 0} eixo={compacto ? 'vertical' : 'linhas'} folga={VAO_DA_GRADE / 2} aoSoltar={aoSoltar}>
        {(lista) => (
          <View role="list" aria-label={grupo.titulo ?? 'Itens da vitrine'}>
            <Grade gap={VAO_DA_GRADE} colunas={(l) => colunasDaVitrine(l, VAO_DA_GRADE)}>
              {grupo.itens.map((item, i) => (
                <ItemArrastavel key={item.id} arraste={lista} indice={i} style={estilos.celula}>
                  {cartao(item, ordenavel && grupo.itens.length > 1 ? { lista, indice: i } : undefined)}
                </ItemArrastavel>
              ))}
            </Grade>
          </View>
        )}
      </ListaArrastavel>
    </View>
  );
}

/**
 * Tela larga (revisão de 24/11): na faixa larga ou maior a Página pública vira uma coluna de 380 px à esquerda e a grade
 * ocupa o resto (as colunas de cartões crescem com a largura, sem teto próprio). Abaixo, empilhados, a página até
 * `LARGURA_FORMULARIO`. Uma árvore só nas duas formas: cruzar a faixa não remonta a página nem a lista.
 */
function Colunas({ lateral, children }: { lateral: ReactNode; children: ReactNode }) {
  const faixa = useFaixaDaTela();
  const lado = (faixa === 'larga' || faixa === 'ultralarga') && !!lateral;
  return (
    <View testID="colunas-da-vitrine" style={[estilos.empilhado, lado && estilos.ladoALado]}>
      {lateral ? <View style={lado ? estilos.lateral : estilos.lateralEmpilhada}>{lateral}</View> : null}
      <View style={[estilos.empilhado, lado && estilos.principal]}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // O mesmo vão da `Tela` entre blocos (24 px), também entre as duas colunas.
  empilhado: { gap: espaco(3) },
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start' },
  lateral: { width: LARGURA_DA_LATERAL, flexShrink: 0 },
  lateralEmpilhada: { maxWidth: LARGURA_FORMULARIO },
  principal: { flex: 1, minWidth: 0 },
  // Entre grupos o dobro do vão de dentro (32 × 12).
  itens: { gap: espaco(4) },
  topoDosItens: { gap: espaco(0.5), marginBottom: -espaco(1) },
  grupo: { gap: espaco(1.5) },
  celula: { flexGrow: 1 },
});
