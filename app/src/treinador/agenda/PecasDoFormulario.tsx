import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DiaDaSemana, TipoDeRepeticao } from '../../api/agendaTipos';
import {
  fimDaHora, type LimitesDeDuracao, opcaoDigitadaDoFim, opcaoDigitadaDoInicio, opcoesDaRepeticao, opcoesDoFim, opcoesDoInicio, PERSONALIZAR_REPETICAO, rotuloDaRepeticaoAtual,
  type ValorDaOpcaoDeRepeticao,
} from '../../dominio/agendaPresencial';
import { dataDaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { MensagemDeErro } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Texto } from '../../ui/Texto';

/** Busca das listas de início e fim: filtra a lista ou aceita uma hora fora da grade de 15 min ("09:10"). */
const DIGITAR_HORA = 'Buscar ou digitar (HH:MM)';

/** Largura da coluna do ícone no painel rápido (o ícone de 20 px e o respiro até o campo). */
const COLUNA_DO_ICONE = 24;

/**
 * Linha do painel rápido, como no Google Agenda: o ícone numa coluna fixa à esquerda (só enfeite: o leitor de tela lê o
 * campo) e o conteúdo à direita. O ícone fica centrado no primeiro controle (44 px) da linha.
 */
export function LinhaComIcone({ Icone, children }: { Icone: LucideIcon; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={estilos.linha}>
      <View style={estilos.icone} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icone size={20} color={cores.textoSuave} strokeWidth={2} />
      </View>
      <View style={estilos.conteudo}>{children}</View>
    </View>
  );
}

/** Título de uma parte do formulário completo ("Quem", "Quando", "Detalhes"): `secao`, h3, na cor do texto. */
export function TituloDaParte({ texto }: { texto: string }) {
  const { cores } = useTema();
  return <Texto variante="secao" nivel={3} cor={cores.texto}>{texto}</Texto>;
}

interface PropsDoHorario {
  /** DD/MM/AAAA. */
  data: string;
  /** HH:MM ou vazio. */
  hora: string;
  /** Minutos, como texto (o que o formulário guarda). */
  duracao: string;
  limites: LimitesDeDuracao;
  erros: { data?: string; hora?: string; duracao?: string };
  aoMudarData: (data: string) => void;
  /** Mudar o início mantém a duração: o fim acompanha (`inicioMudou`). */
  aoMudarHora: (hora: string) => void;
  /** Escolher o fim é escolher a duração (o valor da opção). */
  aoMudarDuracao: (duracao: string) => void;
  /** Painel rápido: data, início e fim numa linha só (o rótulo continua em cima de cada um). */
  compacto?: boolean;
  /** Esconde o início e o fim (evento de dia inteiro). */
  semHoras?: boolean;
  /** O nome da data na mensagem da faixa ("Data do compromisso"); sem ele, "Data". */
  nomeDaData?: string;
}

/**
 * Data, início e fim no lugar de hora + chips + minutos (D5): o início vai de 15 em 15 min e o fim lista as horas a partir
 * do início com a duração no rótulo ("17:30 (1 h)", "00:30 (1 h, dia seguinte)"). Na busca das duas listas dá para digitar
 * qualquer hora ("09:10"), que vira a opção do topo (`opcaoDigitadaDoInicio`/`opcaoDigitadaDoFim`). O formulário continua com `hora` e
 * `duracao`; nada é calculado aqui (as regras são de `dominio/agendaPresencial`). Sem início, o fim espera.
 */
