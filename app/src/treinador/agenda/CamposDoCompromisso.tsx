import { AlignLeft, Check, Clock, MapPin, UserRound, Users, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { DiaDaSemana } from '../../api/agendaTipos';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import { listarAlunos } from '../../api/rotas';
import {
  ALUNOS_MAXIMO, alternarDiaDaRepeticao, type ErrosDaRepeticao, type ErrosDoCompromisso, type FormularioDaRepeticao,
  AJUDA_DIAS_UTEIS, type FormularioDoCompromisso, LIMITES_COMPROMISSO, OCORRENCIAS_MAXIMO, OCORRENCIAS_MINIMO, OPCOES_DE_DIA_DA_SEMANA,
  repeticaoDoFormulario, textoDaPrevisao, trocarTipoDaRepeticao,
} from '../../dominio/agendaPresencial';
import { dataDaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { depoisDeFecharAsFolhas } from '../../ui/historicoDasFolhas';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { sobre } from '../../ui/sobre';
import { coresDaSelecao } from '../../ui/selecao';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { CamposDoHorario, LinhaComIcone, SeletorDaRepeticao, TituloDaParte } from './PecasDoFormulario';

/** Alunos por página de `GET /alunos` (igual à API). */
const TAMANHO_PAGINA = 30;

interface Props {
  form: FormularioDoCompromisso;
  erros: ErrosDoCompromisso;
  errosDaRepeticao: ErrosDaRepeticao;
  mudar: <K extends keyof FormularioDoCompromisso>(campo: K, valor: FormularioDoCompromisso[K]) => void;
  mudarRepeticao: (r: FormularioDaRepeticao) => void;
  /** Nome de cada aluno escolhido (a lista da busca muda; o nome fica guardado aqui). */
  nomes: Readonly<Record<string, string>>;
  aoAdicionarAluno: (id: string, nome: string) => void;
  aoRemoverAluno: (id: string) => void;
  responsaveis: readonly ResponsavelEquipe[];
  /** Nome do responsável gravado, quando ele não está mais entre os ativos. */
  nomeDoResponsavel: string | null;
  comObservacao: boolean;
  /** A repetição só aparece ao marcar um compromisso novo (remarcar nunca repete). */
  comRepeticao: boolean;
  hoje: string;
  /** Formulário completo ("Mais opções" e a edição); sem isto, o painel rápido com linhas de ícone. */
  completo: boolean;
  /** Passa para o formulário completo ("Personalizar…" da repetição). */
  aoMaisOpcoes: () => void;
  /** Avisos que não bloqueiam (aluno ocupado, responsável com outro compromisso), logo depois do horário. */
  avisos?: ReactNode;
  /** Linha sobre a série, no topo (ocorrência e o que a data mudada alcança). */
  sobreASerie?: ReactNode;
}

/**
 * Campos do compromisso com aluno, em dois jeitos (D4): o painel rápido do Google Agenda (linhas com o ícone à esquerda:
 * alunos, data e horário com a repetição, responsável, local, observação) e o formulário completo nas partes "Quem",
 * "Quando" e "Detalhes" (F12, a mesma ordem), com os dias da semana do semanal. Rótulos sempre à vista. O horário é início–fim (D5) e a repetição, a lista com os rótulos do Google
 * (D6). Os botões ficam no rodapé da folha, fora da rolagem, para o teclado do celular não cobri-los. Toda regra vem de
 * `dominio/agendaPresencial`.
 */
export function CamposDoCompromisso(p: Props) {
  const { form, erros, mudar, completo } = p;
  const r = form.repeticao;
  const opcoesResponsavel = p.responsaveis.map((x) => ({ valor: x.id, rotulo: x.nome }));

  // "Personalizar…": sem repetição vira o semanal do dia da data; abre o completo com o foco na repetição. Espera a folha da
  // lista fechar (ela entra no histórico do navegador) antes de trocar o formulário.
  const repeticaoRef = useRef<View>(null);
  const [focarRepeticao, setFocarRepeticao] = useState(0);
  useEffect(() => {
    if (!focarRepeticao || Platform.OS !== 'web') return undefined;
    const relogio = setTimeout(() => focarDentro(repeticaoRef.current), 0);
    return () => clearTimeout(relogio);
  }, [focarRepeticao]);
  const personalizar = () => depoisDeFecharAsFolhas(() => {
    if (r.tipo === 'NENHUMA') p.mudarRepeticao(trocarTipoDaRepeticao(r, 'SEMANAL', form.data));
    p.aoMaisOpcoes();
    setFocarRepeticao((n) => n + 1);
  });

  const horario = <CamposDoHorario data={form.data} hora={form.hora} duracao={form.duracao} limites={LIMITES_COMPROMISSO} compacto={!completo}
    erros={{ data: erros.data, hora: erros.hora, duracao: erros.duracao }} aoMudarData={(t) => mudar('data', t)} nomeDaData="Data do compromisso"
    aoMudarHora={(h) => mudar('hora', h)} aoMudarDuracao={(d) => mudar('duracao', d)} />;
  const repeticao = p.comRepeticao ? (
    <View ref={repeticaoRef} style={estilos.grupo}>
      <SeletorDaRepeticao tipo={r.tipo} dias={r.dias} data={form.data} aoPersonalizar={personalizar}
        aoEscolher={(tipo) => p.mudarRepeticao(trocarTipoDaRepeticao({ ...r, dias: [] }, tipo, form.data))} />
      <DetalhesDaRepeticao repeticao={r} data={form.data} erros={p.errosDaRepeticao} hoje={p.hoje} comDias={completo} aoMudar={p.mudarRepeticao} />
    </View>
  ) : null;
  const participantes = <Participantes alunoIds={form.alunoIds} nomes={p.nomes} erro={erros.alunoIds} aoAdicionar={p.aoAdicionarAluno}
    aoRemover={p.aoRemoverAluno} />;
  const responsavel = <View style={estilos.grupo}>
    <EscolhaEmFolha rotulo="Responsável" titulo="Escolher responsável" valor={form.responsavelId} opcoes={opcoesResponsavel}
      rotuloDoValor={p.nomeDoResponsavel ?? 'Escolher'} aoMudar={(id) => mudar('responsavelId', id)}
      textoVazio="Nenhum membro ativo na equipe." />
    {erros.responsavelId ? <ErroDoCampo texto={erros.responsavelId} /> : null}
  </View>;
  // Rótulo sempre à vista, com "(opcional)" nos dois opcionais (a maioria é obrigatória; P2).
  const local = <Campo rotulo="Local (opcional)" valor={form.local} aoMudar={(t) => mudar('local', t)} erro={erros.local}
    maxLength={LIMITES_COMPROMISSO.local} placeholder="Ex.: Sala 2, academia, online" />;
  const observacao = p.comObservacao ? <Campo rotulo="Observação (opcional)" valor={form.observacao}
    aoMudar={(t) => mudar('observacao', t)} erro={erros.observacao} linhas={3} maxLength={LIMITES_COMPROMISSO.observacao}
    ajuda="Só a equipe vê. Os alunos não veem a observação." /> : null;

  // F12: na ordem de quem marca, quem, quando (data e horário, repetição e os avisos de horário) e os detalhes.
  if (!completo) {
    return (
      <View style={estilos.coluna}>
        {p.sobreASerie}
        <LinhaComIcone Icone={Users}>{participantes}</LinhaComIcone>
        <LinhaComIcone Icone={Clock}>{horario}{repeticao}{p.avisos}</LinhaComIcone>
        <LinhaComIcone Icone={UserRound}>{responsavel}</LinhaComIcone>
        <LinhaComIcone Icone={MapPin}>{local}</LinhaComIcone>
        {observacao ? <LinhaComIcone Icone={AlignLeft}>{observacao}</LinhaComIcone> : null}
      </View>
    );
  }
  // Duas colunas no PC: Quem e Quando à esquerda, Detalhes à direita (a leitura e o Tab seguem a mesma ordem); uma só
  // coluna abaixo de 760 px.
  return (
    <View style={estilos.coluna}>
      {p.sobreASerie}
      <Grade gap={espaco(3)} alinhar="inicio">
        <View style={estilos.parte}>
          <TituloDaParte texto="Quem" />
          {participantes}
          <TituloDaParte texto="Quando" />
          {horario}
          {repeticao}
          {p.avisos}
        </View>
        <View style={estilos.parte}>
          <TituloDaParte texto="Detalhes" />
          {responsavel}
          {local}
          {observacao}
        </View>
      </Grade>
    </View>
  );
}

/** Leva o foco ao primeiro controle de um bloco (web) e o traz para a vista, sem animação. */
export function focarDentro(bloco: View | null) {
  const el = bloco as unknown as HTMLElement | null;
  if (!el?.querySelector) return;
  el.scrollIntoView?.({ block: 'nearest' });
  (el.querySelector('[role="checkbox"],[role="button"],button,input') as HTMLElement | null)?.focus?.();
}

/** Os alunos escolhidos em chips (com remover) e o "Adicionar" com a busca da API, sem repetir e até o máximo. */
function Participantes({ alunoIds, nomes, erro, aoAdicionar, aoRemover }: {
  alunoIds: readonly string[]; nomes: Readonly<Record<string, string>>; erro?: string;
  aoAdicionar: (id: string, nome: string) => void; aoRemover: (id: string) => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = useState(0);
  const alunos = useCarregar(`agenda-alunos:${buscaAtrasada}:${pagina}`, () => listarAlunos({ busca: buscaAtrasada, pagina, situacao: 'ATIVO' }));
  const itens = alunos.dados?.itens ?? [];
  const temMais = !!alunos.dados && pagina * TAMANHO_PAGINA + itens.length < alunos.dados.total;
  const cheio = alunoIds.length >= ALUNOS_MAXIMO;
  const opcoes = itens.filter((a) => !alunoIds.includes(a.id)).map((a) => ({ valor: a.id, rotulo: a.nome }));
  return (
    <View style={estilos.grupo}>
      <Texto variante="rotulo" numerico>{`Alunos · ${alunoIds.length} de ${ALUNOS_MAXIMO}`}</Texto>
      {alunoIds.length ? (
        <View style={estilos.chips} accessibilityRole="list" accessibilityLabel="Alunos do compromisso">
          {alunoIds.map((id) => {
            const nome = nomes[id] ?? 'Aluno';
            return (
              <View key={id} accessibilityRole="text" style={[estilos.chip, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
                <Texto numberOfLines={1} style={estilos.nomeDoChip}>{nome}</Texto>
                <IconeBotao Icone={X} rotulo={`Remover ${nome}`} aoTocar={() => aoRemover(id)} />
              </View>
            );
          })}
        </View>
      ) : <Texto variante="suave">Nenhum aluno escolhido ainda.</Texto>}
      <EscolhaEmFolha rotulo="Aluno" titulo="Adicionar aluno" valor="" rotuloDoValor="Adicionar" opcoes={opcoes} desabilitado={cheio}
        aoMudar={(id) => { const a = itens.find((i) => i.id === id); if (a) aoAdicionar(a.id, a.nome); }}
        busca={{ valor: busca, rotulo: 'Buscar aluno', aoMudar: (v) => { setBusca(v); setPagina(0); } }}
        textoVazio={itens.length ? 'Todos os alunos desta busca já estão no compromisso.' : 'Nenhum aluno ativo encontrado.'} carregando={alunos.carregando}
        rodape={<>
          {pagina > 0 || temMais ? <LinhaDeAcoes>
            {pagina > 0 ? <Botao rotulo="Alunos anteriores" tipo="secundario" aoTocar={() => setPagina(pagina - 1)} /> : null}
            {temMais ? <Botao rotulo="Próximos alunos" tipo="secundario" aoTocar={() => setPagina(pagina + 1)} /> : null}
          </LinhaDeAcoes> : null}
          {alunos.erro ? <MensagemErro texto={textoDoErro(alunos.erro)} erro={alunos.erro} tentarDeNovo={alunos.recarregar} /> : null}
        </>} />
      {cheio ? <Texto variante="pequeno">{`O compromisso já tem ${ALUNOS_MAXIMO} alunos, o máximo. Remova um para incluir outro.`}</Texto> : null}
      {erro ? <ErroDoCampo texto={erro} /> : null}
    </View>
  );
}

const OPCOES_DO_FIM: { valor: FormularioDaRepeticao['fim']; rotulo: string }[] = [
  { valor: 'VEZES', rotulo: 'Depois de algumas vezes' },
  { valor: 'DATA', rotulo: 'Numa data' },
];

/**
 * O resto da repetição ao marcar, depois da lista do tipo: os dias no semanal (só no formulário completo; no rápido o
 * semanal é o dia da data), o fim (obrigatório: numa data ou de 2 a 52 vezes) e a prévia "N compromissos, de X a Y", com a
 * mesma regra da API. Os erros aparecem junto do campo depois de tentar salvar.
 */
function DetalhesDaRepeticao({ repeticao: r, data, erros, hoje, comDias, aoMudar }: {
  repeticao: FormularioDaRepeticao; data: string; erros: ErrosDaRepeticao; hoje: string; comDias: boolean;
  aoMudar: (r: FormularioDaRepeticao) => void;
}) {
  const primeira = dataDaTela(data) || null;
  const { previsao } = repeticaoDoFormulario(r, primeira);
  return (
    <>
      {erros.tipo ? <ErroDoCampo texto={erros.tipo} /> : null}
      {r.tipo === 'DIAS_UTEIS' ? <Texto variante="suave">{AJUDA_DIAS_UTEIS}</Texto> : null}
      {r.tipo === 'NENHUMA' ? null : <>
        {r.tipo === 'SEMANAL' && comDias ? <DiasDaSemana dias={r.dias} aoMudar={(dias) => aoMudar({ ...r, dias })} /> : null}
        {erros.dias ? <ErroDoCampo texto={erros.dias} /> : null}
        <Escolha rotulo="Termina" valor={r.fim} opcoes={OPCOES_DO_FIM} aoMudar={(fim) => aoMudar({ ...r, fim })} />
        {r.fim === 'DATA'
          ? <CampoData rotulo="Última data" nome="Última data da repetição" regra="PLANEJAMENTO" valor={r.ate} aoMudar={(ate) => aoMudar({ ...r, ate })} erro={erros.ate} />
          : <Campo rotulo="Quantas vezes" valor={r.vezes} aoMudar={(t) => aoMudar({ ...r, vezes: t.replace(/\D/g, '').slice(0, 2) })}
            erro={erros.vezes} ajuda={`De ${OCORRENCIAS_MINIMO} a ${OCORRENCIAS_MAXIMO}, contando a primeira.`}
            keyboardType="number-pad" inputMode="numeric" maxLength={2} numerico />}
        {erros.fim ? <ErroDoCampo texto={erros.fim} /> : null}
        <View accessibilityLiveRegion="polite" aria-live="polite">
          {previsao && !previsao.erro ? <Texto variante="bloco" numerico>{textoDaPrevisao(previsao, hoje)}</Texto>
            : previsao?.erro ? <Texto variante="suave">{previsao.erro.mensagem}</Texto>
              : <Texto variante="suave">Informe a data e o fim para ver quantos compromissos serão marcados.</Texto>}
        </View>
      </>}
    </>
  );
}

/** Dias da semana do "Toda semana", de segunda a domingo (P1): caixas de marcar com o nome por extenso para o leitor. */
export function DiasDaSemana({ dias, aoMudar }: { dias: readonly DiaDaSemana[]; aoMudar: (dias: DiaDaSemana[]) => void }) {
  const { cores } = useTema();
  return (
    <View style={estilos.grupo}>
      <Texto variante="rotulo">Dias da semana</Texto>
      <View style={estilos.dias} role="group" aria-label="Dias da semana">
        {OPCOES_DE_DIA_DA_SEMANA.map((d) => {
          const ativo = dias.includes(d.valor);
          return (
            <Pressable key={d.valor} accessibilityRole="checkbox" accessibilityLabel={d.completo} accessibilityState={{ checked: ativo }} aria-checked={ativo}
              onPress={() => aoMudar(alternarDiaDaRepeticao(dias, d.valor))}
              style={(e) => [estilos.dia, {
                // Seleção neutra (`ui/selecao`): superfície de seleção, contorno forte e ✓.
                backgroundColor: ativo ? coresDaSelecao(cores, true).fundo : sobre(e) ? cores.superficie3 : cores.superficie2,
                borderColor: ativo ? coresDaSelecao(cores, true).borda : cores.borda,
              }]}>
              {ativo ? <Check size={14} color={cores.texto} strokeWidth={2.5} /> : null}
              <Texto style={[estilos.textoDoDia, { color: cores.texto }]}>{d.rotulo}</Texto>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Erro de um campo que não é `Campo` (alunos, responsável, repetição): ícone e texto, como o `MensagemDeErro` dos campos. */
export function ErroDoCampo({ texto }: { texto: string }) {
  return <MensagemDeErro erro={texto} />;
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  parte: { gap: espaco(2) },
  grupo: { gap: espaco(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  chip: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', minHeight: ALVO_TOQUE, paddingLeft: espaco(1.5), borderWidth: 1, borderRadius: RAIO },
  nomeDoChip: { flexShrink: 1 },
  dias: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  dia: { minWidth: ALVO_TOQUE + 8, minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1), borderWidth: 1, borderRadius: RAIO, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  textoDoDia: { fontFamily: fontes.semi, fontSize: 14 },
});
