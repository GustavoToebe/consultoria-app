import { router, type Href } from 'expo-router';
import { FileText, History, Inbox, LayoutGrid, LifeBuoy, Palette, UsersRound, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarInscricoes } from '../../api/rotas';
import { itensDoMenuDoUsuario } from '../../dominio/menuDoUsuario';
import { telasPermitidas } from '../../dominio/telas';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { ICONES_DO_MENU } from '../../ui/CartaoDoUsuario';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { Permitido } from '../../ui/Permitido';
import { Tela } from '../../ui/Tela';
import { TodasAsTelas } from '../../ui/TodasAsTelas';
import { useCarregar } from '../../ui/useCarregar';
import { useFavoritos } from '../../ui/useFavoritos';

/**
 * Perfil: porta de entrada da conta no celular (no PC isso é o cartão do usuário na barra de topo). Mostra os mesmos
 * itens do menu do usuário, a busca de telas (no celular não há barra de topo) e os atalhos para ajuda, interessados,
 * marca, equipe e auditoria (que no celular não cabem na barra). As telas abertas daqui voltam para cá pela seta.
 */
export default function PerfilTreinador() {
  const { usuario, perfilEquipe, pode, funcionalidadesDoPlano, pagamentosHabilitados } = useSessao();
  const [saindo, setSaindo] = useState(false);
  const [todas, setTodas] = useState(false);
  const permitidas = useMemo(() => telasPermitidas(pode, undefined, funcionalidadesDoPlano, pagamentosHabilitados), [pode, funcionalidadesDoPlano, pagamentosHabilitados]);
  const { favoritos, alternar } = useFavoritos();
  // Inscrições novas: o mesmo aviso do ponto no menu, aqui com a contagem.
  const novas = useCarregar(pode('INSCRICAO_LER') ? 'perfil-inscricoes-novas' : null, () => listarInscricoes({ situacao: 'NOVA', meus: false, pagina: 0 }));
  const totalNovas = novas.dados?.total ?? 0;
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Perfil" subtitulo={[usuario?.nome, perfilEquipe?.nome].filter(Boolean).join(' · ') || undefined} />
      <ItemDeLista titulo="Buscar telas" detalhe="Todas as telas do app, com busca e favoritos" Icone={LayoutGrid} aoTocar={() => setTodas(true)} />
      <Cartao titulo="Sua conta">
        <View style={estilos.lista}>
          {itensDoMenuDoUsuario(pode).map((item) => (
            <ItemDeLista key={item.id} titulo={item.rotulo} Icone={ICONES_DO_MENU[item.id]} perigo={item.id === 'sair'}
              href={item.href === null ? undefined : (item.href as Href)}
              aoTocar={() => (item.href === null ? setSaindo(true) : router.navigate(item.href as Href))} />
          ))}
        </View>
      </Cartao>
      <Cartao titulo="Atalhos" descricao="Páginas de apoio e de gestão da consultoria.">
        <View style={estilos.lista}>
          <Permitido codigo="INSCRICAO_LER"><ItemDeLista href="/treinador/interessados" Icone={Inbox} titulo="Interessados" detalhe="Link de inscrição e a fila de quem quer ser aluno"
            selo={totalNovas > 0 ? { texto: totalNovas === 1 ? '1 nova' : `${totalNovas} novas`, tipo: 'atencao' } : undefined} /></Permitido>
          {pagamentosHabilitados ? (
            <Permitido codigo="FINANCEIRO_LER"><ItemDeLista href="/treinador/financeiro" Icone={Wallet} titulo="Financeiro" detalhe="Planos comerciais, cobranças e recebimentos dos alunos" /></Permitido>
          ) : null}
          <Permitido codigo="MARCA_ALTERAR"><ItemDeLista href="/treinador/marca" Icone={Palette} titulo="Marca" detalhe="Nome, logo, cor e tema dos alunos" /></Permitido>
          <Permitido codigo="EQUIPE_LER"><ItemDeLista href="/treinador/equipe" Icone={UsersRound} titulo="Equipe" detalhe="Membros, perfis e convites" /></Permitido>
          <Permitido codigo="AUDITORIA_LER"><ItemDeLista href="/treinador/auditoria" Icone={History} titulo="Auditoria" detalhe="O que foi feito na consultoria" /></Permitido>
          <ItemDeLista href="/treinador/ajuda" Icone={LifeBuoy} titulo="Ajuda" detalhe="Primeiros passos, tutorial e perguntas" />
          <ItemDeLista href="/treinador/termos" Icone={FileText} titulo="Termos e privacidade" detalhe="Termo de uso e aviso de privacidade" />
        </View>
      </Cartao>
      <TodasAsTelas visivel={todas} aoFechar={() => setTodas(false)} permitidas={permitidas} favoritos={favoritos} aoAlternarFavorito={alternar} />
      <ConfirmarSaida visivel={saindo} aoFechar={() => setSaindo(false)} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
});