export function CamposDoHorario(p: PropsDoHorario) {
  const inicios = opcoesDoInicio(p.hora || undefined);
  const fins = opcoesDoFim(p.hora, p.limites, p.duracao);
  const fimAtual = fimDaHora(p.hora, p.duracao);
  const data = (
    <View style={p.compacto ? estilos.dataCompacta : estilos.data}>
      <CampoData rotulo="Data" nome={p.nomeDaData} regra="PLANEJAMENTO" valor={p.data} aoMudar={p.aoMudarData} erro={p.erros.data} />
    </View>
  );
  const horas = p.semHoras ? null : <>
    <EscolhaEmFolha rotulo="Início" titulo="Início (Brasília)" valor={p.hora} opcoes={inicios} rotuloDoValor="Escolher" style={estilos.naBase}
      aoMudar={p.aoMudarHora} digitado={{ rotulo: DIGITAR_HORA, opcao: opcaoDigitadaDoInicio }} />
    {fins.length ? (
      <EscolhaEmFolha rotulo="Fim" titulo="Fim (Brasília)" valor={p.duracao.trim()} opcoes={fins}
        rotuloDoValor={fimAtual ?? 'Escolher'} aoMudar={p.aoMudarDuracao} style={estilos.naBase}
        digitado={{ rotulo: DIGITAR_HORA, opcao: (texto) => opcaoDigitadaDoFim(p.hora, texto, p.limites) }} />
    ) : <Texto variante="suave" style={estilos.semFim}>Escolha o início para ver o fim.</Texto>}
  </>;
  // Rápido: data, início e fim numa linha (como no Google). Completo: a data com o rótulo em cima numa linha e o início e
  // o fim na de baixo, para os três não ficarem desencontrados (o rótulo da data muda a altura dela).
  return (
    <View style={estilos.horario}>
      {p.compacto ? <View style={estilos.linhaDoHorario}>{data}{horas}</View> : <>
        {data}
        {horas ? <View style={estilos.linhaDoHorario}>{horas}</View> : null}
      </>}
      {!p.semHoras && p.erros.hora ? <MensagemDeErro erro={`Início: ${p.erros.hora}`} /> : null}
      {!p.semHoras && p.erros.duracao ? <MensagemDeErro erro={`Fim: ${p.erros.duracao}`} /> : null}
    </View>
  );
}

interface PropsDaRepeticao<T extends TipoDeRepeticao | 'NENHUMA'> {
  tipo: T;
  dias: readonly DiaDaSemana[];
  /** DD/MM/AAAA da tela. */
  data: string;
  /** O tipo escolhido na lista (quem chama aplica a regra de troca, com os dias da data no semanal). */
  aoEscolher: (tipo: T) => void;
  /** "Personalizar…": abre o formulário completo com o foco na repetição. */
  aoPersonalizar: () => void;
}

/**
 * "Repetição: Não se repete" no padrão do "Responsável" (`EscolhaEmFolha`), com os rótulos do Google para a data do
 * formulário ("Semanal: cada quarta-feira", "Mensal no dia 18"…) e "Personalizar…". No semanal com vários dias, a opção
 * semanal mostra os dias escolhidos ("Semanal: segunda, quarta e sexta"), e é esse o texto do botão.
 */
export function SeletorDaRepeticao<T extends TipoDeRepeticao | 'NENHUMA'>({ tipo, dias, data, aoEscolher, aoPersonalizar }: PropsDaRepeticao<T>) {
  const dataIso = dataDaTela(data) || null;
  const opcoes = opcoesDaRepeticao(dataIso).map((o) => (o.valor === 'SEMANAL' && tipo === 'SEMANAL'
    ? { ...o, rotulo: rotuloDaRepeticaoAtual({ tipo, dias }, dataIso) } : o));
  return (
    <EscolhaEmFolha<ValorDaOpcaoDeRepeticao> rotulo="Repetição" titulo="Repetição" valor={tipo} opcoes={opcoes}
      aoMudar={(v) => {
        if (v === PERSONALIZAR_REPETICAO) aoPersonalizar();
        else if (v !== tipo) aoEscolher(v as T);
      }} />
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5) },
  icone: { width: COLUNA_DO_ICONE, minHeight: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
  conteudo: { flex: 1, minWidth: 0, gap: espaco(1) },
  horario: { gap: espaco(1) },
  linhaDoHorario: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1) },
  data: { width: 190, maxWidth: '100%' },
  dataCompacta: { width: 170, maxWidth: '100%' },
  // Na base da linha, com o campo da data (o rótulo dela, sempre visível, a deixa mais alta que os botões).
  naBase: { alignSelf: 'flex-end' },
  semFim: { alignSelf: 'center' },
});
