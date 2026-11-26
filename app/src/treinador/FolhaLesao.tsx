import { Check, Lock } from 'lucide-react-native';
import { useId, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { alterarLesao, registrarLesao } from '../api/rotas';
import type { Lesao, SituacaoLesao } from '../api/tipos';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { hojeEmBrasilia } from '../dominio/agendaPresencial';
import {
  analisarLesao, colunasDaGrade, escolherRegiao, formularioDaLesao, LADOS, type LadoDaLesao, LIMITE_DA_DESCRICAO, LIMITE_DA_OBSERVACAO,
  LIMITE_DA_OUTRA, lesaoAlterada, OPCOES_DE_REGIAO, OUTRA, type RegiaoEscolhida, temFim, temLado, trocarSituacao,
} from '../dominio/folhaDeLesao';
import { dataParaTela } from '../dominio/formatos';
import { useFecharComAviso } from '../comunidade/useFecharComAviso';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, misturar, RAIO_CONTROLE } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { Escolha } from '../ui/Escolha';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha, LARGURA_FOLHA } from '../ui/Folha';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

const SITUACOES: { valor: SituacaoLesao; rotulo: string }[] = [
  { valor: 'ATIVA', rotulo: 'Ativa' },
  { valor: 'EM_RECUPERACAO', rotulo: 'Em recuperação' },
  { valor: 'RECUPERADA', rotulo: 'Recuperada' },
];

const REGIOES_DA_GRADE = OPCOES_DE_REGIAO.map((r) => ({ valor: r, rotulo: r }));
const DICA_DO_FIM = 'Preencha quando a lesão estiver recuperada';
const PRIVACIDADE = 'Só a equipe com acesso a dados sensíveis vê. Não aparece para o aluno.';

/**
 * Registrar e Editar lesão (ficha: folha de lesão, 24/11; grade, lado e datas, 26/11). A região é uma grade de 3 por linha
 * (`GradeDeOpcoes`); "Outra" abre o "Qual região?" (com o foco) e o lado só aparece para a região que tem lado. O texto que
 * a API recebe é montado como antes (`textoDaRegiao`). Início e Fim lado a lado (empilhados na folha estreita), cada um com
 * "Usar hoje" (Brasília) embaixo; o Fim só se edita com "Recuperada" (ao entrar, sugere hoje ou o fim que a lesão tinha; ao
 * sair, é limpo e vai nulo). O lugar da dica e do Fim é sempre o mesmo: trocar a situação não mexe a altura da folha.
 * Salvar apagado diz o que falta (`analisarLesao`); fechar com alteração pergunta "Sair sem salvar?". Nada disto vai a log:
 * lesão é dado sensível.
 */
