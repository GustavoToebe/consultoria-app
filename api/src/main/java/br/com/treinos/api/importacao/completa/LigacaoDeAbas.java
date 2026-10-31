package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Reconhecimento;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Liga as abas entre si por regras fixas: a coluna de uma aba (a "filha", ex.: "ID Aluno" de Pesos) cujos valores
 * aparecem numa coluna de outra (a "mãe", ex.: a primeira coluna de Alunos). A coluna da mãe é descoberta pelo
 * conteúdo: a que contém mais valores da filha (código comparado sem caixa e sem espaços nas pontas), preferindo a
 * coluna de código da mãe. Sem código que ligue, liga pelo nome do aluno normalizado (sem acento, espaços colapsados,
 * sem caixa); nome que aparece duas vezes na mãe não liga nada e vira pergunta ({@code ambiguas}), e valor que não está
 * na mãe vira {@code naoLigadas}. Código repetido na mãe liga à primeira linha dele, como no {@code planilha-lib.mjs}
 * (a repetição já é problema da própria mãe). Só números de linha saem daqui, nunca os valores.
 */
public final class LigacaoDeAbas {

    /** Fração mínima dos valores distintos da filha que precisam estar na coluna da mãe. */
    static final double COBERTURA_MINIMA = 0.5;

    public enum Por { CODIGO, NOME }

    /** Uma aba já reconhecida, com as linhas de dados (sem o cabeçalho). */
    public record AbaReconhecida(int indice, String nome, Reconhecimento reconhecimento, List<Linha> dados) {
        TipoDeAba tipo() {
            return reconhecimento.tipo();
        }
    }

    /**
     * {@code ligadas}, {@code naoLigadas} e {@code ambiguas} são números de linha da filha (no arquivo); linha com a
     * coluna vazia não entra em nenhuma.
     */
    public record Ligacao(int filha, int colunaFilha, int mae, int colunaMae, Por por, List<Integer> ligadas,
                          List<Integer> naoLigadas, List<Integer> ambiguas) {
    }

    private LigacaoDeAbas() {
    }

    /**
     * As ligações esperadas entre as abas reconhecidas: pesos, rotinas, planos de dieta (e treino, dieta e suplementos sem
     * rotina ou plano) ao aluno; treino à rotina; dieta e suplementos ao plano de dieta. Usa a primeira aba de cada tipo
     * como mãe. Aba sem a mãe ou sem coluna que ligue fica sem ligação.
     */
    public static List<Ligacao> ligarTodas(List<AbaReconhecida> abas) {
        Optional<AbaReconhecida> alunos = primeira(abas, TipoDeAba.ALUNOS);
        Optional<AbaReconhecida> rotinas = primeira(abas, TipoDeAba.ROTINAS);
        Optional<AbaReconhecida> planos = primeira(abas, TipoDeAba.PLANOS_DE_DIETA);
        List<Ligacao> saida = new ArrayList<>();
        for (AbaReconhecida aba : abas) {
            Reconhecimento r = aba.reconhecimento();
            Optional<Ligacao> ligacao = switch (aba.tipo()) {
                case PESOS, ROTINAS, PLANOS_DE_DIETA -> alunos.flatMap(m -> aoAluno(aba, m));
                case TREINO -> r.tem(Campo.ROTINA_CODIGO) && rotinas.isPresent()
                        ? porCodigo(aba, r.coluna(Campo.ROTINA_CODIGO), rotinas.get())
                        : alunos.flatMap(m -> aoAluno(aba, m));
                case DIETA, SUPLEMENTOS -> r.tem(Campo.PLANO_CODIGO) && planos.isPresent()
                        ? porCodigo(aba, r.coluna(Campo.PLANO_CODIGO), planos.get())
                        : alunos.flatMap(m -> aoAluno(aba, m));
                default -> Optional.empty();
            };
            ligacao.ifPresent(saida::add);
        }
        return saida;
    }

    /** Liga ao aluno: pelo código do aluno se há e ele aparece na mãe; senão, pelo nome. */
    static Optional<Ligacao> aoAluno(AbaReconhecida filha, AbaReconhecida alunos) {
        Reconhecimento r = filha.reconhecimento();
        if (r.tem(Campo.ALUNO_CODIGO)) {
            Optional<Ligacao> codigo = porCodigo(filha, r.coluna(Campo.ALUNO_CODIGO), alunos);
            if (codigo.isPresent()) {
                return codigo;
            }
        }
        int nomeMae = alunos.reconhecimento().coluna(Campo.ALUNO);
        if (r.tem(Campo.ALUNO) && nomeMae >= 0) {
            return Optional.of(porNome(filha, r.coluna(Campo.ALUNO), alunos, nomeMae));
        }
        return Optional.empty();
    }

