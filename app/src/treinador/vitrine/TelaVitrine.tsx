import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Store } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { baixarFotoDoItem, itensDaVitrine, ordenarItensDaVitrine } from '../../api/rotas';
import type { ItemDaVitrine } from '../../api/vitrineTipos';
import { MiniaturaDoItem } from '../../aluno/vitrine/MiniaturaDoItem';
import { contagemDeItens, moverItem, podeAdicionarItem, rotuloDoTipo, textoDoPreco } from '../../dominio/vitrine';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR, LARGURA_EDITOR_DE_CAMPOS, LARGURA_LISTA } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Tela, useFaixaDaTela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { ehConflito } from '../financeiro/comum';
import { CartaoPaginaPublica } from './CartaoPaginaPublica';
import { FolhaDoItem } from './FolhaDoItem';

/**
 * Vitrine da consultoria (F1.3 de `docs/planos/vitrine-e-loja.md`): os itens que a equipe mostra aos alunos, ativos e
 * inativos, na ordem da vitrine. Criar, editar, ordenar, foto e excluir pedem `VITRINE_ALTERAR`; sem ela, só leitura.
 * A chave desligada e a falta de `VITRINE_LER` ficam na guarda da rota (`GuardaDePermissao`).
 */
export function TelaVitrine() {
  const { pode, lojaHabilitada } = useSessao();
  const { avisar } = useAviso();
  const podeAlterar = pode('VITRINE_ALTERAR');
  const lista = useCarregar('vitrine-da-equipe', () => itensDaVitrine());
  const { recarregar, definir } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const [aberto, setAberto] = useState<ItemDaVitrine | 'novo' | null>(null);
  const [movendo, setMovendo] = useState(false);
  const itens = lista.dados;
  const adicionar = podeAdicionarItem(itens?.length ?? 0);

  const mover = (id: string, sentido: 'subir' | 'descer') => {
    if (!itens) return;
    const ids = moverItem(itens.map((i) => i.id), id, sentido);
    // A troca aparece na hora; a lista volta do servidor depois (a ordem sobe a versão dos itens).
    definir(ids.map((x) => itens.find((i) => i.id === x)!));
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

  const ocupado = movendo || lista.carregando;
  return (
    <Tela largura={LARGURA_LISTA}>
      <Cabecalho titulo="Vitrine" subtitulo="Produtos e serviços que seus alunos veem no app."
        acoes={podeAlterar && itens ? (
          <Botao rotulo="Novo item" Icone={Plus} aoTocar={() => setAberto('novo')} desabilitado={!adicionar.pode}
            motivo={adicionar.motivo ?? undefined} />
        ) : undefined} />
      <Colunas lateral={lojaHabilitada ? <CartaoPaginaPublica podeAlterar={podeAlterar} /> : null}>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!itens && lista.carregando ? <Esqueleto texto="Carregando a vitrine" /> : null}
      {itens && itens.length === 0 ? (
        <Vazio Icone={Store} titulo="Nenhum item na vitrine"
          texto={podeAlterar ? 'Toque em "Novo item" para mostrar aos alunos um produto ou serviço, com foto, preço, cupom e link.' : 'A equipe ainda não colocou itens na vitrine.'} />
      ) : null}
      {itens && itens.length > 0 ? (
        <Cartao titulo="Itens" descricao={`${contagemDeItens(itens.length)} itens. Os alunos veem só os ativos, nesta ordem.`}>
          <ListaDeLinhas>
            {itens.map((item, posicao) => {
              const preco = textoDoPreco(item);
              return (
                <LinhaDaLista key={item.id} titulo={item.nome}
                  metadados={[rotuloDoTipo(item.tipo), preco.atual, preco.validade].filter(Boolean).join(' · ')}
                  selos={seloDoItem(item, lojaHabilitada)}
                  inicio={<MiniaturaDoItem item={item} carregar={baixarFotoDoItem} tamanho={48} />}
                  aoTocarTextos={() => setAberto(item)}
                  acoes={(
                    <View style={estilos.setas}>
                      {podeAlterar && itens.length > 1 ? <>
                        <IconeBotao Icone={ArrowUp} rotulo={`Subir ${item.nome}`} desabilitado={ocupado || posicao === 0} aoTocar={() => mover(item.id, 'subir')} />
                        <IconeBotao Icone={ArrowDown} rotulo={`Descer ${item.nome}`} desabilitado={ocupado || posicao === itens.length - 1} aoTocar={() => mover(item.id, 'descer')} />
                      </> : null}
                      <IconeBotao Icone={podeAlterar ? Pencil : Eye} rotulo={`${podeAlterar ? 'Editar' : 'Ver'} ${item.nome}`} aoTocar={() => setAberto(item)} />
                    </View>
                  )} />
              );
            })}
          </ListaDeLinhas>
        </Cartao>
      ) : null}
      </Colunas>
      <FolhaDoItem item={aberto} podeAlterar={podeAlterar} aoFechar={() => setAberto(null)} aoMudar={recarregar}
        aoCriar={(novo) => { recarregar(); setAberto(novo); }} />
    </Tela>
  );
}

/**
 * Tela larga (revisão de 24/11): na faixa larga ou maior a Página pública vira a coluna da esquerda (1fr) e os itens a da
 * direita (2fr), o par até `LARGURA_EDITOR_DE_CAMPOS`; sem a página, a lista para em `LARGURA_EDITOR`. Abaixo, empilhados
 * como antes. Uma árvore só nas duas formas: cruzar a faixa não remonta a página nem a lista.
 */
function Colunas({ lateral, children }: { lateral: ReactNode; children: ReactNode }) {
  const faixa = useFaixaDaTela();
  const larga = faixa === 'larga' || faixa === 'ultralarga';
  const lado = larga && !!lateral;
  return (
    <View testID="colunas-da-vitrine" style={[estilos.empilhado, lado && estilos.ladoALado, larga && { maxWidth: lateral ? LARGURA_EDITOR_DE_CAMPOS : LARGURA_EDITOR }]}>
      {lateral ? <View style={lado ? estilos.lateral : undefined}>{lateral}</View> : null}
      <View style={[estilos.empilhado, lado && estilos.principal]}>{children}</View>
    </View>
  );
}

/** Inativo some de tudo; ativo, digital e marcado é o que a página pública mostra (a API só manda esses). Neutros: não pedem ação. */
function seloDoItem(item: ItemDaVitrine, lojaHabilitada: boolean): { texto: string; tipo: 'neutro' }[] | undefined {
  if (!item.ativo) return [{ texto: 'Inativo', tipo: 'neutro' }];
  if (lojaHabilitada && item.naPaginaPublica && item.tipo === 'DIGITAL') return [{ texto: 'Na página pública', tipo: 'neutro' }];
  return undefined;
}

const estilos = StyleSheet.create({
  setas: { flexDirection: 'row', gap: espaco(0.5) },
  // O mesmo vão da `Tela` entre blocos (24 px), também entre as duas colunas.
  empilhado: { gap: espaco(3) },
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start' },
  lateral: { flex: 1, minWidth: 0 },
  principal: { flex: 2, minWidth: 0 },
});
