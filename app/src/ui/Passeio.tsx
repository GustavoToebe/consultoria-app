import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  andamentoDoPasseio,
  chavePasseio,
  larguraDoBalao,
  passosVisiveis,
  posicaoDoBalao,
  recorteDoDestaque,
  situacaoDoPasseio,
  type LeituraDoPasseio,
  type PassoDoPasseio,
  type Retangulo,
  type SituacaoDoPasseio,
  type Tamanho,
} from '../dominio/passeio';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { Texto } from './Texto';
import { useTeclado } from './usoWeb';

interface Valor {
  situacao: SituacaoDoPasseio;
  /** Pular, fechar ou chegar ao fim: conta como visto e guarda a marca no aparelho. */
  dispensar: () => void;
  /** "Rever o passeio" da Ajuda: abre de novo do primeiro passo. */
  rever: () => void;
  registrar: (id: string, no: View | null) => void;
}

// Sem o provedor (telas públicas e testes) não há passeio para esperar nem item para registrar.
const Contexto = createContext<Valor>({ situacao: 'encerrada', dispensar: () => undefined, rever: () => undefined, registrar: () => undefined });

export const usePasseio = (): Pick<Valor, 'situacao' | 'dispensar' | 'rever'> => useContext(Contexto);

/** `ref` para o item que o passeio destaca (`menu:<caminho>`). Item fora da tela sai do registro sozinho. */
export function useAlvoDoPasseio(id: string): (no: View | null) => void {
  const { registrar } = useContext(Contexto);
  return useCallback((no: View | null) => registrar(id, no), [registrar, id]);
}

/**
 * Dono do passeio pelo menu (treinador e aluno): lê a marca "já visto" do aparelho, guarda os itens do menu que podem
 * ser destacados e desenha o passeio por cima da área toda. Começa em "lendo": nada abre antes de a marca ser lida, e
 * quem abre outro diálogo (o lembrete da atualização do aluno) espera `encerrada`. A marca é por usuário e sobrevive a
 * sair e entrar; "Rever o passeio" na Ajuda abre de novo. Mora no layout de cada área, depois do aceite dos termos.
 */
