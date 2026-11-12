import { router, type Href } from 'expo-router';
import { CalendarDays, FileText, FileUp, History, Inbox, LifeBuoy, Search, UsersRound, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarInscricoes } from '../../api/rotas';
import { destinosPermitidos } from '../../dominio/mapeamentoDaImportacao';
import { itensDoMenuDoUsuario } from '../../dominio/menuDoUsuario';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { useBuscaGlobal } from '../../ui/BuscaGlobal';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { ICONES_DO_MENU } from '../../ui/CartaoDoUsuario';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { textoDoErro } from '../../ui/erros';
import { MensagemErro } from '../../ui/Estados';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { Permitido } from '../../ui/Permitido';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Perfil: porta de entrada da conta no celular (no PC isso é o menu da conta, no rodapé do menu lateral). Os mesmos itens do
 * menu da conta, em dois grupos (guia de 11/11, pág. 17): "Minha conta" (o que é da pessoa) e "Consultoria" (o que é do
 * negócio, só o que o perfil pode abrir; Marca só para o Administrador). Depois "Buscar telas" (a busca global, com os
 * favoritos; no celular não há menu lateral), os atalhos e, separado da navegação, o "Sair". As telas abertas daqui voltam
 * para cá pela seta.
 */
const DA_CONSULTORIA = new Set(['minha-conta', 'marca']);
export default function PerfilTreinador() {
  const { usuario, perfilEquipe, pode, pagamentosHabilitados } = useSessao();
  const [saindo, setSaindo] = useState(false);
  const busca = useBuscaGlobal();
  const administrador = !!perfilEquipe?.acessoTotal;
  // Inscrições novas: o mesmo aviso do ponto no menu, aqui com a contagem.
  const novas = useCarregar(pode('INSCRICAO_LER') ? 'perfil-inscricoes-novas' : null, () => listarInscricoes({ situacao: 'NOVA', meus: false, pagina: 0 }));
  const totalNovas = novas.dados?.total ?? 0;
  const itens = itensDoMenuDoUsuario(pode, administrador);
  const sair = itens.find((i) => i.id === 'sair');
  const linha = (item: (typeof itens)[number]) => (
    <ItemDeLista key={item.id} titulo={item.rotulo} Icone={ICONES_DO_MENU[item.id]}
      href={item.href === null ? undefined : (item.href as Href)}
      aoTocar={() => (item.href === null ? setSaindo(true) : router.navigate(item.href as Href))} />
  );
  const daPessoa = itens.filter((i) => i.id !== 'sair' && !DA_CONSULTORIA.has(i.id));
  const doNegocio = itens.filter((i) => DA_CONSULTORIA.has(i.id));
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Perfil" subtitulo={[usuario?.nome, perfilEquipe?.nome].filter(Boolean).join(' · ') || undefined} />
      <Cartao titulo="Minha conta">
        <View style={estilos.lista}>{daPessoa.map(linha)}</View>
      </Cartao>
      {doNegocio.length > 0 ? (
        <Cartao titulo="Consultoria">
          <View style={estilos.lista}>{doNegocio.map(linha)}</View>
        </Cartao>
      ) : null}
      {busca ? <ItemDeLista titulo="Buscar telas" detalhe="Telas e ações do app; marque as favoritas com a estrela" Icone={Search} aoTocar={busca.abrir} /> : null}
      <Cartao titulo="Atalhos" descricao="Páginas de apoio e de gestão da consultoria.">
        {novas.erro ? <MensagemErro texto={`Não foi possível contar as inscrições novas. ${textoDoErro(novas.erro)}`} erro={novas.erro} tentarDeNovo={novas.recarregar} /> : null}
        <View style={estilos.lista}>
          <Permitido codigo="AGENDA_LER"><ItemDeLista href="/treinador/agenda" Icone={CalendarDays} titulo="Agenda" detalhe="Compromissos presenciais com os alunos, por dia ou semana" /></Permitido>
          <Permitido codigo="INSCRICAO_LER"><ItemDeLista href="/treinador/interessados" Icone={Inbox} titulo="Interessados" detalhe="Link de inscrição e a fila de quem quer ser aluno"
            selo={totalNovas > 0 ? { texto: totalNovas === 1 ? '1 nova' : `${totalNovas} novas`, tipo: 'atencao' } : undefined} /></Permitido>
          {pagamentosHabilitados ? (
            <Permitido codigo="FINANCEIRO_LER"><ItemDeLista href="/treinador/financeiro" Icone={Wallet} titulo="Financeiro" detalhe="Planos comerciais, cobranças e recebimentos dos alunos" /></Permitido>
          ) : null}
          <Permitido codigo="EQUIPE_LER"><ItemDeLista href="/treinador/equipe" Icone={UsersRound} titulo="Equipe" detalhe="Membros, perfis e convites" /></Permitido>
          {destinosPermitidos(pode).length > 0 ? <ItemDeLista href="/treinador/importacao" Icone={FileUp} titulo="Importação" detalhe="Planilhas de alunos, pesos e biblioteca" /> : null}
          <Permitido codigo="AUDITORIA_LER"><ItemDeLista href="/treinador/auditoria" Icone={History} titulo="Auditoria" detalhe="O que foi feito na consultoria" /></Permitido>
          <ItemDeLista href="/treinador/ajuda" Icone={LifeBuoy} titulo="Ajuda" detalhe="Primeiros passos, tutorial e perguntas" />
          <ItemDeLista href="/treinador/termos" Icone={FileText} titulo="Termos e privacidade" detalhe="Termo de uso e aviso de privacidade" />
        </View>
      </Cartao>
      {sair ? (
        <View style={estilos.sair}>
          <ItemDeLista titulo={sair.rotulo} Icone={ICONES_DO_MENU.sair} perigo aoTocar={() => setSaindo(true)} />
        </View>
      ) : null}
      <ConfirmarSaida visivel={saindo} aoFechar={() => setSaindo(false)} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  // Ação de saída longe da navegação, para não ser tocada no lugar de um item da conta.
  sair: { marginTop: espaco(2) },
});
