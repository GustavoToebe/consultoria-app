/**
 * Regras de texto do "Conferir o arquivo antes de importar" (migração assistida, fase 1). Sem React e sem API: a API manda só
 * contagens, códigos de problema e nomes de aba e de coluna; aqui se escolhe o texto, a ordem e o tom. Nada é gravado e nada
 * daqui fica no aparelho. Só regras fixas, sem IA.
 */
import type {
  AbaDiagnosticada, ColunaDiagnosticada, DiagnosticoDoArquivo, ProblemaDiagnosticado, TipoDoArquivoDiagnosticado,
} from '../api/tipos';
import { rotuloDoTipoDeAba } from './planilhaCompleta';

export type Gravidade = 'impede' | 'atencao' | 'informa';

const RESUMO_DO_TIPO: Record<TipoDoArquivoDiagnosticado, { titulo: string; detalhe: string }> = {
  CADASTRO_DE_ALUNOS: { titulo: 'Cadastro de alunos', detalhe: 'Dá para importar em Alunos, ou pela Planilha completa.' },
  PLANILHA_COMPLETA: { titulo: 'Planilha completa', detalhe: 'Várias abas ligadas. Dá para importar pela Planilha completa.' },
  TREINO: { titulo: 'Treinos', detalhe: 'Dá para importar pela Planilha completa, que liga cada treino ao aluno.' },
  DIETA: { titulo: 'Dietas', detalhe: 'Dá para importar pela Planilha completa, que liga cada dieta ao aluno.' },
  OUTRO: { titulo: 'Conteúdo reconhecido, mas não é cadastro de alunos nem planilha completa', detalhe: 'Confira as abas abaixo e escolha o destino que combina com cada uma.' },
  DESCONHECIDO: { titulo: 'Arquivo não reconhecido', detalhe: 'Nenhuma coluna conhecida. Confira se a primeira linha traz os nomes das colunas.' },
};

export const rotuloDoTipoDoArquivo = (tipo: TipoDoArquivoDiagnosticado) => RESUMO_DO_TIPO[tipo]?.titulo ?? 'Arquivo não reconhecido';
export const detalheDoTipoDoArquivo = (tipo: TipoDoArquivoDiagnosticado) => RESUMO_DO_TIPO[tipo]?.detalhe ?? RESUMO_DO_TIPO.DESCONHECIDO.detalhe;

const UM = (n: number, singular: string, plural: string) => (n === 1 ? `1 ${singular}` : `${n} ${plural}`);

