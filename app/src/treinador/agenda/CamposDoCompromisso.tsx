import { X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DiaDaSemana } from '../../api/agendaTipos';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import { listarAlunos } from '../../api/rotas';
import {
  ALUNOS_MAXIMO, alternarDiaDaRepeticao, DURACOES_SUGERIDAS, type ErrosDaRepeticao, type ErrosDoCompromisso, type FormularioDaRepeticao,
  AJUDA_DIAS_UTEIS, type FormularioDoCompromisso, LIMITES_COMPROMISSO, mascaraHora, OCORRENCIAS_MAXIMO, OCORRENCIAS_MINIMO, OPCOES_DE_DIA_DA_SEMANA,
  OPCOES_DE_REPETICAO, repeticaoDoFormulario, textoDaDuracao, textoDaPrevisao, trocarTipoDaRepeticao,
} from '../../dominio/agendaPresencial';
import { dataDaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';

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
  /** Avisos que não bloqueiam (aluno ocupado, responsável com outro compromisso), logo depois do horário. */
  avisos?: ReactNode;
  /** Linha sobre a série, no topo (ocorrência e o que a data mudada alcança). */
  sobreASerie?: ReactNode;
}

/**
 * Campos do compromisso com aluno: os participantes (de 1 a 20, chips com remover e a busca para adicionar), responsável,
 * data, hora, duração, a repetição (só ao marcar), local e observação. Os botões ficam no rodapé da folha, fora da
 * rolagem, para o teclado do celular não cobri-los. Toda regra vem de `dominio/agendaPresencial`.
 */
export function CamposDoCompromisso(p: Props) {
  const { form, erros, mudar } = p;
  const opcoesResponsavel = p.responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }));
  const duracaoSugerida = DURACOES_SUGERIDAS.find((d) => String(d) === form.duracao.trim()) ?? null;
  return (
    <View style={estilos.coluna}>
      {p.sobreASerie}
      <Participantes alunoIds={form.alunoIds} nomes={p.nomes} erro={erros.alunoIds} aoAdicionar={p.aoAdicionarAluno} aoRemover={p.aoRemoverAluno} />
      <EscolhaEmFolha rotulo="Responsável" titulo="Escolher responsável" valor={form.responsavelId} opcoes={opcoesResponsavel}
        rotuloDoValor={p.nomeDoResponsavel ?? 'Escolher'} aoMudar={(id) => mudar('responsavelId', id)}
        textoVazio="Nenhum membro ativo na equipe." />
      {erros.responsavelId ? <ErroDoCampo texto={erros.responsavelId} /> : null}
      <CampoData rotulo="Data" valor={form.data} aoMudar={(t) => mudar('data', t)} erro={erros.data} />
      <Campo rotulo="Hora (Brasília)" valor={form.hora} aoMudar={(t) => mudar('hora', mascaraHora(t))} erro={erros.hora}
        placeholder="HH:MM" keyboardType="number-pad" inputMode="numeric" maxLength={5} numerico />
      <Escolha rotulo="Duração" valor={duracaoSugerida} opcoes={DURACOES_SUGERIDAS.map((d) => ({ valor: d, rotulo: textoDaDuracao(d) }))}
        aoMudar={(d) => { if (d !== null) mudar('duracao', String(d)); }} />
      <Campo rotulo="Duração em minutos" valor={form.duracao} aoMudar={(t) => mudar('duracao', t.replace(/\D/g, '').slice(0, 3))}
        erro={erros.duracao} ajuda={`De ${LIMITES_COMPROMISSO.duracaoMinima} a ${LIMITES_COMPROMISSO.duracaoMaxima} minutos.`}
        keyboardType="number-pad" inputMode="numeric" numerico />
      {p.avisos}
      {p.comRepeticao ? <CamposDaRepeticao repeticao={form.repeticao} data={form.data} erros={p.errosDaRepeticao} hoje={p.hoje}
        aoMudar={p.mudarRepeticao} /> : null}
      <Campo rotulo="Local (opcional)" valor={form.local} aoMudar={(t) => mudar('local', t)} erro={erros.local}
        maxLength={LIMITES_COMPROMISSO.local} placeholder="Ex.: Sala 2, academia, online" />
      {p.comObservacao ? <Campo rotulo="Observação (opcional)" valor={form.observacao} aoMudar={(t) => mudar('observacao', t)}
        erro={erros.observacao} linhas={3} maxLength={LIMITES_COMPROMISSO.observacao}
        ajuda="Só a equipe vê. Os alunos não veem a observação." /> : null}
    </View>
  );
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
 * Repetição ao marcar (D4): não repete, todo dia, dias úteis, toda semana (com os dias, de segunda a domingo), todo mês
 * ou todo ano; o fim é obrigatório (numa data ou de 2 a 52 vezes). A prévia "N compromissos, de X a Y" usa a mesma regra
 * da API; os erros aparecem junto do campo depois de tentar salvar.
 */
