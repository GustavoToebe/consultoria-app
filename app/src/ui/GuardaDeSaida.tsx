import { useNavigation } from 'expo-router';
import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { criarGuarda, SEM_GUARDA, type Guarda } from './guarda';
import { portalDaFolhaDoTopo, useGuardaNoHistorico } from './historicoDasFolhas';
import { PainelConfirmacao } from './PainelConfirmacao';

const Contexto = createContext<Guarda>(SEM_GUARDA);

/**
 * Nada é salvo sozinho nos editores: quem tem alteração pendente chama `useGuardaDeSaida(true)` e qualquer saída da
 * tela (menu, busca, trilha, voltar, cartão do usuário, botão físico) passa por `confirmar`, que pergunta antes. Na web,
 * fechar ou recarregar a aba cai no aviso do navegador (`beforeunload`), o único possível ali.
 */
export function GuardaDeSaida({ children }: { children: ReactNode }) {
  const [acao, setAcao] = useState<(() => void) | null>(null);

  const guarda = useMemo<Guarda>(() => criarGuarda((a) => setAcao(() => a)), []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const avisar = (e: BeforeUnloadEvent) => {
      if (guarda.pendente()) e.preventDefault();
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [guarda]);

  const sair = () => {
    const a = acao;
    setAcao(null);
    if (!a) return;
    // A ação navega e o navegador da pilha dispara `beforeRemove` na hora: com a saída liberada ele não pergunta de novo.
    const soltar = guarda.liberar();
    try {
      a();
    } finally {
      setTimeout(soltar, 0);
    }
  };

  return (
    <Contexto.Provider value={guarda}>
      {children}
      <PainelConfirmacao
        visivel={acao !== null}
        titulo="Sair sem salvar?"
        mensagem="Há alterações que ainda não foram salvas. Se sair agora, elas serão perdidas."
        rotuloConfirmar="Sair sem salvar"
        rotuloCancelar="Continuar editando"
        perigo
        // Com uma Folha aberta (web) a pergunta iria para trás do Modal dela: vai para dentro da Folha do topo.
        portal={acao !== null ? portalDaFolhaDoTopo() : undefined}
        aoConfirmar={sair}
        aoCancelar={() => setAcao(null)}
      />
    </Contexto.Provider>
  );
}

/** Tela com alteração não salva: registra na guarda e segura o "voltar" (seta, botão físico, navegador) para perguntar. */
export function useGuardaDeSaida(pendente: boolean) {
  const id = useId();
  const guarda = useContext(Contexto);
  const navigation = useNavigation();
  // O voltar do navegador (web) cai numa entrada de guarda e pergunta aqui; confirmar sai por um `history.go` só, com a
  // saída liberada até o `popstate` passar (senão o `beforeRemove` abaixo perguntaria de novo).
  const { sairAntes } = useGuardaNoHistorico(pendente, (sair) =>
    guarda.confirmar(() => {
      const soltar = guarda.liberar();
      sair();
      setTimeout(soltar, 1500);
    }),
  );
  useEffect(() => {
    if (!pendente) return;
    const desmarcar = guarda.registrar(id);
    const soltar = navigation.addListener('beforeRemove', (e) => {
      if (guarda.liberado()) return;
      e.preventDefault();
      const acao = e.data.action;
      guarda.confirmar(() => {
        // Seta e botão físico: a entrada da guarda sai do histórico antes do voltar (senão sobra uma entrada na web).
        const soltar = guarda.liberar();
        sairAntes(() => {
          try {
            navigation.dispatch(acao);
          } finally {
            setTimeout(soltar, 0);
          }
        });
      });
    });
    return () => {
      desmarcar();
      soltar();
    };
  }, [pendente, id, guarda, navigation, sairAntes]);
}

/**
 * Quem navega (menu, busca, trilha, voltar) embrulha a navegação em `confirmar`; `pendente()` diz se há o que perder.
 * Quem já perguntou por conta própria (o Sair da conta) usa `liberar` para a navegação seguinte não perguntar de novo.
 */
export function useSaidaGuardada() {
  const { confirmar, pendente, liberar } = useContext(Contexto);
  return { confirmar, pendente, liberar };
}
