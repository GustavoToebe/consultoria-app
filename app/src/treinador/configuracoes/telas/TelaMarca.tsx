import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { consultoria } from '../../../api/rotas';
import { espaco } from '../../../tema/tokens';
import { FormMarca } from '../../marca/FormMarca';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { Tela } from '../../../ui/Tela';
import { useCarregar } from '../../../ui/useCarregar';

/**
 * Marca (nome, cor, fonte, tema, logo) com prévia ao vivo. `noContato`: aberta pelo item "Contato" de Configurações, a tela
 * rola até o cartão Contato quando o formulário aparece (só na web, onde existe o DOM; no celular abre no topo).
 */
export function TelaMarca({ noContato = false }: { noContato?: boolean }) {
  const { dados, erro, carregando, recarregar, definir } = useCarregar('consultoria', () => consultoria());
  const coluna = useRef<View>(null);
  const pronta = !!dados;
  useEffect(() => {
    if (!noContato || !pronta || Platform.OS !== 'web') return;
    // shortcut: acha o cartão pelo título "Contato" (h2 do `Cartao`, dentro do FormMarca, que é de outra frente); se o título mudar, troque por um `nativeID` no cartão.
    const raiz = coluna.current as unknown as HTMLElement | null;
    const titulo = [...(raiz?.querySelectorAll?.('[role="heading"][aria-level="2"], h2') ?? [])].find((h) => h.textContent?.trim() === 'Contato');
    titulo?.scrollIntoView?.({ block: 'start' });
  }, [noContato, pronta]);
  // Conflito (outra aba salvou): recarrega e recria o formulário com os valores atuais.
  const [conflitos, setConflitos] = useState(0);
  return (
    <Tela bordas={['top']}>
      <Cabecalho titulo="Marca" descricao="Nome, logo, cor e tema que os seus alunos veem no app." />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (
        <View ref={coluna} style={estilos.coluna}>
          <FormMarca
            key={conflitos ? `${conflitos}:${dados.versao}` : 0}
            consultoria={dados}
            aoSalvar={definir}
            aoConflito={() => {
              recarregar();
              setConflitos((n) => n + 1);
            }}
          />
        </View>
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
});
