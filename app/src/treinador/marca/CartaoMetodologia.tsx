import { Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
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

/**
 * Metodologia da consultoria (seção 7.3): tipos de série, qual é a de trabalho (WS) e a de preparação (FS), a regra
 * que preenche os percentuais de FS no editor, as repetições de cada tipo (preenchidas ao criar a série ou trocar o tipo), o arredondamento da sugestão de carga do aluno e os textos do PDF.
 * O sistema só guarda e aplica o que o treinador definiu.
 */
export function CartaoMetodologia({ configuracao, aoSalvar }: { configuracao: Configuracao; aoSalvar: (c: Configuracao) => Promise<void> }) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const c = configuracao;
  const [tipos, setTipos] = useState<string[]>(c.tiposSerie);
  const [novoTipo, setNovoTipo] = useState('');
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [trabalho, setTrabalho] = useState(c.tipoTrabalho);
  const [preparacao, setPreparacao] = useState(c.tipoPreparacao);
  const [regra, setRegra] = useState<Regra>(c.regraPreparacao);
  const [faixas, setFaixas] = useState<Faixas>(c.repeticoes ?? {});
  const [arredondamento, setArredondamento] = useState(c.arredondamentoKg);
  const [instrucoes, setInstrucoes] = useState(c.instrucoesTreino ?? '');
  const [rodape, setRodape] = useState(c.rodapePdf ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const chaves = Object.keys(regra).map(Number).sort((a, b) => a - b);
  const regraCompleta = Object.values(regra).every((v) => v.every((p) => p !== null && p >= 1 && p <= 200));
  const faixasValidas = tipos.every((t) => faixaValida(faixas[t]));
  const opcoesTipo = tipos.map((t) => ({ valor: t, rotulo: t }));

  const adicionarTipo = () => {
    const t = novoTipo.trim();
    if (!t || (tipos.includes(t) && t !== renomeando) || (!renomeando && tipos.length >= 20)) return;
    setTipos(renomeando ? tipos.map((x) => x === renomeando ? t : x) : [...tipos, t]);
    if (renomeando && renomeando !== t && faixas[renomeando]) {
      const { [renomeando]: faixa, ...resto } = faixas;
      setFaixas({ ...resto, [t]: faixa });
    }
    if (trabalho === renomeando) setTrabalho(t);
    if (preparacao === renomeando) setPreparacao(t);
    setRenomeando(null);
    setNovoTipo('');
  };

  const salvar = () => {
    setSalvando(true);
    setErro(null);
    aoSalvar({
      tiposSerie: tipos,
      tipoTrabalho: trabalho,
      tipoPreparacao: preparacao,
      regraPreparacao: regra as Record<string, number[]>,
      arredondamentoKg: arredondamento,
      instrucoesTreino: instrucoes,
      rodapePdf: rodape,
      // Só tipos que existem e com a faixa completa; o vazio não vai (o editor não preenche nada para ele).
      repeticoes: Object.fromEntries(
        tipos.flatMap((t) => {
          const f = faixas[t];
          return f && f.min !== null && f.max !== null ? [[t, { min: f.min, max: f.max }]] : [];
        }),
      ),
    }).then(
      () => {
        setSalvando(false);
        avisar('Metodologia salva.', 'sucesso');
      },
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };

  return (
    <Cartao titulo="Metodologia">
      <Texto variante="secao">Tipos de série</Texto>
      <View style={estilos.chips}>
        {tipos.map((t) => {
          const emUso = t === trabalho || t === preparacao;
          return (
            <View key={t} style={[estilos.chip, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Renomear tipo ${t}`} onPress={() => { setRenomeando(t); setNovoTipo(t); }} style={estilos.renomear}><Texto style={estilos.textoChip}>{t} ✎</Texto></Pressable>
              {emUso ? null : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${t}`} onPress={() => {
                  setTipos(tipos.filter((x) => x !== t));
                  const { [t]: _removida, ...resto } = faixas;
                  setFaixas(resto);
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
      <Escolha rotulo="Série de trabalho (carga do dia)" opcoes={opcoesTipo} valor={trabalho} aoMudar={setTrabalho} />
      <Escolha rotulo="Série de preparação (em % da trabalho)" opcoes={opcoesTipo} valor={preparacao} aoMudar={setPreparacao} />

      <Texto variante="secao">Repetições por tipo</Texto>
      <Texto variante="pequeno">
        Preenchidas no editor quando você cria a série ou troca o tipo dela. Mínima e máxima iguais = número fixo (3x3).
        Em branco, o editor não preenche nada. Depois cada série pode ser ajustada no plano.
      </Texto>
      {tipos.map((t) => {
        const f = faixas[t] ?? { min: null, max: null };
        const mudar = (campo: 'min' | 'max', v: number | null) => setFaixas({ ...faixas, [t]: { ...f, [campo]: v } });
        return (
          <View key={t} style={[estilos.regra, { borderColor: cores.borda }]}>
            <Texto style={estilos.rotuloRegra}>{t}</Texto>
            <View style={estilos.percentuais}>
              <View style={estilos.percentual}>
                <CampoNumerico rotulo="Reps mín." inteiro valor={f.min} aoMudar={(v) => mudar('min', v)} />
              </View>
              <View style={estilos.percentual}>
                <CampoNumerico
                  rotulo="Reps máx."
                  inteiro
                  valor={f.max}
                  aoMudar={(v) => mudar('max', v)}
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
                  aoMudar={(v) => setRegra({ ...regra, [String(n)]: regra[String(n)].map((x, j) => (j === i ? v : x)) })}
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
              setRegra(nova);
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
              setRegra({ ...regra, [String(n)]: Array.from({ length: n }, () => null) });
            }}
          />
        </View>
      ) : null}

      <Escolha rotulo="Arredondar a sugestão de carga do aluno para" opcoes={ARREDONDAMENTOS} valor={arredondamento} aoMudar={setArredondamento} />
      <Campo
        rotulo="Instruções do treino (vão no fim do PDF)"
        valor={instrucoes}
        aoMudar={setInstrucoes}
        linhas={6}
        maxLength={20000}
      />
      <Campo rotulo="Rodapé do PDF (opcional)" valor={rodape} aoMudar={setRodape} maxLength={500} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      <View style={estilos.botoes}>
        <Botao
          rotulo="Salvar metodologia"
          aoTocar={salvar}
          carregando={salvando}
          desabilitado={!regraCompleta || !faixasValidas}
          motivo={!regraCompleta ? 'Preencha todos os percentuais da regra de preparação.' : 'Confira as repetições por tipo.'}
        />
      </View>
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
  renomear: { minHeight: 44, justifyContent: 'center' },
  textoChip: { fontFamily: fontes.semi, fontSize: 14, paddingRight: espaco(1.25) },
  xChip: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -espaco(1.5) },
  novoTipo: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), flexWrap: 'wrap' },
  // O Botao se fixa no topo da linha (para não esticar em coluna); ao lado do campo desce ao pé dele.
  aoPeDoCampo: { alignSelf: 'flex-end' },
  campoTipo: { width: 220 },
  regra: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1.5), borderTopWidth: 1, paddingTop: espaco(1), flexWrap: 'wrap' },
  rotuloRegra: { fontFamily: fontes.semi, width: 96, paddingBottom: espaco(1.5) },
  percentuais: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), flex: 1 },
  percentual: { width: 96 },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
});