export function FolhaLesao({ alunoId, lesao, aoFechar, aoSalvar }: { alunoId: string; lesao: Lesao | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { cores } = useTema();
  // O que a folha abriu: a referência do "Sair sem salvar?" e do Fim que volta ao marcar "Recuperada" de novo.
  const [aberto] = useState(() => formularioDaLesao(lesao));
  const [form, setForm] = useState(aberto);
  // O foco vai ao "Qual região?" só quando a pessoa escolhe "Outra", não quando a edição já abre nela.
  const [focarOutra, setFocarOutra] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const idDaDica = useId();
  const idDaPrivacidade = useId();
  const { corpo, motivo, erroDoFim } = analisarLesao(form);
  const { fechar, aviso } = useFecharComAviso(true, lesaoAlterada(aberto, form), aoFechar);
  const mudar = (parte: Partial<typeof form>) => setForm((f) => ({ ...f, ...parte }));
  const hoje = () => dataParaTela(hojeEmBrasilia());
  const comFim = temFim(form.situacao);

  const salvar = () => {
    if (!corpo) return;
    setSalvando(true);
    setErro(null);
    (lesao ? alterarLesao(alunoId, lesao.id, corpo) : registrarLesao(alunoId, corpo)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={lesao ? 'Editar lesão' : 'Registrar lesão'}
      aoFechar={fechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!corpo} motivo={motivo ?? undefined} />
        </>
      }>
      <View style={estilos.regiao}>
        <GradeDeOpcoes<RegiaoEscolhida> rotulo="Região do corpo (obrigatória)" opcoes={REGIOES_DA_GRADE} valor={form.regiao} reserva={2}
          aoMudar={(regiao) => {
            if (!regiao) return;
            setForm((f) => escolherRegiao(f, regiao));
            setFocarOutra(regiao === OUTRA);
          }} />
        {form.regiao === OUTRA ? (
          <Campo rotulo="Qual região?" valor={form.outra} aoMudar={(outra) => mudar({ outra })} maxLength={LIMITE_DA_OUTRA}
            placeholder="Ex.: antebraço, costela" autoFocus={focarOutra} />
        ) : null}
        {temLado(form.regiao) ? (
          <GradeDeOpcoes<LadoDaLesao> rotulo="Lado (opcional)" opcoes={LADOS} valor={form.lado} reserva={1} limpavel aoMudar={(lado) => mudar({ lado })} />
        ) : null}
      </View>
      <Campo rotulo="O que é (opcional)" valor={form.descricao} aoMudar={(descricao) => mudar({ descricao })} maxLength={LIMITE_DA_DESCRICAO}
        linhas={2} placeholder="Ex.: tendinite, entorse, pós-cirúrgico" />
      <Escolha rotulo="Situação" opcoes={SITUACOES} valor={form.situacao}
        aoMudar={(situacao) => setForm((f) => trocarSituacao(f, situacao, aberto.fim || hoje()))} />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início (opcional)" nome="Início da lesão" regra="REGISTRO" valor={form.inicio} aoMudar={(inicio) => mudar({ inicio })} />
          <UsarHoje campo="Início" aoTocar={() => mudar({ inicio: hoje() })} />
        </View>
        <View style={estilos.data}>
          {comFim ? (
            <CampoData rotulo="Fim (opcional)" nome="Fim da lesão" regra="REGISTRO" valor={form.fim} aoMudar={(fim) => mudar({ fim })} erro={erroDoFim} />
          ) : (
            // Desabilitado: o `Campo` (o mesmo de dentro do `CampoData`, sem o calendário) para ligar a dica por `aria-describedby`.
            <Campo rotulo="Fim (opcional)" valor="" aoMudar={() => undefined} editable={false} placeholder="DD/MM/AAAA"
              aria-disabled ajudaForaDoCampo={{ id: idDaDica, texto: DICA_DO_FIM }} />
          )}
          {/* A dica fica sempre no desenho (some só da vista e da leitura) e o "Usar hoje" vem por cima: trocar a situação não muda a altura, nem com o texto ampliado. */}
          <View style={estilos.abaixoDoFim}>
            <Texto variante="pequeno" nativeID={idDaDica} aria-hidden={comFim} style={[estilos.dica, comFim && estilos.invisivel]}>{DICA_DO_FIM}</Texto>
            {comFim ? <View style={estilos.sobreADica}><UsarHoje campo="Fim" aoTocar={() => mudar({ fim: hoje() })} /></View> : null}
          </View>
        </View>
      </View>
      <View style={estilos.cuidados}>
        <Texto variante="rotulo" cor={cores.texto}>Cuidados no treino (opcional)</Texto>
        <View style={estilos.privacidade}>
          <View aria-hidden style={estilos.cadeado}><Lock size={14} color={cores.textoSuave} strokeWidth={2.25} /></View>
          <Texto variante="pequeno" nativeID={idDaPrivacidade} style={estilos.textoDaPrivacidade}>{PRIVACIDADE}</Texto>
        </View>
        <Campo rotulo="Cuidados no treino (opcional)" rotuloOculto valor={form.observacao} aoMudar={(observacao) => mudar({ observacao })}
          maxLength={LIMITE_DA_OBSERVACAO} linhas={3} placeholder="Ex.: evitar carga acima da cabeça"
          ajudaForaDoCampo={{ id: idDaPrivacidade, texto: PRIVACIDADE }} />
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {aviso}
    </Folha>
  );
}

/** "Usar hoje" como link pequeno de ação (o padrão do `LinkDeAcao` da agenda): botão com alvo de 44, sublinhado. */
function UsarHoje({ campo, aoTocar }: { campo: string; aoTocar: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Usar hoje no ${campo}`} onPress={aoTocar}
      style={(e) => [estilos.link, sobre(e) && { backgroundColor: cores.sobre }]}>
      <Texto style={[estilos.textoDoLink, { color: cores.texto }]}>Usar hoje</Texto>
    </Pressable>
  );
}

const VAO = espaco(0.75);

/**
 * Uma escolha (radiogroup com setas, do mesmo primitivo do `Escolha`) em grade de colunas iguais, para a região e o lado
 * ficarem alinhados. O escolhido tem ✓ e o tonal da cor de ação (o mesmo dos dias da `FaixaDaSemana`). As colunas vêm da
 * largura medida (`colunasDaGrade`; antes da medida, a estimativa pela janela, para não saltar ao abrir). O rótulo da opção
 * quebra linha em vez de cortar; com o texto ampliado o ✓ desce para cima do nome.
 */
function GradeDeOpcoes<T extends string>({ rotulo, opcoes, valor, aoMudar, reserva, limpavel }: {
  rotulo: string; opcoes: readonly { valor: T; rotulo: string }[]; valor: T | null; aoMudar: (valor: T | null) => void; reserva: 1 | 2; limpavel?: boolean;
}) {
  const { cores, fatorTexto } = useTema();
  const { width: janela } = useWindowDimensions();
  const [largura, setLargura] = useState<number | null>(null);
  const [emCima, setEmCima] = useState<T | null>(null);
  const colunas = colunasDaGrade(largura ?? Math.min(janela, LARGURA_FOLHA) - espaco(4), fatorTexto, reserva, VAO);
  const linhas = Array.from({ length: Math.ceil(opcoes.length / colunas) }, (_, i) => opcoes.slice(i * colunas, (i + 1) * colunas));
  return (
    <View style={estilos.grupo} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      <Texto variante="rotulo" cor={cores.texto} aria-hidden>{rotulo}</Texto>
      <ToggleGroup type="single" role="radiogroup" accessibilityRole="radiogroup" accessibilityLabel={rotulo} value={valor ?? ''}
        onValueChange={(v) => {
          const opcao = opcoes.find((o) => o.valor === v);
          if (opcao) aoMudar(opcao.valor);
          else if (limpavel && !v) aoMudar(null);
        }}
        style={estilos.grade}>
        {linhas.map((linha, i) => (
          <View key={i} style={estilos.linha}>
            {linha.map((o) => {
              const ativo = o.valor === valor;
              const cor = ativo ? cores.acao : cores.texto;
              return (
                <ToggleGroupItem key={o.valor} value={o.valor} role="radio" accessibilityRole="radio" accessibilityLabel={o.rotulo}
                  accessibilityState={{ checked: ativo }}
                  onHoverIn={() => setEmCima(o.valor)} onHoverOut={() => setEmCima((v) => (v === o.valor ? null : v))}
                  // Estilo fixo (o `Slot` do primitivo na web descarta o estilo em função); o mouse em cima vem do estado.
                  style={[estilos.opcao, {
                    backgroundColor: ativo ? cores.acaoSuave : emCima === o.valor ? cores.sobre : cores.superficie,
                    borderColor: ativo ? (emCima === o.valor ? cores.acao : misturar(cores.acaoSuave, cores.acao, 0.35)) : cores.bordaCampo,
                  }]}>
                  {ativo ? <Check size={16} color={cor} strokeWidth={2.5} /> : null}
                  <Texto style={[estilos.textoDaOpcao, { color: cor, fontFamily: ativo ? fontes.semi : fontes.medio }]}>{o.rotulo}</Texto>
                </ToggleGroupItem>
              );
            })}
            {/* Última linha incompleta: as células vazias seguram a largura das colunas. */}
            {Array.from({ length: colunas - linha.length }, (_, j) => <View key={`vazia-${j}`} style={estilos.celulaVazia} />)}
          </View>
        ))}
      </ToggleGroup>
    </View>
  );
}

const estilos = StyleSheet.create({
  regiao: { gap: espaco(1.5) },
  grupo: { gap: espaco(0.5) },
  // A largura inline vence o `w-fit` que o grupo põe na web.
  grade: { width: '100%', flexDirection: 'column', alignItems: 'stretch', gap: VAO },
  linha: { flexDirection: 'row', gap: VAO },
  opcao: {
    // O primitivo usa `flex-1` e altura fixa na web; aqui colunas iguais (base 0) e altura pelo conteúdo.
    flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0, height: 'auto', minHeight: ALVO_TOQUE,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', justifyContent: 'center', columnGap: 6,
    paddingHorizontal: espaco(1), paddingVertical: 4, borderRadius: RAIO_CONTROLE, borderWidth: 1,
  },
  celulaVazia: { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  textoDaOpcao: { fontSize: 14, textAlign: 'center', flexShrink: 1 },
  // Início | Fim em duas colunas iguais; abaixo de ~480 px de folha (2 × 232 + vão) o Fim desce.
  datas: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(1.5) },
  data: { flexGrow: 1, flexShrink: 1, flexBasis: 232, minWidth: 0, gap: espaco(0.25) },
  abaixoDoFim: { minHeight: ALVO_TOQUE, justifyContent: 'center' },
  dica: { paddingVertical: espaco(0.5) },
  invisivel: { opacity: 0 },
  sobreADica: { position: 'absolute', top: 0, left: 0, right: 0 },
  link: { alignSelf: 'flex-start', minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(0.5), marginLeft: -espaco(0.5), borderRadius: RAIO_CONTROLE },
  textoDoLink: { fontFamily: fontes.semi, fontSize: 13, textDecorationLine: 'underline' },
  cuidados: { gap: espaco(0.5) },
  privacidade: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.75) },
  cadeado: { paddingTop: 1 },
  textoDaPrivacidade: { flexShrink: 1 },
});
