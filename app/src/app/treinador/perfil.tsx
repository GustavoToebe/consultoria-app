import { router, type Href } from 'expo-router';
import { History, LifeBuoy, Palette, ShieldCheck, UserPlus, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { itensDoMenuDoUsuario } from '../../dominio/menuDoUsuario';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { ICONES_DO_MENU } from '../../ui/CartaoDoUsuario';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { Permitido } from '../../ui/Permitido';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Perfil: porta de entrada da conta no celular (no PC isso é o cartão do usuário na barra de topo). Mostra os mesmos
 * itens do menu do usuário, mais atalhos para ajuda, interessados, marca, equipe e auditoria (que no celular não cabem na barra).
 */
export default function PerfilTreinador() {
  const { usuario, perfilEquipe, pode } = useSessao();
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
          {itensDoMenuDoUsuario(pode).map((item) => (
            <ItemDeLista key={item.id} titulo={item.rotulo} Icone={ICONES_DO_MENU[item.id]} perigo={item.id === 'sair'}
              aoTocar={() => (item.href === null ? setSaindo(true) : router.navigate(item.href as Href))} />
          ))}
        </View>
      </Cartao>
      <Cartao titulo="Atalhos" descricao="Páginas de apoio e de gestão da consultoria.">
        <View style={estilos.lista}>
          <ItemDeLista href="/treinador/ajuda" Icone={LifeBuoy} titulo="Ajuda" detalhe="Primeiros passos, tutorial e perguntas" />
          <ItemDeLista href="/treinador/termos" Icone={ShieldCheck} titulo="Termos e privacidade" detalhe="Termo de uso e aviso de privacidade" />
          <Permitido codigo="INSCRICAO_LER"><ItemDeLista href="/treinador/interessados" Icone={UserPlus} titulo="Interessados" detalhe="Link de inscrição e a fila de quem quer ser aluno" /></Permitido>
          <Permitido codigo="MARCA_ALTERAR"><ItemDeLista href="/treinador/marca" Icone={Palette} titulo="Marca" detalhe="Nome, logo, cor e tema dos alunos" /></Permitido>
          <Permitido codigo="EQUIPE_LER"><ItemDeLista href="/treinador/equipe" Icone={UsersRound} titulo="Equipe" detalhe="Membros, perfis e convites" /></Permitido>
          <Permitido codigo="AUDITORIA_LER"><ItemDeLista href="/treinador/auditoria" Icone={History} titulo="Auditoria" detalhe="O que foi feito na consultoria" /></Permitido>
        </View>
      </Cartao>
      <ConfirmarSaida visivel={saindo} aoFechar={() => setSaindo(false)} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
});
