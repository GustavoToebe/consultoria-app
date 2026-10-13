import { useNavigation } from 'expo-router';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { portalDaFolhaDoTopo } from './historicoDasFolhas';
import { PainelConfirmacao } from './PainelConfirmacao';

interface Guarda {
  /** Marca a tela como "com alteração não salva"; devolve a função que desmarca. */
  registrar: (id: string) => () => void;
  /** Roda `acao` na hora se nada está pendente; senão pergunta "Sair sem salvar?" e só roda se a pessoa confirmar. */
  confirmar: (acao: () => void) => void;
  /** Há alguma tela com alteração não salva? */
  pendente: () => boolean;
  /** A pessoa acabou de confirmar a saída: a próxima navegação passa sem perguntar de novo. */
  liberado: () => boolean;
}

const SEM_GUARDA: Guarda = { registrar: () => () => undefined, confirmar: (acao) => acao(), pendente: () => false, liberado: () => true };
const Contexto = createContext<Guarda>(SEM_GUARDA);

/**
 * Nada é salvo sozinho nos editores: quem tem alteração pendente chama `useGuardaDeSaida(true)` e qualquer saída da
 * tela (menu, busca, trilha, voltar, cartão do usuário, botão físico) passa por `confirmar`, que pergunta antes. Na web,
 * fechar ou recarregar a aba cai no aviso do navegador (`beforeunload`), o único possível ali.
 */
export function GuardaDeSaida({ children }: { children: ReactNode }) {
  const pendentes = useRef(new Set<string>());
  const liberado = useRef(false);
  const [acao, setAcao] = useState<(() => void) | null>(null);

  const guarda = useMemo<Guarda>(
    () => ({
      registrar: (id) => {
        pendentes.current.add(id);
        return () => {
          pendentes.current.delete(id);
        };
      },
      confirmar: (a) => {
        if (liberado.current || pendentes.current.size === 0) a();
        else setAcao(() => a);
      },
      pendente: () => pendentes.current.size > 0,
      liberado: () => liberado.current,
    }),
    [],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const avisar = (e: BeforeUnloadEvent) => {
      if (pendentes.current.size > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, []);

  const sair = () => {
    const a = acao;
    setAcao(null);
    if (!a) return;
    // A ação navega e o navegador da pilha dispara `beforeRemove` na hora: com `liberado` ele não pergunta de novo.
    liberado.current = true;
    try {
      a();
    } finally {
      setTimeout(() => {
        liberado.current = false;
      }, 0);
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
  useEffect(() => {
    if (!pendente) return;
    const desmarcar = guarda.registrar(id);
    const soltar = navigation.addListener('beforeRemove', (e) => {
      if (guarda.liberado()) return;
      e.preventDefault();
      guarda.confirmar(() => navigation.dispatch(e.data.action));
    });
    return () => {
      desmarcar();
      soltar();
    };
  }, [pendente, id, guarda, navigation]);
}

/** Quem navega (menu, busca, trilha, voltar) embrulha a navegação em `confirmar`; `pendente()` diz se há o que perder. */
export function useSaidaGuardada() {
  const { confirmar, pendente } = useContext(Contexto);
  return { confirmar, pendente };
}
