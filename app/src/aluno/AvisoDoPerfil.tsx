import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { meuPerfilDaComunidade, salvarMeuPerfilDaComunidade } from '../api/comunidade';
import { corpoDoManterVisivel, mostrarAvisoDoPerfil, TEXTO_DO_AVISO_DO_PERFIL, TEXTO_LIMITE_DO_PERFIL } from '../dominio/perfilDaComunidade';
import { espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Alerta } from '../ui/Estados';
import { codigoApi, textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';

/** Destino do atalho do aviso da Comunidade (`/aluno/conta?secao=meu-perfil`), registrado pelo cartão "Meu perfil". */
export const CHAVE_DO_MEU_PERFIL = 'meu-perfil';

/** Erro do PUT do perfil: 429 com texto fixo (a API fala de "tentativas"), sem conexão com o que fazer; o resto, o da API. */
export function textoDoErroDoPerfil(erro: unknown): string {
  if (erro instanceof ErroApi && erro.status === 429) return TEXTO_LIMITE_DO_PERFIL;
  if (erro instanceof ErroApi && erro.semConexao) return 'Sem conexão. Nada foi salvo; tente de novo quando a internet voltar.';
  return textoDoErro(erro);
}

/**
 * Aviso único da decisão 11 ("Ninguém é exposto sem saber"): no topo da Comunidade (com o atalho até o interruptor, na Conta)
 * e no cartão "Meu perfil" (onde o interruptor está logo abaixo). Some quando o aluno escolhe; não bloqueia nada.
 */
export function AvisoDoPerfil({ aoEntender, entendendo, motivoDesabilitado, aoIrAoInterruptor }: {
  aoEntender: () => void; entendendo: boolean; motivoDesabilitado?: string; aoIrAoInterruptor?: () => void;
}) {
  const desabilitado = !!motivoDesabilitado && !entendendo;
  return (
    <Alerta tom="atencao" texto={TEXTO_DO_AVISO_DO_PERFIL}>
      <View style={estilos.acoes}>
        {aoIrAoInterruptor ? <Botao rotulo="Reservar meu perfil" tipo="secundario" aoTocar={aoIrAoInterruptor} /> : null}
        <Botao rotulo="Entendi, manter visível" tipo="secundario" carregando={entendendo} desabilitado={desabilitado}
          motivo={desabilitado ? motivoDesabilitado : undefined} aoTocar={aoEntender} />
      </View>
    </Alerta>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), marginTop: espaco(0.5) },
});

/**
 * O aviso no topo da Comunidade: lê o perfil (só com internet) e some se não precisa, se a leitura falhou ou depois do
 * "Entendi". O atalho leva ao cartão "Meu perfil" na Conta, que rola até o interruptor.
 */
export function AvisoDoPerfilNaComunidade({ online }: { online: boolean }) {
  const { avisar } = useAviso();
  const carga = useCarregar(online ? 'aluno-perfil-comunidade' : null, () => meuPerfilDaComunidade());
  const [entendendo, setEntendendo] = useState(false);
  if (!online || !carga.dados || !mostrarAvisoDoPerfil(carga.dados)) return null;
  const lido = carga.dados;
  const entender = () => {
    setEntendendo(true);
    salvarMeuPerfilDaComunidade(corpoDoManterVisivel(lido)).then(
      (resposta) => {
        setEntendendo(false);
        carga.definir(resposta);
        avisar('Pronto: seu perfil continua visível para os colegas.', 'sucesso');
      },
      (erro: unknown) => {
        setEntendendo(false);
        if (codigoApi(erro) === 'ALUNO_ANONIMIZADO') carga.recarregar();
        avisar(textoDoErroDoPerfil(erro), 'perigo');
      },
    );
  };
  return (
    <AvisoDoPerfil entendendo={entendendo} aoEntender={entender}
      aoIrAoInterruptor={() => router.push({ pathname: '/aluno/conta', params: { secao: CHAVE_DO_MEU_PERFIL } })} />
  );
}
