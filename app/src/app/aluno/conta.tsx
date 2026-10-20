import { BookOpen, FileText, LogOut, RefreshCw, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CartaoExcluirConta } from '../../aluno/CartaoExcluirConta';
import { CartaoFotoDePerfil } from '../../aluno/CartaoFotoDePerfil';
import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import { dataParaTela } from '../../dominio/formatos';
import { avisoAoSairComPendencias, diasDeMobilidadeNaoEnviados, treinosNaoEnviados } from '../../dominio/treinosNaoEnviados';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { Folha } from '../../ui/Folha';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { PreferenciasDoApp } from '../../ui/PreferenciasDoApp';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { TrocarSenha } from '../../ui/TrocarSenha';

/**
 * Conta do aluno, do mais usado ao menos usado (revisão de 19/10: senha, sair e excluir ficavam depois de oito cartões
 * de preferências, a ~3.400 px): conta e foto, sincronização, segurança (senha), "Aparência e preferências" numa
 * folha, Ajuda e Termos como itens, Sair e, por último, excluir a conta. "Sincronizar agora" é secundário; o primário
 * só aparece quando há falha ("Tentar de novo").
 */
export default function ContaAluno() {
  const sessao = useSessao();
  const { pendentes, falhas, falhasDeMobilidade, mobilidadeNoAparelho, registros, envio, mensagemEnvio, sincronizarAgora, tentarDeNovo } = useAluno();
  const [preferencias, abrirPreferencias] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const totalDeFalhas = falhas.length + falhasDeMobilidade.length;
  const naoEnviados = pendentes + totalDeFalhas;
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Conta" subtitulo={[sessao.usuario?.nome, sessao.usuario?.email].filter(Boolean).join(' · ') || undefined} />
      <CartaoFotoDePerfil />
      <Cartao titulo="Sincronização" descricao="Os registros ficam salvos neste aparelho e vão para o seu treinador quando houver internet.">
        <SeloSincronizacao />
        <Texto variante="suave">
          {naoEnviados
            ? `${pendentes} aguardando envio${totalDeFalhas ? `, ${totalDeFalhas} com falha` : ''}.`
            : 'Tudo o que você registrou já está com o seu treinador.'}
        </Texto>
        {mensagemEnvio ? <Texto variante="suave">{mensagemEnvio}</Texto> : null}
        {falhas.map((f) => (
          <Texto key={f.id} variante="suave">
            {dataParaTela(f.data)}: {f.motivo}
          </Texto>
        ))}
        {falhasDeMobilidade.map((f) => (
          <Texto key={f.id} variante="suave">
            Mobilidade, {dataParaTela(f.data)}: {f.motivo}
          </Texto>
        ))}
        <View style={estilos.botoes}>
          <Botao rotulo="Sincronizar agora" tipo="secundario" Icone={RefreshCw} carregando={envio === 'enviando'} aoTocar={() => void sincronizarAgora()} />
          {totalDeFalhas ? <Botao rotulo="Tentar de novo" aoTocar={() => void tentarDeNovo()} /> : null}
        </View>
      </Cartao>
      <TrocarSenha />
      <View style={estilos.itens}>
        <ItemDeLista titulo="Aparência e preferências" detalhe="Tema, contraste, tamanho do texto, animações e gráficos" Icone={SlidersHorizontal} aoTocar={() => abrirPreferencias(true)} />
        <ItemDeLista titulo="Ajuda" detalhe="Primeiros passos e tutorial" Icone={BookOpen} href="/aluno/ajuda" />
        <ItemDeLista titulo="Termos e privacidade" Icone={FileText} href="/aluno/termos" />
      </View>
      <Botao rotulo="Sair" tipo="secundario" Icone={LogOut} cheio aoTocar={() => setConfirmandoSaida(true)} />
      <ConfirmarSaida visivel={confirmandoSaida} aoFechar={() => setConfirmandoSaida(false)} aviso={avisoAoSairComPendencias(treinosNaoEnviados(registros), diasDeMobilidadeNaoEnviados(mobilidadeNoAparelho))} />
      <CartaoExcluirConta />
      <Folha visivel={preferencias} titulo="Aparência e preferências" aoFechar={() => abrirPreferencias(false)}>
        <PreferenciasDoApp comTitulo={false} />
      </Folha>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), justifyContent: 'flex-end' },
  itens: { gap: espaco(1) },
});
