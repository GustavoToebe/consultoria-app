import { RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import { dataParaTela } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { PainelConta } from '../../ui/PainelConta';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Conta do aluno: sincronização (pendências, falhas, "Sincronizar agora"), tema, senha e sair. */
export default function ContaAluno() {
  const { pendentes, falhas, envio, mensagemEnvio, sincronizarAgora, tentarDeNovo } = useAluno();
  const naoEnviados = pendentes + falhas.length;
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Conta" />
      <PainelConta
        avisoAoSair={
          naoEnviados
            ? `Há ${naoEnviados} registro(s) ainda não enviado(s). Se sair agora, eles serão apagados deste aparelho. Conecte-se e sincronize antes, se puder.`
            : null
        }>
        <Cartao titulo="Sincronização">
          <SeloSincronizacao />
          <Texto variante="suave">
            {naoEnviados
              ? `${pendentes} aguardando envio${falhas.length ? `, ${falhas.length} com falha` : ''}.`
              : 'Tudo o que você registrou já está com o seu treinador.'}
          </Texto>
          {mensagemEnvio ? <Texto variante="pequeno">{mensagemEnvio}</Texto> : null}
          {falhas.map((f) => (
            <Texto key={f.id} variante="pequeno">
              {dataParaTela(f.data)}: {f.motivo}
            </Texto>
          ))}
          <View style={estilos.botoes}>
            {falhas.length ? <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={() => void tentarDeNovo()} /> : null}
            <Botao rotulo="Sincronizar agora" Icone={RefreshCw} carregando={envio === 'enviando'} aoTocar={() => void sincronizarAgora()} />
          </View>
        </Cartao>
      </PainelConta>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), justifyContent: 'flex-end' },
});
