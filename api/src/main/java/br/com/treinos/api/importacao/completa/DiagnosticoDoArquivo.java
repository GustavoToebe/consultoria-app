package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.completa.LeituraDasAbas.AbaLida;
import br.com.treinos.api.importacao.completa.LeituraDasAbas.Leitura;
import br.com.treinos.api.importacao.completa.LigacaoDeAbas.AbaReconhecida;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Reconhecimento;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Diagnóstico do arquivo antes de importar (migração assistida, fase 1): regra pura sobre as abas já lidas, sem banco, sem
 * relógio e sem gravar nada. Só regras fixas: o tipo de cada aba vem do {@link ReconhecimentoDeAbas} que a planilha completa
 * já usa. <b>A resposta nunca leva valor de célula</b>: só contagens, códigos de problema e nomes de aba e de coluna, e o nome
 * de coluna só sai quando o cabeçalho foi achado por duas ou mais colunas conhecidas e a célula parece nome de coluna (senão é
 * "Coluna X", para não devolver como "coluna" a primeira linha de dados de um arquivo sem cabeçalho).
 */
public final class DiagnosticoDoArquivo {

    /** O que o arquivo parece ser, pelas abas reconhecidas. */
    public enum TipoDoArquivo { CADASTRO_DE_ALUNOS, PLANILHA_COMPLETA, TREINO, DIETA, OUTRO, DESCONHECIDO }

    /** Vagas que sobram para aluno novo; {@code null} = sem limite. Pode ser negativo (quem já passou do limite): conta como zero. */
    public record Vagas(Long plano, Long importador) {
    }

    /** {@code campo} = nome do {@link Campo} reconhecido, ou nulo. {@code nome} nulo = o app mostra "Coluna X". */
    public record Coluna(String letra, String nome, String campo) {
    }

    public record Problema(String codigo, int quantidade) {
    }

    public record DaAba(int indice, String nome, TipoDeAba tipo, int linhas, int linhasVazias, int linhasSemNome,
                        int emailsInvalidos, int emailsDuplicados, int datasInvalidas, int celulasComErro,
                        List<Coluna> colunas, List<Problema> problemas) {
    }

    public record Diagnostico(TipoDoArquivo tipo, int linhas, List<DaAba> abas, List<Problema> problemas) {
    }

    static final int NOME_DE_COLUNA_MAXIMO = 60;

    private DiagnosticoDoArquivo() {
    }

    public static Diagnostico diagnosticar(Leitura leitura, Vagas vagas) {
        List<AbaReconhecida> reconhecidas = AnaliseDaPlanilha.reconhecerAbas(leitura, Map.of());
        List<DaAba> abas = new ArrayList<>();
        Map<String, Integer> geral = new LinkedHashMap<>();
        int total = 0;
        int candidatos = 0;
        for (AbaReconhecida aba : reconhecidas) {
            DaAba da = daAba(aba, leitura.abas().get(aba.indice()), leitura.data1904());
            abas.add(da);
            total += da.linhas();
            if (da.tipo() == TipoDeAba.ALUNOS) {
                candidatos = Math.max(candidatos, da.linhas() - da.linhasSemNome());
            }
            da.problemas().forEach(p -> geral.merge(p.codigo(), p.quantidade(), Integer::sum));
        }
        if (total == 0) {
            geral.put("ARQUIVO_SEM_DADOS", 1);
        }
        excesso(geral, "ACIMA_DO_LIMITE_DO_PLANO", candidatos, vagas.plano());
        excesso(geral, "ACIMA_DO_LIMITE_DO_TREINADOR", candidatos, vagas.importador());
        List<Problema> problemas = geral.entrySet().stream().map(e -> new Problema(e.getKey(), e.getValue())).toList();
        return new Diagnostico(tipoDoArquivo(abas), total, List.copyOf(abas), problemas);
    }

