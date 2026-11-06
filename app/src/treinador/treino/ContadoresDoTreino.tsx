import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoTreino, Sessao } from '../../api/tipos';
import { contarPlano, contarSessao, textoDaSessaoAberta, textoDoPlanoInteiro } from '../../dominio/contagemDoTreino';
import { textoDosProblemas, uidsDoPrimeiroProblema } from '../../dominio/problemasDoPlano';
import { validarTreino } from '../../dominio/validacaoDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { useRolagem } from '../../ui/RolagemComTopo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/**
 * Cabeçalho "Sessões (N)" do editor: embaixo do título, em texto, o plano inteiro ("Plano inteiro: 6 sessões · 32
 * exercícios · 120 séries cadastradas") e a sessão aberta ("Sessão aberta: 5 exercícios · 18 séries"), separados porque
 * os números do plano pareciam ser da sessão (reunião de 30/10). À direita, o estado da publicação pela mesma validação
 * dela, ao vivo: "N problemas para publicar · ir ao primeiro" (abre a sessão e o exercício e rola até ele) ou "Pronto
 * para publicar". Só informa: nada aqui trava salvar ou publicar.
 */
export function ContadoresDoTreino({ conteudo, sessao, acao, aoIrAoPrimeiro }: {
  conteudo: ConteudoTreino;
  /** A sessão aberta no editor; nula sem nenhuma (o contador dela some). */
  sessao?: Sessao | null;
  /** Ação do cabeçalho, antes do estado ("Colar treino (Docs / PDF)"). */
  acao?: ReactNode;
  /** `caminho` do primeiro erro (o mesmo de onde saem os uids), para o editor abrir a aba da série dele. */
  aoIrAoPrimeiro: (uids: string[], caminho?: string) => void;
}) {
  const { cores } = useTema();
  const { rolarAte } = useRolagem();
  const erros = useMemo(() => validarTreino(conteudo).erros, [conteudo]);
  const irAoPrimeiro = () => {
    const uids = uidsDoPrimeiroProblema(conteudo, erros);
    aoIrAoPrimeiro(uids, erros[0]?.caminho);
    rolarAte(uids);
  };
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.titulo}>
        <Texto variante="bloco" nivel={2}>{`Sessões (${conteudo.sessoes.length})`}</Texto>
        <View style={estilos.numeros}>
          <Contagem texto={textoDoPlanoInteiro(contarPlano(conteudo))} />
          {sessao ? <Contagem texto={textoDaSessaoAberta(contarSessao(sessao))} /> : null}
        </View>
      </View>
      <View style={estilos.direita}>
        {acao}
        {erros.length ? (
          <Pressable accessibilityRole="button" onPress={irAoPrimeiro}
            style={(estado) => [estilos.estado, { borderColor: cores.perigo, backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie }]}>
            <CircleAlert size={16} color={cores.perigo} />
            <Texto cor={cores.perigo} style={estilos.forte}>{`${textoDosProblemas(erros.length)} · ir ao primeiro`}</Texto>
          </Pressable>
        ) : (
          <View style={[estilos.estado, { borderColor: cores.sucesso, backgroundColor: cores.superficie }]}>
            <CircleCheck size={16} color={cores.sucesso} />
            <Texto cor={cores.sucesso} style={estilos.forte}>Pronto para publicar</Texto>
          </View>
        )}
      </View>
    </View>
  );
}

/** Uma contagem em texto suave: o "de quê" ("Plano inteiro:") em semi e os números depois. */
function Contagem({ texto }: { texto: string }) {
  const corte = texto.indexOf(': ');
  const titulo = corte >= 0 ? texto.slice(0, corte + 1) : '';
  const numeros = corte >= 0 ? texto.slice(corte + 2) : texto;
  return (
    <Texto variante="suave" numerico style={estilos.contagem}>
      {titulo ? <Texto variante="suave" numerico style={estilos.forte}>{titulo} </Texto> : null}{numeros}
    </Texto>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 280, gap: espaco(0.5) },
  direita: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: 2 },
  // Em 390 px ou com texto grande a contagem quebra linha em vez de sair da tela.
  contagem: { flexShrink: 1 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5), borderWidth: 1, borderRadius: RAIO, maxWidth: '100%' },
  forte: { fontFamily: fontes.semi },
});