const PROBLEMAS: Record<string, { gravidade: Gravidade; texto: (n: number) => string }> = {
  ARQUIVO_SEM_DADOS: { gravidade: 'impede', texto: () => 'O arquivo não tem nenhuma linha de dados.' },
  ABA_SEM_DADOS: { gravidade: 'atencao', texto: (n) => `${UM(n, 'aba sem nenhuma linha de dados', 'abas sem nenhuma linha de dados')}.` },
  ABA_NAO_RECONHECIDA: { gravidade: 'atencao', texto: (n) => `${UM(n, 'aba não reconhecida', 'abas não reconhecidas')} (não entra${n === 1 ? '' : 'm'} na importação).` },
  ABA_SEM_USO: { gravidade: 'informa', texto: (n) => `${UM(n, 'aba é uma tabela de alimentos de terceiros', 'abas são tabelas de alimentos de terceiros')}: reconhecida, mas nunca importada.` },
  CABECALHO_NAO_ENCONTRADO: { gravidade: 'atencao', texto: (n) => `${UM(n, 'aba sem linha de cabeçalho reconhecida', 'abas sem linha de cabeçalho reconhecida')}. Ponha os nomes das colunas na primeira linha.` },
  CABECALHO_COM_CARA_DE_DADO: { gravidade: 'atencao', texto: (n) => `${UM(n, 'título de coluna parece um dado', 'títulos de coluna parecem dados')} (código, número, data ou e-mail).` },
  DADO_ACIMA_DO_CABECALHO: { gravidade: 'atencao', texto: (n) => `${UM(n, 'linha com dado acima do cabeçalho', 'linhas com dado acima do cabeçalho')}.` },
  COLUNA_NAO_RECONHECIDA: { gravidade: 'informa', texto: (n) => `${UM(n, 'coluna não reconhecida', 'colunas não reconhecidas')} (fica${n === 1 ? '' : 'm'} de fora).` },
  LINHA_SEM_NOME: { gravidade: 'atencao', texto: (n) => `${UM(n, 'aluno sem nome', 'alunos sem nome')}.` },
  EMAIL_INVALIDO: { gravidade: 'atencao', texto: (n) => `${UM(n, 'e-mail inválido', 'e-mails inválidos')}.` },
  EMAIL_DUPLICADO: { gravidade: 'atencao', texto: (n) => `${UM(n, 'e-mail repetido', 'e-mails repetidos')} no arquivo.` },
  DATA_INVALIDA: { gravidade: 'atencao', texto: (n) => `${UM(n, 'data inválida', 'datas inválidas')} (use DD/MM/AAAA).` },
  CELULA_COM_ERRO_DE_FORMULA: { gravidade: 'atencao', texto: (n) => `${UM(n, 'célula com erro de fórmula', 'células com erro de fórmula')}. Copie e cole como valores antes de enviar.` },
  ACIMA_DO_LIMITE_DO_PLANO: { gravidade: 'atencao', texto: (n) => `Até ${UM(n, 'aluno não cabe', 'alunos não cabem')} no limite de alunos do plano.` },
  ACIMA_DO_LIMITE_DO_TREINADOR: { gravidade: 'atencao', texto: (n) => `Até ${UM(n, 'aluno não cabe', 'alunos não cabem')} no seu limite de alunos.` },
};

const ORDEM: Record<Gravidade, number> = { impede: 0, atencao: 1, informa: 2 };

export function gravidadeDoProblema(codigo: string): Gravidade {
  return PROBLEMAS[codigo]?.gravidade ?? 'atencao';
}

/** Código que esta versão do app não conhece (API mais nova): mostra a contagem sem inventar significado. */
export function textoDoProblema(p: ProblemaDiagnosticado): string {
  return PROBLEMAS[p.codigo]?.texto(p.quantidade) ?? `Outro ponto de atenção (${p.quantidade}).`;
}

/** Os que impedem primeiro, depois os que pedem atenção e por fim os que só informam; dentro de cada grupo, a ordem da API. */
export function problemasEmOrdem(problemas: readonly ProblemaDiagnosticado[]): ProblemaDiagnosticado[] {
  return problemas.map((p, i) => ({ p, i })).sort((a, b) => ORDEM[gravidadeDoProblema(a.p.codigo)] - ORDEM[gravidadeDoProblema(b.p.codigo)] || a.i - b.i).map(({ p }) => p);
}

export interface Veredito { tom: 'sucesso' | 'atencao' | 'perigo'; titulo: string; texto: string }

/**
 * A frase principal. Não promete que a importação dá certo: o diagnóstico lê só o arquivo, e quem confere os alunos que já
 * existem é a prévia da importação.
 */
export function veredito(d: Pick<DiagnosticoDoArquivo, 'tipo' | 'problemas'>): Veredito {
  const impede = d.tipo === 'DESCONHECIDO' || d.problemas.some((p) => gravidadeDoProblema(p.codigo) === 'impede');
  if (impede) {
    return { tom: 'perigo', titulo: 'Este arquivo não dá para importar como está', texto: 'Veja o que falta abaixo, corrija na planilha e confira de novo.' };
  }
  if (d.problemas.some((p) => gravidadeDoProblema(p.codigo) === 'atencao')) {
    return { tom: 'atencao', titulo: 'Dá para importar, mas há pontos para corrigir', texto: 'As linhas com problema podem ficar de fora. Corrigir na planilha antes evita isso.' };
  }
  return { tom: 'sucesso', titulo: 'Nenhum problema encontrado no arquivo', texto: 'Esta conferência só lê o arquivo. A prévia da importação confere também os alunos que já existem.' };
}

