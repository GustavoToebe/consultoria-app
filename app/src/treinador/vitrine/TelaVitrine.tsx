import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Store } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { baixarFotoDoItem, itensDaVitrine, ordenarItensDaVitrine } from '../../api/rotas';
import type { ItemDaVitrine } from '../../api/vitrineTipos';
import { MiniaturaDoItem } from '../../aluno/vitrine/MiniaturaDoItem';
import { contagemDeItens, moverItem, podeAdicionarItem, rotuloDoTipo, textoDoPreco } from '../../dominio/vitrine';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { ehConflito } from '../financeiro/comum';
import { FolhaDoItem } from './FolhaDoItem';

/**
 * Vitrine da consultoria (F1.3 de `docs/planos/vitrine-e-loja.md`): os itens que a equipe mostra aos alunos, ativos e
 * inativos, na ordem da vitrine. Criar, editar, ordenar, foto e excluir pedem `VITRINE_ALTERAR`; sem ela, só leitura.
 * A chave desligada e a falta de `VITRINE_LER` ficam na guarda da rota (`GuardaDePermissao`).
 */
export function TelaVitrine() {
  const { pode } = useSessao();
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
                  selos={item.ativo ? undefined : [{ texto: 'Inativo', tipo: 'neutro' }]}
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
      <FolhaDoItem item={aberto} podeAlterar={podeAlterar} aoFechar={() => setAberto(null)} aoMudar={recarregar}
        aoCriar={(novo) => { recarregar(); setAberto(novo); }} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  setas: { flexDirection: 'row', gap: espaco(0.5) },
});
