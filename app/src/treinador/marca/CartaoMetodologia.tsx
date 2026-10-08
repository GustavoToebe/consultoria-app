import { Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { alterarConfiguracao } from '../../api/rotas';
import type { ConsultoriaResponse } from '../../api/tipos';
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

/**
 * Metodologia da consultoria (seção 7.3): tipos de série, qual é a de trabalho (WS) e a de preparação (FS), a regra
 * que preenche os percentuais de FS no editor, o arredondamento da sugestão de carga do aluno e os textos do PDF.
 * O sistema só guarda e aplica o que o treinador definiu.
 */
export function CartaoMetodologia({ consultoria, aoSalvar }: { consultoria: ConsultoriaResponse; aoSalvar: (c: ConsultoriaResponse) => void }) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const c = consultoria.configuracao;
  const [tipos, setTipos] = useState<string[]>(c.tiposSerie);
  const [novoTipo, setNovoTipo] = useState('');
  const [trabalho, setTrabalho] = useState(c.tipoTrabalho);
  const [preparacao, setPreparacao] = useState(c.tipoPreparacao);
  const [regra, setRegra] = useState<Regra>(c.regraPreparacao);
  const [arredondamento, setArredondamento] = useState(c.arredondamentoKg);
  const [instrucoes, setInstrucoes] = useState(c.instrucoesTreino ?? '');
  const [rodape, setRodape] = useState(c.rodapePdf ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const chaves = Object.keys(regra).map(Number).sort((a, b) => a - b);
  const regraCompleta = Object.values(regra).every((v) => v.every((p) => p !== null && p >= 1 && p <= 200));
  const opcoesTipo = tipos.map((t) => ({ valor: t, rotulo: t }));

  const adicionarTipo = () => {
    const t = novoTipo.trim();
    if (!t || tipos.includes(t) || tipos.length >= 20) return;
    setTipos([...tipos, t]);
    setNovoTipo('');
  };

  const salvar = () => {
    setSalvando(true);
    setErro(null);
    alterarConfiguracao({
      tiposSerie: tipos,
      tipoTrabalho: trabalho,
      tipoPreparacao: preparacao,
      regraPreparacao: regra as Record<string, number[]>,
      arredondamentoKg: arredondamento,
      instrucoesTreino: instrucoes,
      rodapePdf: rodape,
    }).then(
      (r) => {
        setSalvando(false);
        aoSalvar(r);
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
              <Texto style={estilos.textoChip}>{t}</Texto>
              {emUso ? null : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${t}`} onPress={() => setTipos(tipos.filter((x) => x !== t))} style={estilos.xChip}>
                  <X size={16} color={cores.textoSuave} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <View style={estilos.novoTipo}>
        <View style={estilos.campoTipo}>
          <Campo rotulo="Novo tipo" valor={novoTipo} aoMudar={setNovoTipo} maxLength={30} onSubmitEditing={adicionarTipo} />
        </View>
        <Botao rotulo="Adicionar" tipo="secundario" Icone={Plus} aoTocar={adicionarTipo} desabilitado={!novoTipo.trim()} />
      </View>
      <Escolha rotulo="Série de trabalho (carga do dia)" opcoes={opcoesTipo} valor={trabalho} aoMudar={setTrabalho} />
      <Escolha rotulo="Série de preparação (em % da trabalho)" opcoes={opcoesTipo} valor={preparacao} aoMudar={setPreparacao} />

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
            rotulo={`Regra para ${(chaves[chaves.length - 1] ?? 0) + 1} séries`}
            tipo="secundario"
            Icone={Plus}
            aoTocar={() => {
              const n = (chaves[chaves.length - 1] ?? 0) + 1;
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
        <Botao rotulo="Salvar metodologia" aoTocar={salvar} carregando={salvando} desabilitado={!regraCompleta} />
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
  textoChip: { fontFamily: fontes.semi, fontSize: 14, paddingRight: espaco(1.25) },
  xChip: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -espaco(1) },
  novoTipo: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), flexWrap: 'wrap' },
  campoTipo: { width: 220 },
  regra: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1.5), borderTopWidth: 1, paddingTop: espaco(1), flexWrap: 'wrap' },
  rotuloRegra: { fontFamily: fontes.semi, width: 72, paddingBottom: espaco(1.5) },
  percentuais: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), flex: 1 },
  percentual: { width: 96 },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
});