function CamposDaRepeticao({ repeticao: r, data, erros, hoje, aoMudar }: {
  repeticao: FormularioDaRepeticao; data: string; erros: ErrosDaRepeticao; hoje: string; aoMudar: (r: FormularioDaRepeticao) => void;
}) {
  const primeira = dataDaTela(data) || null;
  const { previsao } = repeticaoDoFormulario(r, primeira);
  return (
    <View style={estilos.grupo}>
      <Escolha rotulo="Repetição" valor={r.tipo} opcoes={[...OPCOES_DE_REPETICAO]} aoMudar={(tipo) => aoMudar(trocarTipoDaRepeticao(r, tipo, data))} />
      {erros.tipo ? <ErroDoCampo texto={erros.tipo} /> : null}
      {r.tipo === 'DIAS_UTEIS' ? <Texto variante="suave">{AJUDA_DIAS_UTEIS}</Texto> : null}
      {r.tipo === 'NENHUMA' ? null : <>
        {r.tipo === 'SEMANAL' ? <DiasDaSemana dias={r.dias} aoMudar={(dias) => aoMudar({ ...r, dias })} /> : null}
        {erros.dias ? <ErroDoCampo texto={erros.dias} /> : null}
        <Escolha rotulo="Termina" valor={r.fim} opcoes={OPCOES_DO_FIM} aoMudar={(fim) => aoMudar({ ...r, fim })} />
        {r.fim === 'DATA'
          ? <CampoData rotulo="Última data" valor={r.ate} aoMudar={(ate) => aoMudar({ ...r, ate })} erro={erros.ate} />
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
    </View>
  );
}

/** Dias da semana do "Toda semana", de segunda a domingo (P1): caixas de marcar com o nome por extenso para o leitor. */
function DiasDaSemana({ dias, aoMudar }: { dias: readonly DiaDaSemana[]; aoMudar: (dias: DiaDaSemana[]) => void }) {
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
                backgroundColor: ativo ? cores.texto : sobre(e) ? cores.superficie3 : cores.superficie2,
                borderColor: ativo ? cores.texto : cores.borda,
              }]}>
              <Texto style={[estilos.textoDoDia, { color: ativo ? cores.fundo : cores.texto }]}>{d.rotulo}</Texto>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ErroDoCampo({ texto }: { texto: string }) {
  const { cores } = useTema();
  return <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{texto}</Texto>;
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  grupo: { gap: espaco(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  chip: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', minHeight: ALVO_TOQUE, paddingLeft: espaco(1.5), borderWidth: 1, borderRadius: RAIO },
  nomeDoChip: { flexShrink: 1 },
  dias: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  dia: { minWidth: ALVO_TOQUE + 8, minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1), borderWidth: 1, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  textoDoDia: { fontFamily: fontes.semi, fontSize: 14 },
});