    private static void excesso(Map<String, Integer> problemas, String codigo, int candidatos, Long vagas) {
        if (vagas != null && candidatos > Math.max(0, vagas)) {
            problemas.put(codigo, (int) (candidatos - Math.max(0, vagas)));
        }
    }

    /** Duas ou mais famílias (alunos, pesos, treino, dieta) são uma planilha completa; uma só dá o tipo dela. */
    static TipoDoArquivo tipoDoArquivo(List<DaAba> abas) {
        Set<String> familias = new TreeSet<>();
        boolean algumaReconhecida = false;
        for (DaAba a : abas) {
            algumaReconhecida |= a.tipo() != TipoDeAba.DESCONHECIDA;
            switch (a.tipo()) {
                case ALUNOS -> familias.add("ALUNOS");
                case PESOS -> familias.add("PESOS");
                case TREINO, ROTINAS -> familias.add("TREINO");
                case DIETA, PLANOS_DE_DIETA, SUPLEMENTOS -> familias.add("DIETA");
                default -> { }
            }
        }
        if (familias.size() >= 2) {
            return TipoDoArquivo.PLANILHA_COMPLETA;
        }
        if (familias.size() == 1) {
            return switch (familias.iterator().next()) {
                case "ALUNOS" -> TipoDoArquivo.CADASTRO_DE_ALUNOS;
                case "TREINO" -> TipoDoArquivo.TREINO;
                case "DIETA" -> TipoDoArquivo.DIETA;
                default -> TipoDoArquivo.OUTRO;
            };
        }
        return algumaReconhecida ? TipoDoArquivo.OUTRO : TipoDoArquivo.DESCONHECIDO;
    }

    private static DaAba daAba(AbaReconhecida aba, AbaLida lida, boolean data1904) {
        int linhas = 0;
        int semNome = 0;
        int emailsInvalidos = 0;
        int emailsDuplicados = 0;
        int datasInvalidas = 0;
        int comErro = 0;
        int cabecalhoComDado = 0;
        int dadoAcima = 0;
        boolean semCabecalho = false;
        List<Coluna> colunas = null;
        for (AbaReconhecida parte : aba.partes()) {
            Reconhecimento r = parte.reconhecimento();
            if (colunas == null) {
                colunas = colunas(r, lida.linhas());
            }
            semCabecalho |= r.posicaoDoCabecalho() < 0;
            for (ReconhecimentoDeAbas.Aviso av : r.avisos()) {
                if ("TITULO_COM_CARA_DE_DADO".equals(av.codigo())) {
                    cabecalhoComDado++;
                } else {
                    dadoAcima++;
                }
            }
            boolean deAlunos = r.tipo() == TipoDeAba.ALUNOS;
            int cNome = r.coluna(Campo.ALUNO);
            int cEmail = r.coluna(Campo.EMAIL);
            int[] cDatas = {r.coluna(Campo.DATA), r.coluna(Campo.DATA_INICIO)};
            Set<String> emails = new HashSet<>();
            for (Linha l : parte.dados()) {
                linhas++;
                for (Celula c : l.celulas()) {
                    if (c.erro()) {
                        comErro++;
                    }
                }
                if (deAlunos && cNome >= 0 && AnaliseDaPlanilha.texto(l, cNome).isEmpty()) {
                    semNome++;
                }
                String email = AnaliseDaPlanilha.texto(l, cEmail).toLowerCase(Locale.ROOT);
                if (cEmail >= 0 && !email.isEmpty() && !AnaliseDaPlanilha.SEM_EMAIL.contains(email)) {
                    if (!AnaliseDaPlanilha.EMAIL.matcher(email).matches() || email.length() > 254) {
                        emailsInvalidos++;
                    } else if (!emails.add(email)) {
                        emailsDuplicados++;
                    }
                }
                for (int c : cDatas) {
                    Celula data = LigacaoDeAbas.celula(l, c);
                    if (c >= 0 && !ReconhecimentoDeAbas.vazia(data) && !data.erro() && AnaliseDaPlanilha.data(data, data1904) == null) {
                        datasInvalidas++;
                    }
                }
            }
        }
        Reconhecimento primeiro = aba.reconhecimento();
        int vazias = 0;
        for (Linha l : lida.linhas().subList(Math.max(0, primeiro.posicaoDoCabecalho() + 1), lida.linhas().size())) {
            if (AnaliseDaPlanilha.emBranco(l)) {
                vazias++;
            }
        }
        List<Coluna> lista = colunas == null ? List.of() : colunas;
        int naoReconhecidas = (int) lista.stream().filter(c -> c.campo() == null).count();
        TipoDeAba tipo = primeiro.tipo();
        Map<String, Integer> p = new LinkedHashMap<>();
        if (tipo == TipoDeAba.DESCONHECIDA) {
            p.put("ABA_NAO_RECONHECIDA", 1);
        } else {
            p.put("COLUNA_NAO_RECONHECIDA", naoReconhecidas);
        }
        if (tipo == TipoDeAba.TABELA_DE_ALIMENTOS) {
            p.put("ABA_SEM_USO", 1);
        }
        p.put("ABA_SEM_DADOS", linhas == 0 ? 1 : 0);
        p.put("CABECALHO_NAO_ENCONTRADO", linhas > 0 && semCabecalho ? 1 : 0);
        p.put("CABECALHO_COM_CARA_DE_DADO", cabecalhoComDado);
        p.put("DADO_ACIMA_DO_CABECALHO", dadoAcima);
        p.put("LINHA_SEM_NOME", semNome);
        p.put("EMAIL_INVALIDO", emailsInvalidos);
        p.put("EMAIL_DUPLICADO", emailsDuplicados);
        p.put("DATA_INVALIDA", datasInvalidas);
        p.put("CELULA_COM_ERRO_DE_FORMULA", comErro);
        List<Problema> problemas = p.entrySet().stream().filter(e -> e.getValue() > 0)
                .map(e -> new Problema(e.getKey(), e.getValue())).toList();
        return new DaAba(aba.indice(), aba.nome(), tipo, linhas, vazias, semNome, emailsInvalidos, emailsDuplicados,
                datasInvalidas, comErro, lista, problemas);
    }

