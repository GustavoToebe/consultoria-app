import { RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CartaoExcluirConta } from '../../aluno/CartaoExcluirConta';
import { CartaoFotoDePerfil } from '../../aluno/CartaoFotoDePerfil';
import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import { dataParaTela } from '../../dominio/formatos';
import { avisoAoSairComPendencias, treinosNaoEnviados } from '../../dominio/treinosNaoEnviados';
import { useAluno } from '../../offline/AlunoProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConta } from '../../ui/PainelConta';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Conta do aluno: foto de perfil, sincronização (pendências, falhas, "Sincronizar agora"), tema, senha, sair e, por último, excluir a conta. */
export default function ContaAluno() {
  const { pendentes, falhas, registros, envio, mensagemEnvio, sincronizarAgora, tentarDeNovo } = useAluno();
  const naoEnviados = pendentes + falhas.length;
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Conta e preferências" />
      <LinkTexto href="/aluno/ajuda" texto="Ajuda, primeiros passos e tutorial" />
      <LinkTexto href="/aluno/termos" texto="Termos e privacidade" />
      <PainelConta avisoAoSair={avisoAoSairComPendencias(treinosNaoEnviados(registros))}>
        <CartaoFotoDePerfil />
        <Cartao titulo="Sincronização" descricao="Os registros ficam salvos neste aparelho e vão para o seu treinador quando houver internet.">
          <SeloSincronizacao />
          <Texto variante="suave">
            {naoEnviados
              ? `${pendentes} aguardando envio${falhas.length ? `, ${falhas.length} com falha` : ''}.`
              : 'Tudo o que você registrou já está com o seu treinador.'}
          </Texto>
          {mensagemEnvio ? <Texto variante="suave">{mensagemEnvio}</Texto> : null}
          {falhas.map((f) => (
            <Texto key={f.id} variante="suave">
              {dataParaTela(f.data)}: {f.motivo}
            </Texto>
          ))}
          <View style={estilos.botoes}>
            {falhas.length ? <Botao rotulo="Tentar de novo" tipo="secundario" cheio aoTocar={() => void tentarDeNovo()} /> : null}
            <Botao rotulo="Sincronizar agora" cheio Icone={RefreshCw} carregando={envio === 'enviando'} aoTocar={() => void sincronizarAgora()} />
          </View>
        </Cartao>
      </PainelConta>
      <CartaoExcluirConta />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), justifyContent: 'flex-end' },
});