export function ProvedorDoPasseio({ usuarioId, passos, children }: { usuarioId: string; passos: readonly PassoDoPasseio[]; children: ReactNode }) {
  const [leitura, setLeitura] = useState<LeituraDoPasseio>('lendo');
  const [dispensado, setDispensado] = useState(false);
  const [reaberto, setReaberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const nos = useRef(new Map<string, View>());
  const [alvos, setAlvos] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let ativo = true;
    AsyncStorage.getItem(chavePasseio(usuarioId))
      .then((valor) => ativo && setLeitura({ valor }))
      .catch(() => ativo && setLeitura('falhou'));
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const registrar = useCallback((id: string, no: View | null) => {
    if (no) nos.current.set(id, no);
    else nos.current.delete(id);
    setAlvos((atual) => (atual.has(id) === !!no ? atual : new Set(nos.current.keys())));
  }, []);

  const dispensar = useCallback(() => {
    setDispensado(true);
    setReaberto(false);
    AsyncStorage.setItem(chavePasseio(usuarioId), '1').catch(() => undefined);
  }, [usuarioId]);

  const rever = useCallback(() => {
    setIndice(0);
    setReaberto(true);
  }, []);

  const situacao = situacaoDoPasseio(leitura, dispensado, passos.length, reaberto);
  const valor = useMemo(() => ({ situacao, dispensar, rever, registrar }), [situacao, dispensar, rever, registrar]);
  const origem = useRef<View>(null);
  const visiveis = useMemo(() => passosVisiveis(passos, alvos), [passos, alvos]);
  return (
    <Contexto.Provider value={valor}>
      <View ref={origem} style={estilos.area} collapsable={false}>
        {children}
        {situacao === 'aberta' && visiveis.length ? (
          <Sobreposicao
            passos={visiveis}
            indice={indice}
            mudar={setIndice}
            dispensar={dispensar}
            origem={origem}
            nos={nos}
          />
        ) : null}
      </View>
    </Contexto.Provider>
  );
}

interface Medida { area: Tamanho; alvo: Retangulo | null }

function Sobreposicao({ passos, indice, mudar, dispensar, origem, nos }: {
  passos: PassoDoPasseio[];
  indice: number;
  mudar: (indice: number) => void;
  dispensar: () => void;
  origem: React.RefObject<View | null>;
  nos: React.RefObject<Map<string, View>>;
}) {
  const { cores } = useTema();
  const janela = useWindowDimensions();
  const andamento = andamentoDoPasseio(indice, passos.length);
  const passo = passos[andamento.indice];
  const [medida, setMedida] = useState<Medida | null>(null);
  const [alturaBalao, setAlturaBalao] = useState<number | null>(null);
  const balao = useRef<View>(null);

  // Mede o item em relação à própria área (não à janela): vale igual na web, no Android e no iOS, com ou sem barra
  // de status. Mede de novo ao trocar de passo e quando a janela muda de tamanho.
  useEffect(() => {
    let vivo = true;
    const raiz = origem.current;
    const no = passo.alvo ? nos.current.get(passo.alvo) : undefined;
    raiz?.measureInWindow((ox, oy, largura, altura) => {
      if (!no) {
        if (vivo) setMedida({ area: { largura, altura }, alvo: null });
        return;
      }
      no.measureInWindow((x, y, l, a) => {
        if (vivo) setMedida({ area: { largura, altura }, alvo: { x: x - ox, y: y - oy, largura: l, altura: a } });
      });
    });
    return () => {
      vivo = false;
    };
  }, [origem, nos, passo, janela.width, janela.height]);

  // Teclado na web: o foco vai para o balão a cada passo (o leitor de tela lê o passo novo); Esc pula o passeio.
  useEffect(() => {
    if (Platform.OS !== 'web' || !medida) return;
    const botoes = (balao.current as unknown as HTMLElement | null)?.querySelectorAll?.<HTMLElement>('button');
    botoes?.[botoes.length - 1]?.focus?.(); // o botão principal (Próximo/Começar) é o último
  }, [medida, andamento.indice]);
  useTeclado(true, ({ key }) => {
    if (key !== 'Escape') return false;
    dispensar();
    return true;
  });

  const area = medida?.area ?? { largura: janela.width, altura: janela.height };
  const largura = larguraDoBalao(area);
  const pronto = !!medida && alturaBalao !== null;
  const posicao = posicaoDoBalao(medida?.alvo ?? null, area, { largura, altura: alturaBalao ?? 0 });
  const recorte = medida?.alvo ? recorteDoDestaque(medida.alvo, area) : null;
  const vela = 'rgba(0, 0, 0, 0.6)';

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {recorte ? (
        <>
          <View style={[estilos.vela, { backgroundColor: vela, left: 0, top: 0, right: 0, height: recorte.y }]} />
          <View style={[estilos.vela, { backgroundColor: vela, left: 0, top: recorte.y + recorte.altura, right: 0, bottom: 0 }]} />
          <View style={[estilos.vela, { backgroundColor: vela, left: 0, top: recorte.y, width: recorte.x, height: recorte.altura }]} />
          <View style={[estilos.vela, { backgroundColor: vela, left: recorte.x + recorte.largura, top: recorte.y, right: 0, height: recorte.altura }]} />
          <View
            importantForAccessibility="no-hide-descendants"
            style={[estilos.anel, { borderColor: cores.anelFoco, left: recorte.x, top: recorte.y, width: recorte.largura, height: recorte.altura }]}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: vela }]} />
      )}
      <View
        ref={balao}
        role="dialog"
        aria-modal
        aria-label={`Passeio pelo menu: ${passo.titulo}`}
        onLayout={(e) => setAlturaBalao(e.nativeEvent.layout.height)}
        style={[
          estilos.balao,
          { backgroundColor: cores.superficie, borderColor: cores.borda, width: largura, left: posicao.x, top: posicao.y, opacity: pronto ? 1 : 0 },
        ]}>
        <Texto variante="pequeno">{`Passeio pelo menu · ${andamento.progresso}`}</Texto>
        <Texto variante="bloco" nivel={2}>{passo.titulo}</Texto>
        <Texto>{passo.texto}</Texto>
        <View style={estilos.botoes}>
          {andamento.ultimo ? null : <Botao rotulo="Pular" tipo="fantasma" aoTocar={dispensar} />}
          <View style={estilos.direita}>
            {andamento.primeiro ? null : <Botao rotulo="Anterior" tipo="secundario" aoTocar={() => mudar(andamento.indice - 1)} />}
            <Botao rotulo={andamento.rotuloProximo} aoTocar={andamento.ultimo ? dispensar : () => mudar(andamento.indice + 1)} />
          </View>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1 },
  vela: { position: 'absolute' },
  anel: { position: 'absolute', borderWidth: 2, borderRadius: RAIO },
  balao: { position: 'absolute', borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1) },
  botoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espaco(1) },
  direita: { flexDirection: 'row', gap: espaco(1), marginLeft: 'auto' },
});
