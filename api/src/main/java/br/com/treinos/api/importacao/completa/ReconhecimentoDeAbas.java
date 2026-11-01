package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Diz o que uma aba guarda ({@link TipoDeAba}) e qual coluna é cada {@link Campo}, só por regras fixas: os nomes das
 * colunas (sinônimos sem acento e sem caixa) e, onde o nome não diz, o formato do conteúdo (e-mail, telefone, data,
 * "4x10", "30 kg"). Nada aqui adivinha valor: coluna que nenhuma regra reconhece fica sem campo.
 *
 * <p>O cabeçalho é procurado nas primeiras {@value #LINHAS_PROCURADAS} linhas (pode haver título acima): a primeira com
 * duas ou mais colunas reconhecidas pelos sinônimos; sem nenhuma, a primeira com dois ou mais textos que pareçam nome de
 * coluna. Célula do cabeçalho que tem cara de dado (código, número, data, e-mail, telefone) vira aviso
 * {@code TITULO_COM_CARA_DE_DADO}: na planilha do primeiro treinador a primeira célula do cabeçalho às vezes guarda um
 * código ("ALU000") no lugar de "ID", e essa coluna é tratada como o código da linha, como no {@code planilha-lib.mjs}.
 */
public final class ReconhecimentoDeAbas {

    static final int LINHAS_PROCURADAS = 10;
    /** Linhas de dados olhadas para decidir o formato de uma coluna. */
    private static final int AMOSTRA_DO_CONTEUDO = 200;
    private static final Set<String> SEM_SENTIDO = Set.of("de", "do", "da", "dos", "das", "e", "o", "a", "em", "no", "na");
    private static final Set<String> PALAVRAS_DE_CODIGO = Set.of("id", "cod", "codigo");

    public record Aviso(String codigo, int linha, int coluna) {
    }

    /**
     * {@code linhaDoCabecalho} = número da linha no arquivo (0 = sem cabeçalho); {@code posicaoDoCabecalho} = índice na
     * lista de linhas lidas (-1 = sem cabeçalho). {@code campos} = coluna (0 = A) de cada campo reconhecido.
     */
    public record Reconhecimento(TipoDeAba tipo, int linhaDoCabecalho, int posicaoDoCabecalho, Map<Campo, Integer> campos,
                                 List<Aviso> avisos) {

        public boolean tem(Campo campo) {
            return campos.containsKey(campo);
        }

        /** Coluna do campo ou -1. */
        public int coluna(Campo campo) {
            Integer c = campos.get(campo);
            return c == null ? -1 : c;
        }
    }

    private ReconhecimentoDeAbas() {
    }

    public static Reconhecimento reconhecer(List<Linha> linhas) {
        int posicao = posicaoDoCabecalho(linhas);
        Map<Campo, Integer> campos = new EnumMap<>(Campo.class);
        List<Aviso> avisos = new ArrayList<>();
        if (posicao >= 0) {
            Linha cabecalho = linhas.get(posicao);
            List<Celula> celulas = cabecalho.celulas();
            int primeira = -1;
            for (int i = 0; i < celulas.size(); i++) {
                Celula c = celulas.get(i);
                if (vazia(c)) {
                    continue;
                }
                if (primeira < 0) {
                    primeira = i;
                }
                if (!c.numero()) {
                    Optional<Campo> campo = campoDoNome(c.texto());
                    if (campo.isPresent() && !campos.containsKey(campo.get())) {
                        campos.put(campo.get(), i);
                    }
                }
                if (FormatoDoConteudo.de(c).dado()) {
                    avisos.add(new Aviso("TITULO_COM_CARA_DE_DADO", cabecalho.numero(), i));
                }
            }
            if (primeira >= 0 && !campos.containsKey(Campo.CODIGO) && !campos.containsValue(primeira)
                    && FormatoDoConteudo.de(celulas.get(primeira)).dado()) {
                // Código no lugar do título "ID" (ver o javadoc da classe).
                campos.put(Campo.CODIGO, primeira);
            }
            for (int l = 0; l < posicao; l++) {
                Linha acima = linhas.get(l);
                for (int i = 0; i < acima.celulas().size(); i++) {
                    FormatoDoConteudo f = FormatoDoConteudo.de(acima.celulas().get(i));
                    if (f.dado()) {
                        avisos.add(new Aviso("DADO_ACIMA_DO_CABECALHO", acima.numero(), i));
                        break;
                    }
                }
            }
        }
        List<Linha> dados = linhas.subList(posicao + 1, linhas.size());
        completarPeloConteudo(dados, campos, posicao < 0);
        int numero = posicao < 0 ? 0 : linhas.get(posicao).numero();
        return new Reconhecimento(tipo(campos), numero, posicao, Collections.unmodifiableMap(campos), List.copyOf(avisos));
    }

    /** O tipo pelos campos reconhecidos; a ordem das regras vai do mais específico ao mais genérico. */
    static TipoDeAba tipo(Map<Campo, Integer> campos) {
        Set<Campo> c = campos.isEmpty() ? EnumSet.noneOf(Campo.class) : EnumSet.copyOf(campos.keySet());
        boolean aluno = c.contains(Campo.ALUNO) || c.contains(Campo.ALUNO_CODIGO);
        boolean prescricao = c.contains(Campo.SERIES) || c.contains(Campo.REPETICOES) || c.contains(Campo.PRESCRICAO)
                || c.contains(Campo.CARGA) || c.contains(Campo.SERIES_TRABALHO) || c.contains(Campo.SERIES_PREPARACAO)
                || c.contains(Campo.DESCANSO);
        boolean nutrientes = c.contains(Campo.KCAL) || c.contains(Campo.PROTEINA) || c.contains(Campo.CARBOIDRATO)
                || c.contains(Campo.GORDURA);
        if (c.contains(Campo.SUPLEMENTO) && (c.contains(Campo.DOSE) || c.contains(Campo.HORARIO))) {
            return TipoDeAba.SUPLEMENTOS;
        }
        if (c.contains(Campo.PESO) && c.contains(Campo.DATA) && aluno) {
            return TipoDeAba.PESOS;
        }
        if (c.contains(Campo.EXERCICIO)) {
            boolean doTreino = prescricao || aluno || c.contains(Campo.ROTINA_CODIGO) || c.contains(Campo.LETRA_TREINO)
                    || c.contains(Campo.NOME_TREINO);
            return doTreino ? TipoDeAba.TREINO : TipoDeAba.LISTA_DE_EXERCICIOS;
        }
        if (c.contains(Campo.ROTINA_CODIGO) && aluno) {
            return TipoDeAba.ROTINAS;
        }
        if (c.contains(Campo.ALIMENTO)) {
            if (c.contains(Campo.REFEICAO) || c.contains(Campo.PLANO_CODIGO) || c.contains(Campo.OPCAO) || aluno) {
                return TipoDeAba.DIETA;
            }
            if (nutrientes) {
                return TipoDeAba.TABELA_DE_ALIMENTOS;
            }
        }
        if (c.contains(Campo.PLANO_CODIGO) && aluno) {
            return TipoDeAba.PLANOS_DE_DIETA;
        }
        if (c.contains(Campo.ALUNO) && (c.contains(Campo.EMAIL) || c.contains(Campo.TELEFONE) || c.contains(Campo.OBJETIVO)
                || c.contains(Campo.STATUS) || c.contains(Campo.DATA_INICIO) || c.contains(Campo.PESO_INICIAL)
                || c.contains(Campo.CODIGO))) {
            return TipoDeAba.ALUNOS;
        }
        return TipoDeAba.DESCONHECIDA;
    }

    /**
     * O campo de um nome de coluna. Coluna de código: começa por "id", "cod" ou "código" (ou termina em "id"), e o resto
     * diz de quem é o código (aluno, plano ou rotina); sem dono, é o código da própria linha. Os demais, pelo sinônimo
     * mais longo contido no nome (nome exatamente igual ao sinônimo ganha um pouco mais); empate, a ordem de {@link Campo}.
     */
    public static Optional<Campo> campoDoNome(String nome) {
        List<String> p = new ArrayList<>(Normalizacao.palavras(nome));
        p.removeIf(SEM_SENTIDO::contains);
        if (p.isEmpty()) {
            return Optional.empty();
        }
        boolean codigoNoComeco = PALAVRAS_DE_CODIGO.contains(p.getFirst());
        if (codigoNoComeco || (p.size() > 1 && "id".equals(p.getLast()))) {
            List<String> resto = codigoNoComeco ? p.subList(1, p.size()) : p.subList(0, p.size() - 1);
            if (resto.stream().anyMatch(Set.of("aluno", "alunos", "cliente", "paciente", "atleta")::contains)) {
                return Optional.of(Campo.ALUNO_CODIGO);
            }
            if (resto.stream().anyMatch(Set.of("plano", "dieta")::contains)) {
                return Optional.of(Campo.PLANO_CODIGO);
            }
            if (resto.stream().anyMatch(Set.of("rotina", "treino", "ficha")::contains)) {
                return Optional.of(Campo.ROTINA_CODIGO);
            }
            return Optional.of(Campo.CODIGO);
        }
        Campo melhor = null;
        int pontos = 0;
        for (Campo campo : Campo.values()) {
            for (List<String> s : campo.sinonimos()) {
                if (contemEmSequencia(p, s)) {
                    int esses = s.size() * 10 + (p.equals(s) ? 5 : 0);
                    if (esses > pontos) {
                        pontos = esses;
                        melhor = campo;
                    }
                }
            }
        }
        return Optional.ofNullable(melhor);
    }

    /**
     * Índice da linha do cabeçalho nas primeiras {@value #LINHAS_PROCURADAS} linhas, ou -1. Primeiro a que tem duas ou
     * mais colunas reconhecidas pelos sinônimos; sem ela, a primeira com dois ou mais textos que pareçam nome de coluna.
     */
    public static int posicaoDoCabecalho(List<Linha> linhas) {
        int limite = Math.min(LINHAS_PROCURADAS, linhas.size());
        for (int l = 0; l < limite; l++) {
            int reconhecidas = 0;
            for (Celula c : linhas.get(l).celulas()) {
                if (pareceNomeDeColuna(c) && campoDoNome(c.texto()).isPresent()) {
                    reconhecidas++;
                }
            }
            if (reconhecidas >= 2) {
                return l;
            }
        }
        for (int l = 0; l < limite; l++) {
            int textos = 0;
            for (Celula c : linhas.get(l).celulas()) {
                if (pareceNomeDeColuna(c)) {
                    textos++;
                }
            }
            if (textos >= 2) {
                return l;
            }
        }
        return -1;
    }

    /** Texto curto, com letra, que não tem cara de dado (e-mail, telefone, data, código, número). */
    static boolean pareceNomeDeColuna(Celula c) {
        if (c == null || c.numero() || c.erro()) {
            return false;
        }
        String t = c.texto().strip();
        if (t.isEmpty() || t.length() > 60 || t.chars().noneMatch(Character::isLetter)) {
            return false;
        }
        return FormatoDoConteudo.de(t) == FormatoDoConteudo.TEXTO && Normalizacao.palavras(t).size() <= 6;
    }

    /**
     * Coluna sem campo pelo nome ganha o campo pelo formato que domina o conteúdo (60% das células preenchidas):
     * e-mail, telefone, prescrição, carga ou data escrita. Sem cabeçalho nenhum, também os campos que dão o tipo da aba:
     * o primeiro texto vira o exercício (se há prescrição) ou o aluno (se há e-mail ou telefone), e uma coluna de datas do
     * Excel com uma de pesos (20 a 400) faz a aba de pesos.
     */
    private static void completarPeloConteudo(List<Linha> dados, Map<Campo, Integer> campos, boolean semCabecalho) {
        int largura = dados.stream().limit(AMOSTRA_DO_CONTEUDO).mapToInt(l -> l.celulas().size()).max().orElse(0);
        List<Integer> textos = new ArrayList<>();
        int datasDoExcel = -1;
        int pesos = -1;
        for (int col = 0; col < largura; col++) {
            if (campos.containsValue(col)) {
                continue;
            }
            FormatoDoConteudo f = dominante(dados, col);
            Campo pelo = f == null ? null : switch (f) {
                case EMAIL -> Campo.EMAIL;
                case TELEFONE -> Campo.TELEFONE;
                case PRESCRICAO -> Campo.PRESCRICAO;
                case CARGA -> Campo.CARGA;
                case DATA -> Campo.DATA;
                default -> null;
            };
            if (pelo != null && !campos.containsKey(pelo)) {
                campos.put(pelo, col);
                continue;
            }
            if (f == FormatoDoConteudo.TEXTO) {
                textos.add(col);
            } else if (f == FormatoDoConteudo.NUMERO && semCabecalho) {
                if (datasDoExcel < 0 && maioria(dados, col, FormatoDoConteudo::serialDeData)) {
                    datasDoExcel = col;
                } else if (pesos < 0 && maioria(dados, col, ReconhecimentoDeAbas::pareceComPeso)) {
                    pesos = col;
                }
            }
        }
        if (!semCabecalho || textos.isEmpty()) {
            return;
        }
        int primeiroTexto = textos.getFirst();
        if (campos.containsKey(Campo.PRESCRICAO) || campos.containsKey(Campo.CARGA)) {
            campos.putIfAbsent(Campo.EXERCICIO, primeiroTexto);
        } else if (campos.containsKey(Campo.EMAIL) || campos.containsKey(Campo.TELEFONE)) {
            campos.putIfAbsent(Campo.ALUNO, primeiroTexto);
        } else if (datasDoExcel >= 0 && pesos >= 0) {
            campos.putIfAbsent(Campo.ALUNO, primeiroTexto);
            campos.putIfAbsent(Campo.DATA, datasDoExcel);
            campos.putIfAbsent(Campo.PESO, pesos);
        }
    }

    private static boolean pareceComPeso(Celula c) {
        try {
            BigDecimal n = new BigDecimal(c.texto());
            return n.compareTo(BigDecimal.valueOf(20)) >= 0 && n.compareTo(BigDecimal.valueOf(400)) <= 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static boolean maioria(List<Linha> dados, int col, java.util.function.Predicate<Celula> teste) {
        int preenchidas = 0;
        int certas = 0;
        for (Linha l : dados.subList(0, Math.min(AMOSTRA_DO_CONTEUDO, dados.size()))) {
            Celula c = col < l.celulas().size() ? l.celulas().get(col) : null;
            if (vazia(c)) {
                continue;
            }
            preenchidas++;
            if (teste.test(c)) {
                certas++;
            }
        }
        return preenchidas > 0 && certas * 10 >= preenchidas * 6;
    }

    /** O formato de 60% ou mais das células preenchidas da coluna, ou null. */
    static FormatoDoConteudo dominante(List<Linha> dados, int col) {
        Map<FormatoDoConteudo, Integer> contagem = new EnumMap<>(FormatoDoConteudo.class);
        int preenchidas = 0;
        for (Linha l : dados.subList(0, Math.min(AMOSTRA_DO_CONTEUDO, dados.size()))) {
            Celula c = col < l.celulas().size() ? l.celulas().get(col) : null;
            if (vazia(c)) {
                continue;
            }
            preenchidas++;
            contagem.merge(FormatoDoConteudo.de(c), 1, Integer::sum);
        }
        for (Map.Entry<FormatoDoConteudo, Integer> e : contagem.entrySet()) {
            if (e.getValue() * 10 >= preenchidas * 6) {
                return e.getKey();
            }
        }
        return null;
    }

    static boolean vazia(Celula c) {
        return c == null || (!c.erro() && c.texto().isBlank());
    }

    private static boolean contemEmSequencia(List<String> palavras, List<String> trecho) {
        if (trecho.isEmpty() || trecho.size() > palavras.size()) {
            return false;
        }
        for (int i = 0; i + trecho.size() <= palavras.size(); i++) {
            if (palavras.subList(i, i + trecho.size()).equals(trecho)) {
                return true;
            }
        }
        return false;
    }
}