    /** Colunas com cabeçalho preenchido ou campo reconhecido pelo conteúdo, na ordem da planilha. */
    private static List<Coluna> colunas(Reconhecimento r, List<Linha> linhasDaAba) {
        Linha cabecalho = linhasDaAba.stream().filter(l -> r.linhaDoCabecalho() > 0 && l.numero() == r.linhaDoCabecalho())
                .findFirst().orElse(null);
        List<Celula> celulas = cabecalho == null ? List.of() : cabecalho.celulas();
        long conhecidas = celulas.stream().filter(c -> ReconhecimentoDeAbas.pareceNomeDeColuna(c)
                && ReconhecimentoDeAbas.campoDoNome(c.texto()).isPresent()).count();
        boolean nomesVisiveis = conhecidas >= 2;
        Map<Integer, Campo> campos = new LinkedHashMap<>();
        r.campos().forEach((campo, coluna) -> campos.put(coluna, campo));
        Set<Integer> posicoes = new TreeSet<>(campos.keySet());
        for (int i = 0; i < celulas.size(); i++) {
            if (!ReconhecimentoDeAbas.vazia(celulas.get(i))) {
                posicoes.add(i);
            }
        }
        List<Coluna> colunas = new ArrayList<>();
        for (int i : posicoes) {
            Celula c = i < celulas.size() ? celulas.get(i) : null;
            String nome = nomesVisiveis && ReconhecimentoDeAbas.pareceNomeDeColuna(c) ? c.texto().strip() : null;
            Campo campo = campos.get(i);
            colunas.add(new Coluna(LeitorDePlanilha.letra(i), nome, campo == null ? null : campo.name()));
        }
        return List.copyOf(colunas);
    }
}
