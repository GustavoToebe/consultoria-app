import { usePathname } from 'expo-router';
import { LayoutGrid } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { telasPermitidas } from '../dominio/telas';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MENU_EXPANDIDO } from '../tema/tokens';
import { Botao } from './Botao';
import { CartaoDoUsuario } from './CartaoDoUsuario';
import { BuscaGlobal } from './BuscaGlobal';
import { IconeBotao } from './IconeBotao';
import { TodasAsTelas } from './TodasAsTelas';
import { useFavoritos } from './useFavoritos';

/**
 * Barra de topo do treinador na web (o `Navegacao` só a monta com o menu lateral): busca "O que você deseja fazer?"
 * à esquerda, o botão "Todas as telas" (com favoritos; só ícone no trilho até 1024 px) e o cartão do usuário à
 * direita. O nome da tela não se repete aqui: ele é o h1 da própria tela e o título da aba do navegador. O cartão do
 * usuário fica realçado nas telas da conta (Meus dados, Segurança, Minha conta, Ajustes). No celular não existe.
 */
export function BarraTopo() {
  const caminho = usePathname();
  const { pode, funcionalidadesDoPlano } = useSessao();
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const permitidas = useMemo(() => telasPermitidas(pode, undefined, funcionalidadesDoPlano), [pode, funcionalidadesDoPlano]);
  const { favoritos, alternar } = useFavoritos();
  const [todas, setTodas] = useState(false);
  const estreita = width < LARGURA_MENU_EXPANDIDO;
  const naConta = TELAS_DA_CONTA.some((t) => caminho === t || caminho.startsWith(`${t}/`));
  return (
    <View style={[estilos.barra, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={estilos.busca}>
        <BuscaGlobal permitidas={permitidas} favoritos={favoritos} largura={estreita ? 360 : 520} />
      </View>
      <View style={estilos.direita}>
        {estreita
          ? <IconeBotao Icone={LayoutGrid} rotulo="Todas as telas" aoTocar={() => setTodas(true)} />
          : <Botao rotulo="Todas as telas" tipo="fantasma" Icone={LayoutGrid} aoTocar={() => setTodas(true)} />}
        <CartaoDoUsuario compacto={estreita} ativo={naConta} />
      </View>
      <TodasAsTelas visivel={todas} aoFechar={() => setTodas(false)} permitidas={permitidas} favoritos={favoritos} aoAlternarFavorito={alternar} />
    </View>
  );
}

/** Telas abertas pelo cartão do usuário: com elas abertas o cartão fica realçado, como um item ativo do menu. */
const TELAS_DA_CONTA = ['/treinador/meus-dados', '/treinador/seguranca', '/treinador/minha-conta', '/treinador/ajustes'];

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(2),
    minHeight: 64,
    paddingHorizontal: espaco(3),
    paddingVertical: espaco(1),
    borderBottomWidth: 1,
    zIndex: 20,
  },
  // A busca encolhe antes dos botões da direita, que nunca encostam nela.
  busca: { flex: 1, flexShrink: 1, minWidth: 0 },
  direita: { flexShrink: 0, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: espaco(1) },
});
