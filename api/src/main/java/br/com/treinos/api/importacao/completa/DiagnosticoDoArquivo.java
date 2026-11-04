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
 * já usa. <b>A resposta nunca leva valor de célula</b>: só contagens, códigos de problema e o nome de coluna que é <i>igual</i>
 * a um sinônimo conhecido (qualquer outro texto vira "Coluna X", para não devolver como "coluna" a linha de dados de um
 * arquivo sem cabeçalho que por acaso cita uma palavra conhecida). <b>O nome da aba nunca sai</b>: o app mostra "Aba N" (pela
 * posição) e o tipo reconhecido, porque o nome da aba é texto livre do arquivo e às vezes é o nome de uma pessoa.
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

    public record DaAba(int indice, TipoDeAba tipo, int linhas, int linhasVazias, int linhasSemNome,
                        int emailsInvalidos, int emailsDuplicados, int datasInvalidas, int celulasComErro,
                        List<Coluna> colunas, List<Problema> problemas) {
    }

    public record Diagnostico(TipoDoArquivo tipo, int linhas, List<DaAba> abas, List<Problema> problemas) {
    }

    private DiagnosticoDoArquivo() {
    }

    public static Diagnostico diagnosticar(Leitura leitura, Vagas vagas) {
        List<AbaReconhecida> reconhecidas = AnaliseDaPlanilha.reconhecerAbas(leitura, Map.of());
        List<DaAba> abas = new ArrayList<>();
        Map<String, Integer> geral = new LinkedHashMap<>();
        int total = 0;
        boolean algoImportavel = false;
        for (AbaReconhecida aba : reconhecidas) {
            DaAba da = daAba(aba, leitura.abas().get(aba.indice()), leitura.data1904());
            abas.add(da);
            total += da.linhas();
            algoImportavel |= aba.partes().stream().anyMatch(p -> IMPORTAVEIS.contains(p.tipo()) && !p.dados().isEmpty());
            da.problemas().forEach(p -> geral.merge(p.codigo(), p.quantidade(), Integer::sum));
        }
        if (total == 0) {
            geral.put("ARQUIVO_SEM_DADOS", 1);
        } else if (!algoImportavel) {
            geral.put("NADA_PARA_IMPORTAR", 1);
        }
        long abasDeAlunos = reconhecidas.stream().filter(a -> a.tipo() == TipoDeAba.ALUNOS).count();
        if (abasDeAlunos > 1) {
            geral.put("VARIAS_ABAS_DE_ALUNOS", (int) abasDeAlunos - 1); // só a primeira é lida
        }
        int candidatos = candidatosANovos(reconhecidas);
        excesso(geral, "ACIMA_DO_LIMITE_DO_PLANO", candidatos, vagas.plano());
        excesso(geral, "ACIMA_DO_LIMITE_DO_TREINADOR", candidatos, vagas.importador());
        List<Problema> problemas = geral.entrySet().stream().map(e -> new Problema(e.getKey(), e.getValue())).toList();
        return new Diagnostico(tipoDoArquivo(abas), total, List.copyOf(abas), problemas);
    }

    /** Tipos de aba que a planilha completa grava (a lista de exercícios vai para a biblioteca). */
    private static final Set<TipoDeAba> IMPORTAVEIS = Set.of(TipoDeAba.ALUNOS, TipoDeAba.PESOS, TipoDeAba.TREINO, TipoDeAba.ROTINAS,
            TipoDeAba.DIETA, TipoDeAba.PLANOS_DE_DIETA, TipoDeAba.SUPLEMENTOS, TipoDeAba.LISTA_DE_EXERCICIOS);
    /** Abas em blocos "um aluno por bloco" que a montagem lê (ver {@code linhasPorDono}). */
    private static final Set<TipoDeAba> COM_BLOCO = Set.of(TipoDeAba.PESOS, TipoDeAba.TREINO, TipoDeAba.DIETA, TipoDeAba.SUPLEMENTOS);
    private static final int NOME_DE_ALUNO_MAXIMO = 120;

    /**
     * Teto de alunos novos ativos, como a montagem os reserva: as linhas com nome (e situação ativa) da <b>primeira</b> aba de
     * alunos, mais um por nome de aluno de bloco (treino, dieta, suplemento, peso) que não está nessa aba. Sem comparar com quem
     * já existe na consultoria: quem já existe não gasta vaga, então o número real pode ser menor, nunca maior.
     */
    private static int candidatosANovos(List<AbaReconhecida> reconhecidas) {
        Set<String> daAba = new HashSet<>();
        int candidatos = 0;
        AbaReconhecida alunos = reconhecidas.stream().filter(a -> a.tipo() == TipoDeAba.ALUNOS).findFirst().orElse(null);
        if (alunos != null) {
            Reconhecimento r = alunos.reconhecimento();
            for (Linha l : alunos.dados()) {
                String chave = Normalizacao.chaveDoNome(AnaliseDaPlanilha.texto(l, r.coluna(Campo.ALUNO)));
                if (chave.isEmpty()) {
                    continue;
                }
                daAba.add(chave);
                String situacao = Normalizacao.chaveDoNome(AnaliseDaPlanilha.texto(l, r.coluna(Campo.STATUS)));
                if (situacao.isEmpty() || AnaliseDaPlanilha.ATIVO.matcher(situacao).matches()) {
                    candidatos++;
                }
            }
        }
        Set<String> dosBlocos = new HashSet<>();
        for (AbaReconhecida aba : reconhecidas) {
            if (aba.emTabela()) {
                continue;
            }
            for (AbaReconhecida parte : aba.partes()) {
                FormatoDasAbas.Bloco b = parte.bloco();
                if (b == null || b.aluno() == null || parte.dados().isEmpty() || !COM_BLOCO.contains(parte.tipo())) {
                    continue;
                }
                String nome = b.aluno().replaceAll("\\s+", " ").strip();
                if (!nome.isEmpty() && nome.length() <= NOME_DE_ALUNO_MAXIMO) {
                    String chave = Normalizacao.chaveDoNome(nome);
                    if (!daAba.contains(chave) && dosBlocos.add(chave)) {
                        candidatos++;
                    }
                }
            }
        }
        return candidatos;
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
        int vazias = 0;
        Set<String> emails = new HashSet<>(); // a aba inteira: o mesmo e-mail em duas partes também é repetido
        for (AbaReconhecida parte : aba.partes()) {
            vazias += vaziasDentro(parte, lida.linhas());
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
                // E-mail só conta na aba de alunos: a aba de peso, por exemplo, só o usa para achar o aluno.
                String email = AnaliseDaPlanilha.texto(l, cEmail).toLowerCase(Locale.ROOT);
                if (deAlunos && cEmail >= 0 && !email.isEmpty() && !AnaliseDaPlanilha.SEM_EMAIL.contains(email)) {
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
        return new DaAba(aba.indice(), tipo, linhas, vazias, semNome, emailsInvalidos, emailsDuplicados,
                datasInvalidas, comErro, lista, problemas);
    }

    /**
     * Linhas em branco entre o cabeçalho da parte e a última linha de dados dela. As linhas que separam um bloco do
     * seguinte (e as do fim da aba) não contam: não são linhas que faltam no meio dos dados.
     */
    private static int vaziasDentro(AbaReconhecida parte, List<Linha> linhasDaAba) {
        if (parte.dados().isEmpty()) {
            return 0;
        }
        int depoisDe = parte.reconhecimento().linhaDoCabecalho(); // número no arquivo; 0 = sem cabeçalho
        int antesDe = parte.dados().getLast().numero();
        int vazias = 0;
        for (Linha l : linhasDaAba) {
            if (l.numero() > depoisDe && l.numero() < antesDe && AnaliseDaPlanilha.emBranco(l)) {
                vazias++;
            }
        }
        return vazias;
    }

    /**
     * Sinônimos que também são valores típicos de célula ("Ativo" na coluna de situação, "Medicamento" na de suplemento,
     * "Cliente" na de tipo): o campo continua reconhecido, mas o texto nunca sai como nome de coluna, porque num arquivo sem
     * cabeçalho a linha tomada por cabeçalho pode ser uma linha de dados.
     */
    private static final Set<List<String>> SINONIMOS_QUE_SAO_VALOR = Set.of(List.of("ativo"), List.of("ativa"),
            List.of("vigente"), List.of("remedio"), List.of("medicamento"), List.of("manipulado"), List.of("ergogenico"),
            List.of("cliente"), List.of("paciente"), List.of("atleta"));

    /**
     * O texto, sem acento nem caixa, é exatamente um dos nomes que a importação conhece ("Nome", "E-mail", "Objetivo"…). Só
     * assim o texto da célula pode sair: um texto que apenas <i>contém</i> uma palavra conhecida ("Perder peso", "Maria Ativa")
     * pode ser dado de pessoa numa linha de dados tomada por cabeçalho.
     */
    private static boolean igualAUmSinonimo(String texto) {
        List<String> palavras = Normalizacao.palavras(texto);
        if (SINONIMOS_QUE_SAO_VALOR.contains(palavras)) {
            return false;
        }
        for (Campo campo : Campo.values()) {
            if (campo.sinonimos().contains(palavras)) {
                return true;
            }
        }
        return false;
    }

    /** Colunas com cabeçalho preenchido ou campo reconhecido pelo conteúdo, na ordem da planilha. */
    private static List<Coluna> colunas(Reconhecimento r, List<Linha> linhasDaAba) {
        Linha cabecalho = linhasDaAba.stream().filter(l -> r.linhaDoCabecalho() > 0 && l.numero() == r.linhaDoCabecalho())
                .findFirst().orElse(null);
        List<Celula> celulas = cabecalho == null ? List.of() : cabecalho.celulas();
        // Nome só sai se a linha inteira parece cabeçalho: uma célula com cara de dado (e-mail, data, número…) diz que é
        // uma linha de dados tomada por cabeçalho, e então nenhum texto dela sai.
        boolean linhaDeCabecalho = celulas.stream()
                .allMatch(c -> ReconhecimentoDeAbas.vazia(c) || ReconhecimentoDeAbas.pareceNomeDeColuna(c));
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
            String nome = linhaDeCabecalho && ReconhecimentoDeAbas.pareceNomeDeColuna(c) && igualAUmSinonimo(c.texto())
                    ? c.texto().strip() : null;
            Campo campo = campos.get(i);
            colunas.add(new Coluna(LeitorDePlanilha.letra(i), nome, campo == null ? null : campo.name()));
        }
        return List.copyOf(colunas);
    }
}