const ROTULOS_DE_CAMPO: Record<string, string> = {
  ALUNO: 'Nome do aluno', ALUNO_CODIGO: 'Código do aluno', CODIGO: 'Código', EMAIL: 'E-mail', TELEFONE: 'Telefone',
  OBJETIVO: 'Objetivo', STATUS: 'Situação', ATIVO: 'Ativo', DATA: 'Data', DATA_INICIO: 'Data de início', PESO: 'Peso',
  PESO_INICIAL: 'Peso inicial', OBSERVACAO: 'Observação', EXERCICIO: 'Exercício', SERIES: 'Séries', REPETICOES: 'Repetições',
  CARGA: 'Carga', DESCANSO: 'Descanso', VIDEO: 'Vídeo', GRUPO_MUSCULAR: 'Grupo muscular', ALIMENTO: 'Alimento',
  QUANTIDADE: 'Quantidade', UNIDADE: 'Unidade', REFEICAO: 'Refeição', KCAL: 'Calorias', PROTEINA: 'Proteína',
  CARBOIDRATO: 'Carboidrato', GORDURA: 'Gordura', SUPLEMENTO: 'Suplemento', DOSE: 'Dose', HORARIO: 'Horário', TITULO: 'Título',
  PLANO_CODIGO: 'Código do plano', ROTINA_CODIGO: 'Código da rotina', LETRA_TREINO: 'Letra do treino', NOME_TREINO: 'Nome do treino',
  OPCAO: 'Opção', ORDEM: 'Ordem', ORIENTACAO: 'Orientação', SEMANA: 'Semana', VARIACAO: 'Variação', PRESCRICAO: 'Prescrição',
  SERIES_TRABALHO: 'Séries de trabalho', SERIES_PREPARACAO: 'Séries de preparação', TOP_SET: 'Top set', BACK_OFF: 'Back off',
  BACK_OFF_PERCENTUAL: 'Back off em %',
};

/** O campo reconhecido em palavras; o que não está na lista vira o código com espaços ("PLANO_CODIGO" → "Plano codigo"). */
export function rotuloDoCampo(campo: string): string {
  if (ROTULOS_DE_CAMPO[campo]) return ROTULOS_DE_CAMPO[campo];
  const texto = campo.toLowerCase().replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** O nome da coluna como a planilha traz, ou "Coluna C" quando o cabeçalho não foi reconhecido. */
export const nomeDaColuna = (c: ColunaDiagnosticada) => (c.nome && c.nome.trim() ? c.nome.trim() : `Coluna ${c.letra}`);

export function colunasDaAba(aba: Pick<AbaDiagnosticada, 'colunas'>): { reconhecidas: string[]; naoReconhecidas: string[] } {
  const reconhecidas: string[] = [];
  const naoReconhecidas: string[] = [];
  for (const c of aba.colunas) {
    if (c.campo) reconhecidas.push(`${nomeDaColuna(c)}: ${rotuloDoCampo(c.campo)}`);
    else naoReconhecidas.push(nomeDaColuna(c));
  }
  return { reconhecidas, naoReconhecidas };
}

/** Uma linha por contagem da aba; só o que tem número (zero não aparece). */
export function contagensDaAba(aba: AbaDiagnosticada): string[] {
  const itens: string[] = [UM(aba.linhas, 'linha de dados', 'linhas de dados')];
  if (aba.linhasVazias > 0) itens.push(UM(aba.linhasVazias, 'linha em branco', 'linhas em branco'));
  return itens;
}

export const tituloDaAba = (aba: Pick<AbaDiagnosticada, 'nome' | 'tipo'>) =>
  `${aba.nome.trim() || 'Planilha'} · ${rotuloDoTipoDeAba(aba.tipo)}`;
