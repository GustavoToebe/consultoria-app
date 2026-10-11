import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { itensDoMenuDoUsuario } from '../../dominio/menuDoUsuario';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_EDITOR, RAIO } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { ICONES_DO_MENU } from '../../ui/CartaoDoUsuario';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { LinkTexto } from '../../ui/LinkTexto';
import { Permitido } from '../../ui/Permitido';
import { sobre } from '../../ui/sobre';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Perfil: porta de entrada da conta no celular (no PC isso é o cartão do usuário na barra de topo). Mostra os mesmos
 * itens do menu do usuário, mais atalhos para ajuda, equipe e auditoria.
 */
export default function PerfilTreinador() {
  const { usuario, perfilEquipe, pode } = useSessao();
  const { cores } = useTema();
  const [saindo, setSaindo] = useState(false);
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Perfil" />
      <Cartao>
        <Texto variante="bloco">{usuario?.nome ?? '—'}</Texto>
        <Texto variante="suave">{perfilEquipe?.nome ?? '—'}</Texto>
      </Cartao>
      <Cartao titulo="Conta">
        <View style={estilos.lista}>
          {itensDoMenuDoUsuario(pode).map((item) => {
            const Icone = ICONES_DO_MENU[item.id];
            const perigo = item.id === 'sair';
            return (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.rotulo}
                onPress={() => (item.href === null ? setSaindo(true) : router.navigate(item.href as Href))}
                style={(estado) => [estilos.item, { backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2, borderColor: cores.borda }]}>
                <Icone size={20} color={perigo ? cores.perigo : cores.textoSuave} strokeWidth={2} />
                <Texto style={[estilos.rotulo, perigo && { color: cores.perigo }]}>{item.rotulo}</Texto>
                {perigo ? null : <ChevronRight size={18} color={cores.textoSuave} strokeWidth={2} />}
              </Pressable>
            );
          })}
        </View>
      </Cartao>
      <Cartao titulo="Atalhos" descricao="Páginas de apoio e de gestão da consultoria.">
        <LinkTexto href="/treinador/ajuda" texto="Ajuda, primeiros passos e tutorial" />
        <Permitido codigo="EQUIPE_LER"><LinkTexto href="/treinador/equipe" texto="Equipe" /></Permitido>
        <Permitido codigo="AUDITORIA_LER"><LinkTexto href="/treinador/auditoria" texto="Auditoria" /></Permitido>
      </Cartao>
      <ConfirmarSaida visivel={saindo} aoFechar={() => setSaindo(false)} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), borderWidth: 1, borderRadius: RAIO },
  rotulo: { flex: 1, fontFamily: fontes.semi },
});
