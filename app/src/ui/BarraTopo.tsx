import { usePathname } from 'expo-router';
import { LayoutGrid } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { nomeDaTela, telasPermitidas } from '../dominio/telas';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MENU_EXPANDIDO } from '../tema/tokens';
import { Botao } from './Botao';
import { CartaoDoUsuario } from './CartaoDoUsuario';
import { BuscaGlobal } from './BuscaGlobal';
import { IconeBotao } from './IconeBotao';
import { Texto } from './Texto';
import { TodasAsTelas } from './TodasAsTelas';
import { useFavoritos } from './useFavoritos';

/**
 * Barra de topo do treinador na web (o `Navegacao` só a monta com o menu lateral): nome da tela à esquerda (a
 * consultoria já está no menu e no título da página, por isso não se repete aqui), busca "O que você deseja fazer?"
 * ao centro, o botão "Todas as telas" (com favoritos; só ícone no trilho até 1024 px) e o cartão do usuário à
 * direita. No celular não existe.
 */
export function BarraTopo() {
  const caminho = usePathname();
  const { marca, pode } = useSessao();
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const permitidas = useMemo(() => telasPermitidas(pode), [pode]);
  const tela = nomeDaTela(caminho);
  const { favoritos, alternar } = useFavoritos();
  const [todas, setTodas] = useState(false);
  const estreita = width < LARGURA_MENU_EXPANDIDO;
  return (
    <View style={[estilos.barra, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={estilos.titulo}>
        <Texto variante="bloco" numberOfLines={1} accessibilityLabel={`${marca?.nome ?? 'Treinos'}: ${tela ?? ''}`}>{tela ?? marca?.nome ?? 'Treinos'}</Texto>
      </View>
      <View style={estilos.centro}>
        <BuscaGlobal permitidas={permitidas} favoritos={favoritos} largura={estreita ? 320 : 440} />
      </View>
      <View style={estilos.direita}>
        {estreita
          ? <IconeBotao Icone={LayoutGrid} rotulo="Todas as telas" aoTocar={() => setTodas(true)} />
          : <Botao rotulo="Todas as telas" tipo="fantasma" Icone={LayoutGrid} aoTocar={() => setTodas(true)} />}
        <CartaoDoUsuario compacto={estreita} />
      </View>
      <TodasAsTelas visivel={todas} aoFechar={() => setTodas(false)} permitidas={permitidas} favoritos={favoritos} aoAlternarFavorito={alternar} />
    </View>
  );
}

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
  titulo: { flex: 1, minWidth: 0 },
  centro: { flex: 2, minWidth: 0, alignItems: 'center' },
  direita: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: espaco(1) },
});
