import { Redirect, router, useLocalSearchParams, usePathname, type Href } from 'expo-router';
import { Platform } from 'react-native';
import { SearchX } from 'lucide-react-native';
import { Fragment, useEffect, type ReactNode } from 'react';

import { BASE_DAS_CONFIGURACOES, caminhoDoItem, ehItemEmbutido, itemDoCaminho, type ItemEmbutido } from '../../dominio/rotasDasConfiguracoes';
import { LARGURA_FORMULARIO } from '../../tema/tokens';
import { TelaContratos } from '../contratos/TelaContratos';
import { TelaDocumentos } from '../documentos/TelaDocumentos';
import { TelaWhatsApp } from '../whatsapp/TelaWhatsApp';
import { Vazio } from '../../ui/Estados';
import { Tela } from '../../ui/Tela';
import { TelaDosTermos } from '../../ui/TelaDosTermos';
import { useCartoesDoPerfil, useDuasColunas } from './comum';
import { TelaAjustes } from './telas/TelaAjustes';
import { TelaContato } from './telas/TelaContato';
import { TelaMarca } from './telas/TelaMarca';
import { TelaMeusDados } from './telas/TelaMeusDados';
import { TelaMinhaConta } from './telas/TelaMinhaConta';
import { TelaPadroesDoAcompanhamento } from './telas/TelaPadroesDoAcompanhamento';
import { TelaSeguranca } from './telas/TelaSeguranca';
import { TelaTagsDosAlunos } from './telas/TelaTagsDosAlunos';

/** A mesma tela da rota inteira de cada item (`dominio/rotasDasConfiguracoes`); item novo no mapa não compila sem a tela aqui. */
const TELA_DO_ITEM: Record<ItemEmbutido, () => ReactNode> = {
  'meus-dados': () => <TelaMeusDados />,
  seguranca: () => <TelaSeguranca />,
  ajustes: () => <TelaAjustes />,
  'minha-conta': () => <TelaMinhaConta />,
  marca: () => <TelaMarca />,
  contato: () => <TelaContato />,
  'padroes-do-acompanhamento': () => <TelaPadroesDoAcompanhamento />,
  'whatsapp-oficial': () => <TelaWhatsApp />,
  'documentos-pdf': () => <TelaDocumentos />,
  'tags-dos-alunos': () => <TelaTagsDosAlunos embutida />,
  contratos: () => <TelaContratos embutida />,
  termos: () => <TelaDosTermos />,
};

/**
 * `/treinador/configuracoes/<item>`: a tela do item na coluna da direita (a guarda já conferiu a rota inteira dele). Abaixo
 * de 1024 px de janela não há coluna: vai para a rota inteira, com a seta e o voltar de sempre; a tela que só existe em
 * Configurações (o `href` do cartão é este endereço: Contato, Padrões do acompanhamento) abre aqui mesmo. Item que o perfil não vê
 * (sem a permissão extra, fora do plano ou com a chave desligada) mostra o vazio, sem a tela.
 */
export function TelaDoItem() {
  const { item } = useLocalSearchParams<{ item: string }>();
  const duas = useDuasColunas();
  const cartao = useCartoesDoPerfil().find((c) => c.id === item);
  const caminho = usePathname();
  useEnderecoDoItem(caminho);
  if (!cartao || !ehItemEmbutido(cartao.id)) {
    return (
      <Tela largura={LARGURA_FORMULARIO} bordas={['top']}>
        <Vazio Icone={SearchX} nivel={1} titulo="Configuração indisponível" texto="Ela não existe ou não está disponível para o seu perfil."
          acao={{ rotulo: 'Ver configurações', aoTocar: () => router.replace('/treinador/configuracoes') }} />
      </Tela>
    );
  }
  if (!duas && cartao.href !== caminhoDoItem(cartao.id)) return <Redirect href={cartao.href as Href} />;
  // A chave remonta a tela a cada item: a coluna da direita volta ao topo e nada de um item vaza para o outro.
  return <Fragment key={cartao.id}>{TELA_DO_ITEM[cartao.id]()}</Fragment>;
}

/**
 * Link direto ou recarregar (web): o estado do roteador já está no item (`usePathname` certo), mas o expo-router grava o
 * endereço antes de o layout aninhado montar (a sessão carrega antes) e sai `/treinador/configuracoes?item=<id>`; pior, ele
 * guarda esse estado sem a rota filha como o "anterior" e a próxima escolha substitui a entrada do histórico em vez de
 * empilhar (o voltar sairia da tela). Devolver o parâmetro à rota filha gera um estado novo, completo: o roteador regrava o
 * endereço certo e passa a comparar com ele.
 * shortcut: só existe por causa do layout aninhado montado tarde; troque por nada quando o expo-router guardar a rota filha nesse caso.
 */
function useEnderecoDoItem(caminho: string) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const item = itemDoCaminho(caminho);
    const quebrado = window.location.pathname === BASE_DAS_CONFIGURACOES && new URLSearchParams(window.location.search).get('item') === item;
    if (item && quebrado) router.setParams({ item });
  }, [caminho]);
}
