package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Reconhecimento;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Formatos da planilha completa além da tabela ligada por código (fase 2, 01/11), só por regras fixas:
 * <ul>
 * <li>{@link FormatoDaAba#UM_ALUNO}: a aba é de um aluno, com o nome dele no nome da aba ("Ana Souza", "Treino - Ana
 * Souza"), e guarda o treino ou a dieta dele (uma ou várias tabelas, cada uma com o cabeçalho; o título em cima de cada
 * tabela, como "Treino A" ou "Café da manhã", vira o nome da divisão ou da refeição).</li>
 * <li>{@link FormatoDaAba#BLOCOS}: numa aba só, vários alunos, cada um com o nome numa linha em cima e a tabela embaixo
 * (o cabeçalho se repete em cada bloco). O aluno de um bloco vale para os blocos seguintes até aparecer outro nome.</li>
 * </ul>
 * Só entram nesses formatos as abas de treino, dieta ou suplementos <b>sem</b> coluna que diga o aluno (código ou nome
 * do aluno, rotina, plano): com ela, a aba é tabela e liga como na fase 1. Sem aluno no nome da aba nem nos títulos, a
 * aba também fica tabela (e as linhas ficam sem dono, como antes).
 *
 * <p>Um cabeçalho de bloco é uma linha com duas ou mais colunas reconhecidas pelos nomes ({@link ReconhecimentoDeAbas}).
 * Um título é uma linha logo acima do cabeçalho com uma ou duas células de texto (até três linhas). O título é o nome de
 * um aluno quando começa por "Aluno:"/"Nome:" ou quando parece nome de pessoa (só letras, até 8 palavras, nenhuma
 * palavra de treino, dieta, grupo muscular, refeição ou dia da semana); senão é o nome da divisão ou da refeição. Nada
 * aqui sai em log; os nomes só voltam ao próprio treinador na análise.
 */
public final class FormatoDasAbas {

    public enum FormatoDaAba { TABELA, UM_ALUNO, BLOCOS }

    /**
     * Um bloco: o aluno (nome como na planilha, nulo = nenhum até aqui), o título da tabela (nome da divisão ou da
     * refeição, nulo = sem), a linha do cabeçalho no arquivo, o reconhecimento das colunas do bloco e as linhas de dados.
     */
    public record Bloco(String aluno, String titulo, int linhaDoCabecalho, Reconhecimento reconhecimento, List<Linha> dados) {
        @Override
        public String toString() {
            return "Bloco[linha=" + linhaDoCabecalho + "]"; // nunca o nome do aluno
        }
    }

    public record Separacao(FormatoDaAba formato, List<Bloco> blocos) {
        static final Separacao TABELA = new Separacao(FormatoDaAba.TABELA, List.of());
    }

    static final int TITULOS_POR_BLOCO = 3;
    private static final int NOME_MAXIMO = 120;
    private static final int PALAVRAS_DO_NOME = 8;
    private static final Set<TipoDeAba> TIPOS_DE_BLOCO = EnumSet.of(TipoDeAba.TREINO, TipoDeAba.DIETA, TipoDeAba.SUPLEMENTOS);
    private static final Set<Campo> DIZEM_O_ALUNO = EnumSet.of(Campo.ALUNO, Campo.ALUNO_CODIGO, Campo.ROTINA_CODIGO,
            Campo.PLANO_CODIGO);
    private static final Pattern ROTULO_DE_ALUNO = Pattern.compile(
            "^\\s*(?:aluno|aluna|nome|cliente|paciente|atleta)\\s*(?:[:\\-–]\\s*|\\s+)(.+)$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    /** Rótulos que podem vir numa célula sozinhos, com o valor na célula ao lado. */
    private static final Set<String> ROTULOS = Set.of("aluno", "aluna", "nome", "cliente", "paciente", "atleta", "treino",
            "ficha", "refeicao", "dia");
    private static final Pattern GENERICO_ANTES = Pattern.compile(
            "^\\s*(?:treinos?|dietas?|fichas?|planos?|rotinas?|planilhas?)\\s*(?:-|–|:|\\s(?:de|da|do)\\s)\\s*(.+)$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern GENERICO_DEPOIS = Pattern.compile(
            "^(.+?)\\s*(?:-|–|:)\\s*(?:treinos?|dietas?|fichas?|planos?|rotinas?|planilhas?)\\s*$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern SO_LETRAS = Pattern.compile("^[\\p{L}][\\p{L}\\s'’.\\-]*$");

    /** Palavras que dizem que o texto é título de aba, de divisão ou de refeição, não nome de pessoa. */
    static final Set<String> GENERICAS = Set.of(
            "treino", "treinos", "ficha", "fichas", "dieta", "dietas", "plano", "planos", "rotina", "rotinas", "exercicio",
            "exercicios", "refeicao", "refeicoes", "alimentacao", "alimento", "alimentos", "suplemento", "suplementos",
            "suplementacao", "planilha", "planilhas", "aba", "folha", "sheet", "plan", "modelo", "modelos", "base", "lista",
            "cadastro", "cadastros", "alunos", "alunas", "pesos", "peso", "historico", "avaliacao", "avaliacoes", "medidas",
            "tabela", "taco", "tbca", "resumo", "geral", "dados", "config", "configuracao", "configuracoes", "metodologia",
            "cardio", "mobilidade", "alongamento", "alongamentos", "semana", "semanas", "mes", "dia", "dias", "segunda",
            "terca", "quarta", "quinta", "sexta", "sabado", "domingo", "feira", "divisao", "divisoes", "cronograma",
            "calendario", "controle", "instrucoes", "orientacoes", "observacoes", "obs", "legenda", "indice", "capa",
            "inicio", "menu", "nutricao", "nutricional", "macros", "receita", "receitas", "compras", "protocolo",
            "protocolos", "periodizacao", "fase", "ciclo", "mesociclo", "microciclo", "bloco", "blocos", "hipertrofia",
            "emagrecimento", "forca", "funcional", "adaptacao", "iniciante", "iniciantes", "intermediario", "avancado",
            "feminino", "masculino", "upper", "lower", "push", "pull", "legs", "full", "body", "fullbody", "peito", "costas",
            "ombro", "ombros", "biceps", "triceps", "braco", "bracos", "perna", "pernas", "quadriceps", "posterior",
            "posteriores", "gluteo", "gluteos", "panturrilha", "panturrilhas", "abdomen", "abdominal", "abdominais", "core",
            "dorsal", "dorsais", "trapezio", "antebraco", "antebracos", "superiores", "inferiores", "membros", "completo",
            "adutores", "abdutores", "lombar", "aquecimento", "cafe", "manha", "almoco", "jantar", "lanche", "ceia",
            "desjejum", "colacao", "pre", "pos", "opcao", "opcoes", "sessao", "sessoes", "series", "serie", "reps",
            "repeticoes", "carga", "cargas", "descanso", "volume", "total", "novo", "nova", "copia");

    private FormatoDasAbas() {
    }

    /**
     * Separa a aba em blocos, se ela é de um aluno ou de vários em blocos; senão {@link Separacao#TABELA}. {@code r} é o
     * reconhecimento da aba inteira (o primeiro cabeçalho).
     */
    public static Separacao separar(String nomeDaAba, List<Linha> linhas, Reconhecimento r) {
        if (!TIPOS_DE_BLOCO.contains(tipoNoBloco(r)) || r.campos().keySet().stream().anyMatch(DIZEM_O_ALUNO::contains)) {
            return Separacao.TABELA;
        }
        List<Integer> cabecalhos = new ArrayList<>();
        for (int i = 0; i < linhas.size(); i++) {
            if (cabecalhoDeBloco(linhas.get(i))) {
                cabecalhos.add(i);
            }
        }
        if (cabecalhos.isEmpty()) {
            return Separacao.TABELA;
        }
        String alunoDaAba = alunoDoNomeDaAba(nomeDaAba).orElse(null);
        List<Bloco> blocos = new ArrayList<>();
        String alunoAtual = alunoDaAba;
        boolean alunoNosTitulos = false;
        int[] inicioDosTitulos = new int[cabecalhos.size()];
        for (int k = 0; k < cabecalhos.size(); k++) {
            int c = cabecalhos.get(k);
            int limite = k == 0 ? -1 : cabecalhos.get(k - 1);
            int j = c - 1;
            while (j > limite && c - j <= TITULOS_POR_BLOCO && linhaDeTitulo(linhas.get(j))) {
                j--;
            }
            inicioDosTitulos[k] = j + 1;
        }
        for (int k = 0; k < cabecalhos.size(); k++) {
            int c = cabecalhos.get(k);
            String titulo = null;
            for (int t = inicioDosTitulos[k]; t < c; t++) {
                String texto = textoDoTitulo(linhas.get(t));
                Optional<String> aluno = alunoDoTitulo(texto);
                if (aluno.isPresent()) {
                    alunoAtual = aluno.get();
                    alunoNosTitulos = true;
                } else {
                    titulo = texto;
                }
            }
            int fim = k + 1 < cabecalhos.size() ? inicioDosTitulos[k + 1] : linhas.size();
            List<Linha> bloco = linhas.subList(c, Math.max(c + 1, fim));
            Reconhecimento doBloco = ReconhecimentoDeAbas.reconhecer(bloco);
            TipoDeAba tipo = tipoNoBloco(doBloco);
            if (doBloco.tipo() != tipo) {
                doBloco = new Reconhecimento(tipo, doBloco.linhaDoCabecalho(), doBloco.posicaoDoCabecalho(), doBloco.campos(),
                        doBloco.avisos());
            }
            List<Linha> dados = new ArrayList<>();
            for (Linha l : bloco.subList(doBloco.posicaoDoCabecalho() + 1, bloco.size())) {
                if (!AnaliseDaPlanilha.emBranco(l)) {
                    dados.add(l);
                }
            }
            blocos.add(new Bloco(alunoAtual, titulo, doBloco.linhaDoCabecalho(), doBloco, List.copyOf(dados)));
        }
        if (!alunoNosTitulos && alunoDaAba == null) {
            return Separacao.TABELA;
        }
        return new Separacao(alunoNosTitulos ? FormatoDaAba.BLOCOS : FormatoDaAba.UM_ALUNO, List.copyOf(blocos));
    }

    /**
     * O tipo dentro de um bloco: o do reconhecimento, e a tabela de alimento e quantidade sem coluna de refeição vira
     * dieta (no bloco de um aluno a refeição é o título; a tabela de terceiros não tem quantidade).
     */
    static TipoDeAba tipoNoBloco(Reconhecimento r) {
        if ((r.tipo() == TipoDeAba.TABELA_DE_ALIMENTOS || r.tipo() == TipoDeAba.DESCONHECIDA) && r.tem(Campo.ALIMENTO)
                && r.tem(Campo.QUANTIDADE)) {
            return TipoDeAba.DIETA;
        }
        return r.tipo();
    }

    /** Linha com duas ou mais colunas reconhecidas pelos nomes, de treino, dieta ou suplementos, sem coluna do aluno. */
    static boolean cabecalhoDeBloco(Linha l) {
        Map<Campo, Integer> campos = new EnumMap<>(Campo.class);
        int reconhecidas = 0;
        for (int i = 0; i < l.celulas().size(); i++) {
            Celula c = l.celulas().get(i);
            if (!ReconhecimentoDeAbas.pareceNomeDeColuna(c)) {
                continue;
            }
            Optional<Campo> campo = ReconhecimentoDeAbas.campoDoNome(c.texto());
            if (campo.isPresent()) {
                reconhecidas++;
                campos.putIfAbsent(campo.get(), i);
            }
        }
        if (reconhecidas < 2 || campos.keySet().stream().anyMatch(DIZEM_O_ALUNO::contains)) {
            return false;
        }
        Reconhecimento r = new Reconhecimento(ReconhecimentoDeAbas.tipo(campos), 0, 0, campos, List.of());
        return TIPOS_DE_BLOCO.contains(tipoNoBloco(r));
    }

    /**
     * Uma célula de texto (com letra, sem cara de dado), ou duas quando a primeira é só o rótulo ("Aluno:" | "Ana"). Uma
     * linha de dados com o exercício e a prescrição nunca é título.
     */
    static boolean linhaDeTitulo(Linha l) {
        List<Celula> cheias = l.celulas().stream().filter(c -> !ReconhecimentoDeAbas.vazia(c)).toList();
        if (cheias.isEmpty() || cheias.size() > 2 || cheias.stream().anyMatch(c -> !textoDeTitulo(c))) {
            return false;
        }
        return cheias.size() == 1 || ROTULOS.contains(String.join(" ", Normalizacao.palavras(cheias.getFirst().texto())));
    }

    private static boolean textoDeTitulo(Celula c) {
        return !c.numero() && !c.erro() && c.texto().chars().anyMatch(Character::isLetter)
                && !FormatoDoConteudo.de(c).dado() && c.texto().strip().length() <= 200;
    }

    /** O texto do título (as células de texto juntas, numa linha). */
    static String textoDoTitulo(Linha l) {
        List<String> partes = new ArrayList<>();
        for (Celula c : l.celulas()) {
            if (!ReconhecimentoDeAbas.vazia(c) && !c.erro()) {
                partes.add(c.texto().strip());
            }
        }
        return String.join(" ", partes).replaceAll("\\s+", " ").strip();
    }

    /** O aluno de um título: "Aluno: Ana" (sempre), ou o texto que parece nome de pessoa. */
    static Optional<String> alunoDoTitulo(String texto) {
        Matcher m = ROTULO_DE_ALUNO.matcher(texto);
        if (m.matches()) {
            String nome = m.group(1).strip();
            return nome.isEmpty() || nome.length() > NOME_MAXIMO ? Optional.empty() : Optional.of(nome);
        }
        return pareceNomeDePessoa(texto) ? Optional.of(texto.strip()) : Optional.empty();
    }

    /** O aluno do nome da aba: "Ana Souza", "Treino - Ana Souza", "Dieta da Ana", "Ana Souza - Treino". */
    static Optional<String> alunoDoNomeDaAba(String nome) {
        if (nome == null || nome.isBlank()) {
            return Optional.empty();
        }
        String t = nome.strip();
        Matcher m = ROTULO_DE_ALUNO.matcher(t);
        if (m.matches()) {
            return alunoDoTitulo(t);
        }
        for (Pattern p : List.of(GENERICO_ANTES, GENERICO_DEPOIS)) {
            m = p.matcher(t);
            if (m.matches() && pareceNomeDePessoa(m.group(1))) {
                return Optional.of(m.group(1).strip());
            }
        }
        return pareceNomeDePessoa(t) ? Optional.of(t) : Optional.empty();
    }

    /**
     * Parece nome de pessoa: só letras (e espaço, apóstrofo, ponto e hífen), de 1 a 8 palavras, ao menos uma com duas
     * letras ou mais e nenhuma palavra genérica ({@link #GENERICAS}).
     */
    static boolean pareceNomeDePessoa(String texto) {
        if (texto == null) {
            return false;
        }
        String t = texto.strip();
        if (t.isEmpty() || t.length() > NOME_MAXIMO || !SO_LETRAS.matcher(t).matches()) {
            return false;
        }
        List<String> palavras = Normalizacao.palavras(t);
        if (palavras.isEmpty() || palavras.size() > PALAVRAS_DO_NOME || palavras.stream().noneMatch(p -> p.length() >= 2)) {
            return false;
        }
        return palavras.stream().map(p -> p.toLowerCase(Locale.ROOT)).noneMatch(GENERICAS::contains);
    }
}