    /** Liga a coluna da filha à coluna da mãe que melhor a contém ({@link #colunaChave}); vazio se nenhuma alcança o mínimo. */
    static Optional<Ligacao> porCodigo(AbaReconhecida filha, int colunaFilha, AbaReconhecida mae) {
        List<String> valores = new ArrayList<>();
        for (Linha l : filha.dados()) {
            String v = codigo(celula(l, colunaFilha));
            if (!v.isEmpty()) {
                valores.add(v);
            }
        }
        int preferida = mae.reconhecimento().coluna(Campo.CODIGO);
        return colunaChave(mae.dados(), valores, preferida)
                .map(colunaMae -> ligar(filha, colunaFilha, mae, colunaMae, Por.CODIGO, LigacaoDeAbas::codigo));
    }

    /** Liga pelo nome normalizado; nome repetido na mãe vira pergunta. */
    static Ligacao porNome(AbaReconhecida filha, int colunaFilha, AbaReconhecida mae, int colunaMae) {
        return ligar(filha, colunaFilha, mae, colunaMae, Por.NOME, c -> Normalizacao.chaveDoNome(texto(c)));
    }

    /**
     * A coluna da mãe que contém a maior fração dos valores distintos da filha, desde que chegue a
     * {@link #COBERTURA_MINIMA}. Empate: a {@code preferida} (a coluna de código da mãe), depois a mais à esquerda.
     */
    public static Optional<Integer> colunaChave(List<Linha> dadosDaMae, List<String> valoresDaFilha, int preferida) {
        Set<String> procurados = new LinkedHashSet<>();
        for (String v : valoresDaFilha) {
            String c = codigo(v);
            if (!c.isEmpty()) {
                procurados.add(c);
            }
        }
        if (procurados.isEmpty()) {
            return Optional.empty();
        }
        int largura = dadosDaMae.stream().mapToInt(l -> l.celulas().size()).max().orElse(0);
        int melhor = -1;
        double cobertura = 0;
        for (int col = 0; col < largura; col++) {
            Set<String> daMae = new HashSet<>();
            for (Linha l : dadosDaMae) {
                String v = codigo(celula(l, col));
                if (!v.isEmpty()) {
                    daMae.add(v);
                }
            }
            long achados = procurados.stream().filter(daMae::contains).count();
            double esta = (double) achados / procurados.size();
            boolean ganha = esta > cobertura || (esta == cobertura && esta > 0 && col == preferida);
            if (ganha) {
                melhor = col;
                cobertura = esta;
            }
        }
        return melhor >= 0 && cobertura >= COBERTURA_MINIMA ? Optional.of(melhor) : Optional.empty();
    }

    private interface Chave {
        String de(Celula c);
    }

    private static Ligacao ligar(AbaReconhecida filha, int colunaFilha, AbaReconhecida mae, int colunaMae, Por por, Chave chave) {
        Map<String, Integer> vezesNaMae = new HashMap<>();
        for (Linha l : mae.dados()) {
            String v = chave.de(celula(l, colunaMae));
            if (!v.isEmpty()) {
                vezesNaMae.merge(v, 1, Integer::sum);
            }
        }
        List<Integer> ligadas = new ArrayList<>();
        List<Integer> naoLigadas = new ArrayList<>();
        List<Integer> ambiguas = new ArrayList<>();
        for (Linha l : filha.dados()) {
            String v = chave.de(celula(l, colunaFilha));
            if (v.isEmpty()) {
                continue;
            }
            int vezes = vezesNaMae.getOrDefault(v, 0);
            if (vezes == 0) {
                naoLigadas.add(l.numero());
            } else if (vezes > 1 && por == Por.NOME) {
                ambiguas.add(l.numero());
            } else {
                ligadas.add(l.numero());
            }
        }
        return new Ligacao(filha.indice(), colunaFilha, mae.indice(), colunaMae, por, List.copyOf(ligadas),
                List.copyOf(naoLigadas), List.copyOf(ambiguas));
    }

    private static Optional<AbaReconhecida> primeira(List<AbaReconhecida> abas, TipoDeAba tipo) {
        return abas.stream().filter(a -> a.tipo() == tipo).findFirst();
    }

    static Celula celula(Linha l, int coluna) {
        return coluna >= 0 && coluna < l.celulas().size() ? l.celulas().get(coluna) : null;
    }

    private static String texto(Celula c) {
        return c == null || c.erro() ? "" : c.texto();
    }

    private static String codigo(Celula c) {
        return codigo(texto(c));
    }

    private static String codigo(String v) {
        return v == null ? "" : v.strip().toLowerCase(Locale.ROOT);
    }
}
