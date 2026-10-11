import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from './Botao';
import { Cartao } from './Cartao';
import { ConfirmarSaida } from './ConfirmarSaida';
import { PreferenciasDoApp } from './PreferenciasDoApp';
import { Texto } from './Texto';
import { TrocarSenha } from './TrocarSenha';

interface Props {
  /** Aviso extra no painel de sair (ex.: "Há 3 registros não enviados"). */
  avisoAoSair?: string | null;
  /** Blocos próprios da área (ex.: sincronização do aluno). */
  children?: ReactNode;
}

/**
 * Conta e preferências do aluno numa tela só: dados, preferências, senha e sair. O treinador usa as mesmas peças em
 * telas separadas (Meus dados e Ajustes, abertas pelo cartão do usuário na barra de topo).
 */
export function PainelConta({ avisoAoSair, children }: Props) {
  const sessao = useSessao();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  return (
    <View style={estilos.coluna}>
      <Cartao titulo="Conta">
        <Texto variante="bloco">{sessao.usuario?.nome}</Texto>
        <Texto variante="suave">{sessao.usuario?.email}</Texto>
      </Cartao>
      {children}
      <PreferenciasDoApp />
      <TrocarSenha />
      <Botao rotulo="Sair" tipo="secundario" cheio aoTocar={() => setConfirmandoSaida(true)} />
      <ConfirmarSaida visivel={confirmandoSaida} aoFechar={() => setConfirmandoSaida(false)} aviso={avisoAoSair} />
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(3) },
});
