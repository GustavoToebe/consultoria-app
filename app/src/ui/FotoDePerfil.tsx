import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { iniciais } from '../dominio/fotoDePerfil';
import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { enderecoDaImagem } from './ImagemProtegida';
import { Texto } from './Texto';
import { useCarregar } from './useCarregar';

interface Props {
  /** Muda quando a foto é outra (aluno ou versão). */
  chave: string;
  /** Baixa pela API, com token; 404 = sem foto. */
  carregar: () => Promise<Blob>;
  nome: string | null | undefined;
  tamanho?: number;
  /** Avisa se há foto (para a Conta mostrar "Remover"). */
  aoSaber?: (temFoto: boolean) => void;
}

/**
 * Foto de perfil do aluno num círculo; sem foto, sem internet ou com erro, as iniciais (a tela nunca trava por causa da
 * foto). A imagem vem da API com o token, vira `blob:`/`data:` só na memória e não entra no cache de disco.
 */
export function FotoDePerfil({ chave, carregar, nome, tamanho = 48, aoSaber }: Props) {
  const { cores } = useTema();
  const { dados: endereco } = useCarregar(chave, async () => {
    try {
      const encontrado = await enderecoDaImagem(await carregar());
      aoSaber?.(true);
      return encontrado;
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 404) {
        aoSaber?.(false);
        return null;
      }
      throw erro;
    }
  });
  useEffect(
    () => () => {
      if (endereco?.startsWith('blob:')) URL.revokeObjectURL(endereco);
    },
    [endereco],
  );
  const circulo = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
  if (endereco) {
    return (
      <Image source={{ uri: endereco }} cachePolicy="none" contentFit="cover" accessibilityLabel={`Foto de perfil de ${nome ?? 'aluno'}`}
        style={[circulo, { borderColor: cores.borda }, estilos.borda]} />
    );
  }
  return <IniciaisDePerfil nome={nome} tamanho={tamanho} />;
}

/**
 * Só o círculo com as iniciais, sem buscar foto nenhuma: a lista de alunos usa este (uma requisição por aluno pesaria) e
 * a `FotoDePerfil` cai nele quando não há foto. Decorativo: o nome já está ao lado.
 */
export function IniciaisDePerfil({ nome, tamanho = 48 }: { nome: string | null | undefined; tamanho?: number }) {
  const { cores } = useTema();
  const circulo = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden
      style={[circulo, estilos.centro, estilos.borda, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <Texto style={[estilos.iniciais, { fontSize: Math.max(12, Math.round(tamanho * 0.38)), color: cores.textoSuave }]}>{iniciais(nome)}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  borda: { borderWidth: 1 },
  iniciais: { fontFamily: fontes.semi },
});
