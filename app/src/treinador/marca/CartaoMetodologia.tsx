import { Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';

const ARREDONDAMENTOS = [0.25, 0.5, 1, 2.5].map((v) => ({ valor: v, rotulo: `${String(v).replace('.', ',')} kg` }));

type Regra = Record<string, (number | null)[]>;
type Faixas = Record<string, { min: number | null; max: number | null }>;

/** Faixa vazia (nada a preencher) ou completa, de 0 a 500, com a máxima ≥ mínima. */
function faixaValida(f: { min: number | null; max: number | null } | undefined): boolean {
  if (!f || (f.min === null && f.max === null)) return true;
  return f.min !== null && f.max !== null && f.min >= 0 && f.max <= 500 && f.max >= f.min;
}

/** Metodologia em edição: percentuais e faixas podem estar vazios enquanto o treinador digita. */
export type MetodologiaEmEdicao = Omit<Configuracao, 'regraPreparacao' | 'repeticoes'> & { regraPreparacao: Regra; repeticoes?: Faixas | null };

/** Por que ainda não dá para salvar (texto do `motivo` do "Salvar modelo"); `null` = pode salvar. */
export function problemaDaMetodologia(c: MetodologiaEmEdicao): string | null {
  if (!Object.values(c.regraPreparacao).every((v) => v.every((p) => p !== null && p >= 1 && p <= 200))) return 'Preencha todos os percentuais da regra de preparação.';
  if (!c.tiposSerie.every((t) => faixaValida(c.repeticoes?.[t]))) return 'Confira as repetições por tipo.';
  return null;
}

/** O que vai para a API: só tipos que existem e com a faixa completa (o vazio não vai: o editor não preenche nada). */
export function metodologiaParaSalvar(c: MetodologiaEmEdicao): Configuracao {
  return {
    ...c,
    regraPreparacao: c.regraPreparacao as Record<string, number[]>,
    repeticoes: Object.fromEntries(c.tiposSerie.flatMap((t) => {
      const f = c.repeticoes?.[t];
      return f && f.min !== null && f.max !== null ? [[t, { min: f.min, max: f.max }]] : [];
    })),
  };
}

/**
 * Metodologia da consultoria: tipos de série, qual é a de trabalho (WS) e a de preparação (FS), a regra
 * que preenche os percentuais de FS no editor, as repetições de cada tipo (preenchidas ao criar a série ou trocar o tipo), o arredondamento da sugestão de carga do aluno e os textos do PDF.
 * O sistema só guarda e aplica o que o treinador definiu. Controlado: quem salva é o "Salvar modelo" da barra do editor
 * (antes havia um "Salvar metodologia" só aqui dentro, num lugar diferente de todos os outros modelos).
 */
export function CartaoMetodologia({ configuracao: c, aoMudar }: { configuracao: MetodologiaEmEdicao; aoMudar: (c: MetodologiaEmEdicao) => void }) {
  const { cores } = useTema();
  const [novoTipo, setNovoTipo] = useState('');
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const tipos = c.tiposSerie;
  const regra = c.regraPreparacao;
  const faixas: Faixas = c.repeticoes ?? {};
  const trabalho = c.tipoTrabalho;
  const preparacao = c.tipoPreparacao;
  const mudar = (parcial: Partial<MetodologiaEmEdicao>) => aoMudar({ ...c, ...parcial });

  const chaves = Object.keys(regra).map(Number).sort((a, b) => a - b);
  const opcoesTipo = tipos.map((t) => ({ valor: t, rotulo: t }));

  const adicionarTipo = () => {
    const t = novoTipo.trim();
    if (!t || (tipos.includes(t) && t !== renomeando) || (!renomeando && tipos.length >= 20)) return;
    let novasFaixas = faixas;
    if (renomeando && renomeando !== t && faixas[renomeando]) {
      const { [renomeando]: faixa, ...resto } = faixas;
      novasFaixas = { ...resto, [t]: faixa };
    }
    mudar({
      tiposSerie: renomeando ? tipos.map((x) => x === renomeando ? t : x) : [...tipos, t],
      repeticoes: novasFaixas,
      tipoTrabalho: trabalho === renomeando ? t : trabalho,
      tipoPreparacao: preparacao === renomeando ? t : preparacao,
    });
    setRenomeando(null);
    setNovoTipo('');
  };

  return (
    <Cartao titulo="Metodologia">
      <Texto variante="secao">Tipos de série</Texto>
      <Texto variante="pequeno">Toque num tipo para renomear.</Texto>
      <View style={estilos.chips}>
        {tipos.map((t) => {
          const emUso = t === trabalho || t === preparacao;
          return (
            <View key={t} style={[estilos.chip, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Renomear tipo ${t}`} onPress={() => { setRenomeando(t); setNovoTipo(t); }} style={estilos.renomear}>
                <Texto style={estilos.textoChip} numberOfLines={1}>{t}</Texto>
                <Pencil size={14} color={cores.textoSuave} />
              </Pressable>
              {emUso ? null : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${t}`} onPress={() => {
                  const { [t]: _removida, ...resto } = faixas;
                  mudar({ tiposSerie: tipos.filter((x) => x !== t), repeticoes: resto });
                }} style={estilos.xChip}>
                  <X size={16} color={cores.textoSuave} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <View style={estilos.novoTipo}>
        <View style={estilos.campoTipo}>
          <Campo rotulo={renomeando ? "Renomear tipo" : "Novo tipo"} valor={novoTipo} aoMudar={setNovoTipo} maxLength={30} onSubmitEditing={adicionarTipo} />
        </View>
        <Botao rotulo={renomeando ? "Renomear" : "Adicionar"} tipo="secundario" Icone={Plus} aoTocar={adicionarTipo} desabilitado={!novoTipo.trim()} style={estilos.aoPeDoCampo} />
      </View>
      <Escolha rotulo="Série de trabalho (carga do dia)" opcoes={opcoesTipo} valor={trabalho} aoMudar={(tipoTrabalho) => mudar({ tipoTrabalho })} />
      <Escolha rotulo={`Série de preparação (em % da ${trabalho || "série de trabalho"})`} opcoes={opcoesTipo} valor={preparacao} aoMudar={(tipoPreparacao) => mudar({ tipoPreparacao })} />

      <Texto variante="secao">Repetições por tipo</Texto>
      <Texto variante="pequeno">
        Preenchidas no editor quando você cria a série ou troca o tipo dela. Mínima e máxima iguais = número fixo (3x3).
        Em branco, o editor não preenche nada: ao trocar para esse tipo, a série mantém as repetições que já tinha.
        Depois cada série pode ser ajustada no plano.
      </Texto>
      {tipos.map((t) => {
        const f = faixas[t] ?? { min: null, max: null };
        const mudarFaixa = (campo: 'min' | 'max', v: number | null) => mudar({ repeticoes: { ...faixas, [t]: { ...f, [campo]: v } } });
        return (
          <View key={t} style={[estilos.regra, { borderColor: cores.borda }]}>
            <Texto style={estilos.rotuloRegra}>{t}</Texto>
            <View style={estilos.percentuais}>
              <View style={estilos.percentual}>
                <CampoNumerico rotulo="Reps mín." inteiro valor={f.min} aoMudar={(v) => mudarFaixa('min', v)} />
              </View>
              <View style={estilos.percentual}>
                <CampoNumerico
                  rotulo="Reps máx."
                  inteiro
                  valor={f.max}
                  aoMudar={(v) => mudarFaixa('max', v)}
                  erro={faixaValida(faixas[t]) ? undefined : 'Mín. ≤ máx. (0 a 500)'}
                />
              </View>
            </View>
          </View>
        );
      })}

      <Texto variante="secao">Regra de preparação</Texto>
      <Texto variante="pequeno">
        Percentuais preenchidos no editor quando você muda a quantidade de séries de {preparacao}. Depois cada série pode
        ser ajustada no plano.
      </Texto>
      {chaves.map((n) => (
        <View key={n} style={[estilos.regra, { borderColor: cores.borda }]}>
          <Texto style={estilos.rotuloRegra}>
            {n} {n === 1 ? 'série' : 'séries'}
          </Texto>
          <View style={estilos.percentuais}>
            {regra[String(n)].map((p, i) => (
              <View key={i} style={estilos.percentual}>
                <CampoNumerico
                  rotulo={`${i + 1}ª`}
                  sufixo="%"
                  inteiro
                  valor={p}
                  aoMudar={(v) => mudar({ regraPreparacao: { ...regra, [String(n)]: regra[String(n)].map((x, j) => (j === i ? v : x)) } })}
                />
              </View>
            ))}
          </View>
          <IconeBotao
            Icone={Trash2}
            rotulo={`Remover regra de ${n} séries`}
            cor={cores.perigo}
            aoTocar={() => {
              const nova = { ...regra };
              delete nova[String(n)];
              mudar({ regraPreparacao: nova });
            }}
          />
        </View>
      ))}
      {chaves.length < 10 ? (
        <View style={estilos.novoTipo}>
          <Botao
            rotulo={`Regra para ${Array.from({ length: 10 }, (_, i) => i + 1).find((n) => !chaves.includes(n))!} séries`}
            tipo="secundario"
            Icone={Plus}
            aoTocar={() => {
              const n = Array.from({ length: 10 }, (_, i) => i + 1).find((n) => !chaves.includes(n))!;
              mudar({ regraPreparacao: { ...regra, [String(n)]: Array.from({ length: n }, () => null) } });
            }}
          />
        </View>
      ) : null}

      <Escolha rotulo="Arredondar a sugestão de carga do aluno para" opcoes={ARREDONDAMENTOS} valor={c.arredondamentoKg} aoMudar={(arredondamentoKg) => mudar({ arredondamentoKg })} />
      <Campo
        rotulo="Instruções do treino (vão no fim do PDF)"
        valor={c.instrucoesTreino ?? ''}
        aoMudar={(instrucoesTreino) => mudar({ instrucoesTreino })}
        linhas={6}
        maxLength={20000}
      />
      <Campo rotulo="Rodapé do PDF (opcional)" valor={c.rodapePdf ?? ''} aoMudar={(rodapePdf) => mudar({ rodapePdf })} maxLength={500} />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RAIO,
    paddingLeft: espaco(1.25),
    minHeight: 36,
  },
  // Renomear e remover com alvo de 44 px (antes o texto e o X tinham 36 px ou menos).
  renomear: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingRight: espaco(1.25) },
  // Sem quebra no meio da palavra ("Aquecimen/to"): o nome fica numa linha e o chip cresce com ele.
  textoChip: { fontFamily: fontes.semi, fontSize: 14, flexShrink: 0 },
  xChip: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -espaco(1.5) },
  novoTipo: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), flexWrap: 'wrap' },
  // O Botao se fixa no topo da linha (para não esticar em coluna); ao lado do campo desce ao pé dele.
  aoPeDoCampo: { alignSelf: 'flex-end' },
  campoTipo: { width: 220 },
  regra: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1.5), borderTopWidth: 1, paddingTop: espaco(1), flexWrap: 'wrap' },
  // Largura mínima, não fixa: "Aquecimento" quebrava no meio ("Aquecimen/to") com 96 px; nome longo desce de linha inteiro.
  rotuloRegra: { fontFamily: fontes.semi, minWidth: 110, flexShrink: 0, paddingBottom: espaco(1.5) },
  percentuais: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), flex: 1 },
  percentual: { width: 96 },
});
