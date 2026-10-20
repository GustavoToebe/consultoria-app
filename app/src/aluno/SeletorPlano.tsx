import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { pastasDoAluno } from '../api/rotas';
import type { PastaDoAluno } from '../api/tipos';
import { hojeIso } from '../dominio/formatos';
import { periodoCurto } from '../dominio/periodoCurto';
import { useAluno } from '../offline/AlunoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const periodoDa = (p: { inicio: string | null; fim: string | null }) => periodoCurto(p, hojeIso());

function SeloStatus({ pasta }: { pasta: PastaDoAluno }) {
  return pasta.concluidaEm ? <Selo texto="Concluído" tipo="neutro" /> : <Selo texto="Ativo" tipo="sucesso" />;
}

/**
 * Plano em uso no topo das telas de treino e dieta. Com um plano só é uma linha de texto (parecia botão e não fazia
 * nada) e o selo só aparece quando o plano já foi concluído (o normal é estar ativo). Com mais de um, vira botão para
 * trocar: a escolha vale para o treino e para a dieta. Sem conexão a lista não carrega e fica só o rótulo.
 */
export function SeletorPlano({ rotulo, soComVarios }: { rotulo: string | null; /** Início: sem outro plano para trocar, não mostra nada. */ soComVarios?: boolean }) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const { pacote, escolhida, escolherPasta } = useAluno();
  const lista = useCarregar(`pastas-aluno:${pacote?.pacote.geradoEm ?? ''}`, () => pastasDoAluno());
  const [aberto, setAberto] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const pastas = lista.dados ?? [];
  const emUso = escolhida?.pasta ?? pastas.find((p) => p.atual) ?? null;
  const podeTrocar = pastas.length > 1;
  const texto = emUso ? [emUso.titulo, periodoDa(emUso)].filter(Boolean).join(' · ') : rotulo;
  if (!texto || (soComVarios && !podeTrocar)) return null;

  const escolher = (p: PastaDoAluno) => {
    setAbrindo(p.id);
    escolherPasta(p).then(
      () => {
        setAbrindo(null);
        setAberto(false);
      },
      (e: unknown) => {
        setAbrindo(null);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  if (!podeTrocar) {
    return (
      <View style={estilos.linhaSimples} accessible accessibilityLabel={`Plano em uso: ${texto}`}>
        <Texto numerico variante="suave" style={estilos.flex}>{texto}</Texto>
        {emUso?.concluidaEm ? <Selo texto="Concluído" tipo="neutro" /> : null}
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole={podeTrocar ? 'button' : 'text'}
        accessibilityLabel={`Plano em uso: ${texto}${podeTrocar ? '. Toque para trocar.' : ''}`}
        disabled={!podeTrocar}
        onPress={() => setAberto(true)}
        style={({ pressed }) => [
          estilos.barra,
          { backgroundColor: cores.superficie, borderColor: cores.borda, opacity: pressed ? 0.75 : 1 },
        ]}>
        <View style={estilos.textos}>
          <Texto numerico variante="suave">{texto}</Texto>
          {emUso?.concluidaEm ? <SeloStatus pasta={emUso} /> : null}
        </View>
        {podeTrocar ? <ChevronDown size={20} color={cores.textoSuave} /> : null}
      </Pressable>
      {aberto ? (
        <Folha visivel titulo="Trocar de plano" aoFechar={() => setAberto(false)}>
          <Texto variante="suave">A troca vale para o treino, a dieta e a mobilidade. Planos antigos abrem só para consulta.</Texto>
          {pastas.map((p) => {
            const selecionada = p.id === emUso?.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selecionada, busy: abrindo === p.id }}
                accessibilityLabel={`${p.titulo}, ${p.concluidaEm ? 'concluído' : 'ativo'}${selecionada ? ', em uso' : ''}`}
                disabled={abrindo !== null}
                onPress={() => (selecionada ? setAberto(false) : escolher(p))}
                style={({ pressed }) => [
                  estilos.opcao,
                  {
                    backgroundColor: pressed ? cores.superficie3 : cores.superficie,
                    borderColor: selecionada ? cores.sucesso : cores.borda,
                    opacity: abrindo !== null && abrindo !== p.id ? 0.5 : 1,
                  },
                ]}>
                <View style={estilos.textos}>
                  <Texto numerico style={estilos.titulo}>{p.titulo}</Texto>
                  {periodoDa(p) ? <Texto numerico variante="suave">{periodoDa(p)}</Texto> : null}
                  <Texto variante="pequeno">
                    {[p.temTreino ? 'Treino' : null, p.temDieta ? 'Dieta' : null, p.temMobilidade ? 'Mobilidade' : null].filter(Boolean).join(' · ')}
                  </Texto>
                </View>
                <View style={estilos.lado}>
                  <SeloStatus pasta={p} />
                  {selecionada ? <Check size={20} color={cores.sucesso} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Folha>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco(1),
    minHeight: ALVO_TOQUE,
    borderWidth: 1,
    borderRadius: RAIO,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(1),
  },
  textos: { flex: 1, gap: 4 },
  linhaSimples: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  flex: { flexShrink: 1 },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    minHeight: ALVO_TOQUE,
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.5),
  },
  lado: { alignItems: 'flex-end', gap: espaco(0.75) },
  titulo: { fontFamily: fontes.negrito, fontSize: 17, lineHeight: 23 },
});
