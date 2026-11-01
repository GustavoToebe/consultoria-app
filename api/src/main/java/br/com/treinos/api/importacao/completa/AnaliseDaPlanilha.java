package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.completa.CasamentoDeNomes.Nivel;
import br.com.treinos.api.importacao.completa.CasamentoDeNomes.Resultado;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.ErroDaFaixa;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.Prescricao;
import br.com.treinos.api.importacao.completa.LeituraDasAbas.AbaLida;
import br.com.treinos.api.importacao.completa.LeituraDasAbas.Leitura;
import br.com.treinos.api.importacao.completa.LigacaoDeAbas.AbaReconhecida;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Aba;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Aviso;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Contagem;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Ligacao;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.LinhaAmbigua;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Pergunta;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.PerguntaDeSuplemento;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Problema;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Resumo;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Reconhecimento;

import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Análise da planilha completa, só leitura e sem banco: reconhece cada aba, liga as abas e conta o que seria importado,
 * o que não foi entendido e o que pede confirmação (nomes de exercício e de alimento sem par certo). Os problemas citam
 * aba, linha, campo e tipo, nunca o valor da célula. A tabela de alimentos de terceiros (TACO e parecidas) é reconhecida
 * e contada, mas o conteúdo dela não é usado para nada.
 */
public final class AnaliseDaPlanilha {

    static final int PROBLEMAS_NA_RESPOSTA = 500;
    static final int LINHAS_AMBIGUAS_NA_RESPOSTA = 200;
    static final int PERGUNTAS_NA_RESPOSTA = 300;
    /** Séries por tipo nas colunas de contagem (WS, FS), como o {@code MAX_SERIES_POR_TIPO} do script. */
    private static final int SERIES_POR_TIPO = 10;
    static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    /** Marcadores de "sem e-mail" que valem como célula vazia (os mesmos do {@code planilha-lib.mjs}). */
    static final Set<String> SEM_EMAIL = Set.of("x", "-", "--", "—", ".", "sem", "sem email", "sem e-mail",
            "nao tem", "não tem", "n/a", "na");
    static final Pattern ATIVO = Pattern.compile("^ativ[oa]s?$");
    private static final Pattern PESO_ESCRITO = Pattern.compile("^(\\d{1,3})(?:[.,](\\d{1,2}))?$");
    private static final Pattern DATA_BR = Pattern.compile("^(\\d{1,2})/(\\d{1,2})/(\\d{4})$");
    private static final Pattern DATA_ISO = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");

    private AnaliseDaPlanilha() {
    }

    /** Uma linha de problema e as contagens de todos. */
    private static final class Problemas {
        private final List<Problema> lista = new ArrayList<>();
        private final Map<String, Integer> porTipo = new TreeMap<>();
        private int alem;

        void add(String aba, int linha, Campo campo, String tipo) {
            porTipo.merge(tipo, 1, Integer::sum);
            if (lista.size() < PROBLEMAS_NA_RESPOSTA) {
                lista.add(new Problema(aba, linha, campo == null ? null : campo.name(), tipo));
            } else {
                alem++;
            }
        }
    }

    /** Nome visto na planilha: o primeiro jeito em que apareceu e quantas vezes. */
    private static final class Ocorrencias {
        private final Map<String, String> primeiro = new LinkedHashMap<>();
        private final Map<String, Integer> vezes = new HashMap<>();

        void add(String nome) {
            String limpo = nome.strip().replaceAll("\\s+", " ");
            String k = CasamentoDeNomes.chave(limpo);
            if (k.isEmpty()) {
                return;
            }
            primeiro.putIfAbsent(k, limpo);
            vezes.merge(k, 1, Integer::sum);
        }
    }

    private static final class Contas {
        int alunos;
        int pesos;
        int exercicios;
        int itensDeDieta;
        int suplementos;
        int exerciciosNaLista;
        int prescricoes;
        int naoEntendidas;
        int comSobra;
        int faixasDeData;
        int alunosInativos;
        int pesosIniciais;
        int iniciaisNoHistorico;
        /** Códigos (sem caixa) das linhas de aluno que ficaram fora (sem nome). */
        final Set<String> alunosFora = new HashSet<>();
        /** "código|data" do peso inicial de cada aluno do cadastro. */
        final List<String> iniciais = new ArrayList<>();
        final Set<String> treinos = new HashSet<>();
        final Set<String> refeicoes = new HashSet<>();
    }

    public static Analise analisar(Leitura leitura, Collection<String> exerciciosDaBiblioteca,
                                   Collection<String> alimentosDaBiblioteca, LocalDate hoje) {
        return analisar(leitura, exerciciosDaBiblioteca, alimentosDaBiblioteca, null, List.of(), hoje);
    }

    /**
     * Com {@code suplementosDaBiblioteca} não nulo, a análise lista também os nomes distintos da aba de suplementos com a
     * sugestão de destino (a mesma regra da montagem: ergogênicos da biblioteca primeiro, depois suplementos; sem par,
     * sem sugestão). Nulo = não lista (quem não pode gravar a dieta não vê os nomes de medicação).
     */
    public static Analise analisar(Leitura leitura, Collection<String> exerciciosDaBiblioteca,
                                   Collection<String> alimentosDaBiblioteca, Collection<String> suplementosDaBiblioteca,
                                   Collection<String> ergogenicosDaBiblioteca, LocalDate hoje) {
        List<AbaReconhecida> abas = reconhecerAbas(leitura, Map.of());

        List<LigacaoDeAbas.Ligacao> ligacoes = LigacaoDeAbas.ligarTodas(abas);
        Map<Integer, LigacaoDeAbas.Ligacao> porFilha = new HashMap<>();
        ligacoes.forEach(l -> porFilha.put(l.filha(), l));

        Problemas problemas = new Problemas();
        Contas contas = new Contas();
        Ocorrencias exercicios = new Ocorrencias();
        Ocorrencias alimentos = new Ocorrencias();
        Map<String, String[]> suplementos = new LinkedHashMap<>();
        List<String> listaDaPlanilha = new ArrayList<>();
        // Alunos primeiro: os pesos conferem o aluno que ficou fora e o peso inicial do cadastro.
        abas.stream().filter(a -> a.tipo() == TipoDeAba.ALUNOS)
                .forEach(a -> alunos(a, leitura.data1904(), hoje, contas, problemas));
        for (AbaReconhecida aba : abas) {
            switch (aba.tipo()) {
                case PESOS -> pesos(aba, porFilha.get(aba.indice()), leitura.data1904(), hoje, contas, problemas);
                case TREINO -> treino(aba, leitura.data1904(), contas, exercicios, problemas);
                case LISTA_DE_EXERCICIOS -> {
                    for (Linha l : aba.dados()) {
                        String nome = texto(l, aba.reconhecimento().coluna(Campo.EXERCICIO));
                        if (!nome.isEmpty()) {
                            listaDaPlanilha.add(nome);
                            contas.exerciciosNaLista++;
                        }
                    }
                }
                case DIETA -> dieta(aba, contas, alimentos, problemas);
                case SUPLEMENTOS -> suplementos(aba, contas, suplementos, problemas);
                default -> {
                    // Alunos já foram; rotinas e planos de dieta só ligam as outras abas; a tabela de alimentos de
                    // terceiros não é usada.
                }
            }
        }

        for (LigacaoDeAbas.Ligacao lg : ligacoes) {
            AbaReconhecida filha = abas.get(lg.filha());
            if (filha.tipo() == TipoDeAba.PESOS) {
                continue; // os pesos conferem a ligação linha a linha, com um problema por linha
            }
            Campo campo = campoDaColuna(filha.reconhecimento(), lg.colunaFilha());
            Set<Integer> naoLigadas = new HashSet<>(lg.naoLigadas());
            Set<Integer> ambiguas = new HashSet<>(lg.ambiguas());
            boolean aoAluno = abas.get(lg.mae()).tipo() == TipoDeAba.ALUNOS && lg.por() == LigacaoDeAbas.Por.CODIGO;
            for (Linha l : filha.dados()) {
                String ref = texto(l, lg.colunaFilha());
                String tipo = ref.isEmpty() ? "SEM_REFERENCIA"
                        : naoLigadas.contains(l.numero()) ? "LINHA_SEM_LIGACAO"
                        : ambiguas.contains(l.numero()) ? "LIGACAO_AMBIGUA"
                        : aoAluno && contas.alunosFora.contains(ref.toLowerCase(Locale.ROOT)) ? "ALUNO_FORA" : null;
                if (tipo != null) {
                    problemas.add(filha.nome(), l.numero(), campo, tipo);
                }
            }
        }

        Set<String> daBiblioteca = new HashSet<>();
        exerciciosDaBiblioteca.forEach(n -> daBiblioteca.add(CasamentoDeNomes.chave(n)));
        List<String> candidatos = new ArrayList<>(exerciciosDaBiblioteca);
        candidatos.addAll(listaDaPlanilha);
        Casados deExercicios = casar(exercicios, new CasamentoDeNomes.Indice(candidatos), daBiblioteca);
        Set<String> alimentosConhecidos = new HashSet<>();
        alimentosDaBiblioteca.forEach(n -> alimentosConhecidos.add(CasamentoDeNomes.chave(n)));
        Casados deAlimentos = casar(alimentos, new CasamentoDeNomes.Indice(alimentosDaBiblioteca), alimentosConhecidos);

        Resumo resumo = new Resumo(contas.alunos, contas.alunosInativos, contas.pesos, contas.pesosIniciais,
                contas.iniciaisNoHistorico, contas.treinos.size(), contas.exercicios,
                contas.refeicoes.size(), contas.itensDeDieta, contas.suplementos, contas.exerciciosNaLista,
                deExercicios.contagem(), deAlimentos.contagem(), contas.prescricoes, contas.naoEntendidas, contas.comSobra,
                contas.faixasDeData);
        return new Analise(abas.stream().map(AnaliseDaPlanilha::aba).toList(), ligacoes.stream().map(AnaliseDaPlanilha::ligacao).toList(),
                resumo, List.copyOf(problemas.lista), problemas.alem, problemas.porTipo, deExercicios.perguntas(), deAlimentos.perguntas(),
                suplementosDaBiblioteca == null ? List.of()
                        : perguntasDeSuplemento(suplementos, suplementosDaBiblioteca, ergogenicosDaBiblioteca));
    }

    /**
     * Reconhece cada aba e separa as linhas de dados (sem o cabeçalho e sem as em branco). {@code tipos} troca o tipo
     * reconhecido de uma aba pelo que o treinador confirmou (aba fora do mapa fica como foi reconhecida); a aba
     * ignorada vira {@code DESCONHECIDA}.
     */
    static List<AbaReconhecida> reconhecerAbas(Leitura leitura, Map<Integer, TipoDeAba> tipos) {
        List<AbaReconhecida> abas = new ArrayList<>();
        for (AbaLida lida : leitura.abas()) {
            Reconhecimento r = ReconhecimentoDeAbas.reconhecer(lida.linhas());
            TipoDeAba confirmado = tipos.get(lida.indice());
            if (confirmado != null && confirmado != r.tipo()) {
                r = new Reconhecimento(confirmado, r.linhaDoCabecalho(), r.posicaoDoCabecalho(), r.campos(), r.avisos());
            }
            List<Linha> dados = new ArrayList<>();
            for (Linha l : lida.linhas().subList(r.posicaoDoCabecalho() + 1, lida.linhas().size())) {
                if (!emBranco(l)) {
                    dados.add(l);
                }
            }
            abas.add(new AbaReconhecida(lida.indice(), lida.nome(), r, List.copyOf(dados)));
        }
        return abas;
    }

    private record Casados(Contagem contagem, List<Pergunta> perguntas) {
    }

    /** Casa cada nome distinto: a contagem por nível e as perguntas (provável e nenhum), as mais frequentes primeiro. */
    private static Casados casar(Ocorrencias vistos, CasamentoDeNomes.Indice indice, Set<String> chavesDaBiblioteca) {
        int certo = 0;
        int provavel = 0;
        int nenhum = 0;
        List<Pergunta> saida = new ArrayList<>();
        for (Map.Entry<String, String> e : vistos.primeiro.entrySet()) {
            Resultado r = indice.casar(e.getValue());
            int vezes = vistos.vezes.get(e.getKey());
            if (r.nivel() == Nivel.CERTO) {
                certo++;
                continue;
            }
            if (r.nivel() == Nivel.PROVAVEL) {
                provavel++;
            } else {
                nenhum++;
            }
            String origem = r.candidato() == null ? null
                    : chavesDaBiblioteca.contains(CasamentoDeNomes.chave(r.candidato())) ? "BIBLIOTECA" : "PLANILHA";
            saida.add(new Pergunta(e.getValue(), r.nivel().name(), r.candidato(), origem, r.nota(), vezes));
        }
        saida.sort(Comparator.comparingInt(Pergunta::ocorrencias).reversed()
                .thenComparing(p -> p.nome().toLowerCase(Locale.ROOT)));
        return new Casados(new Contagem(certo, provavel, nenhum),
                List.copyOf(saida.subList(0, Math.min(PERGUNTAS_NA_RESPOSTA, saida.size()))));
    }

    /**
     * Cadastro de alunos, na ordem do {@code converter} do {@code planilha-lib.mjs}, com um problema por linha: sem código
     * (se há coluna de código), código repetido, sem nome; depois, sem tirar o aluno, e-mail inválido, nome repetido e o
     * peso inicial (inválido, sem data de início, data inválida ou no futuro). Status diferente de ativo só é contado.
     */
    private static void alunos(AbaReconhecida aba, boolean data1904, LocalDate hoje, Contas contas, Problemas problemas) {
        Reconhecimento r = aba.reconhecimento();
        int cNome = r.coluna(Campo.ALUNO);
        int cCodigo = r.coluna(Campo.CODIGO);
        int cEmail = r.coluna(Campo.EMAIL);
        int cStatus = r.coluna(Campo.STATUS);
        Set<String> codigos = new HashSet<>();
        Set<String> nomes = new HashSet<>();
        for (Linha l : aba.dados()) {
            String codigo = texto(l, cCodigo).toLowerCase(Locale.ROOT);
            if (cCodigo >= 0 && codigo.isEmpty()) {
                problemas.add(aba.nome(), l.numero(), Campo.CODIGO, "ALUNO_SEM_CODIGO");
                continue;
            }
            if (cCodigo >= 0 && !codigos.add(codigo)) {
                problemas.add(aba.nome(), l.numero(), Campo.CODIGO, "CODIGO_REPETIDO");
                continue;
            }
            String nome = texto(l, cNome);
            if (nome.isEmpty()) {
                problemas.add(aba.nome(), l.numero(), Campo.ALUNO, "ALUNO_SEM_NOME");
                if (!codigo.isEmpty()) {
                    contas.alunosFora.add(codigo);
                }
                continue;
            }
            contas.alunos++;
            String email = texto(l, cEmail).toLowerCase(Locale.ROOT);
            if (!email.isEmpty() && !SEM_EMAIL.contains(email) && (!EMAIL.matcher(email).matches() || email.length() > 254)) {
                problemas.add(aba.nome(), l.numero(), Campo.EMAIL, "EMAIL_INVALIDO");
            }
            if (!nomes.add(Normalizacao.chaveDoNome(nome))) {
                problemas.add(aba.nome(), l.numero(), Campo.ALUNO, "NOME_REPETIDO");
            }
            String status = Normalizacao.chaveDoNome(texto(l, cStatus));
            if (!status.isEmpty() && !ATIVO.matcher(status).matches()) {
                contas.alunosInativos++;
            }
            pesoInicial(aba, l, codigo, data1904, hoje, contas, problemas);
        }
    }

    private static void pesoInicial(AbaReconhecida aba, Linha l, String codigo, boolean data1904, LocalDate hoje, Contas contas,
                                    Problemas problemas) {
        Reconhecimento r = aba.reconhecimento();
        Celula peso = LigacaoDeAbas.celula(l, r.coluna(Campo.PESO_INICIAL));
        if (ReconhecimentoDeAbas.vazia(peso)) {
            return;
        }
        Celula inicio = LigacaoDeAbas.celula(l, r.coluna(Campo.DATA_INICIO));
        LocalDate data = ReconhecimentoDeAbas.vazia(inicio) ? null : data(inicio, data1904);
        if (pesoKg(peso) == null) {
            problemas.add(aba.nome(), l.numero(), Campo.PESO_INICIAL, "PESO_INICIAL_INVALIDO");
        } else if (ReconhecimentoDeAbas.vazia(inicio)) {
            problemas.add(aba.nome(), l.numero(), Campo.DATA_INICIO, "PESO_INICIAL_SEM_DATA");
        } else if (data == null) {
            problemas.add(aba.nome(), l.numero(), Campo.DATA_INICIO, "DATA_INICIO_INVALIDA");
        } else if (data.isAfter(hoje)) {
            problemas.add(aba.nome(), l.numero(), Campo.DATA_INICIO, "DATA_INICIO_NO_FUTURO");
        } else {
            contas.iniciais.add(codigo + "|" + data);
        }
    }

    /**
     * Histórico de peso, com um problema por linha na ordem do {@code converter} do script: sem o aluno, aluno que não
     * está no cadastro (ou ambíguo, ou que ficou fora), sem data, data inválida, no futuro, sem peso, peso inválido e o
     * mesmo aluno na mesma data. O peso inicial do cadastro conta como peso se o histórico não tem o aluno naquela data.
     */
    private static void pesos(AbaReconhecida aba, LigacaoDeAbas.Ligacao ligacao, boolean data1904, LocalDate hoje, Contas contas,
                              Problemas problemas) {
        Reconhecimento r = aba.reconhecimento();
        int cRef = ligacao != null ? ligacao.colunaFilha() : primeiraColuna(r, Campo.ALUNO_CODIGO, Campo.ALUNO);
        Campo campoRef = campoDaColuna(r, cRef);
        Set<Integer> naoLigadas = ligacao == null ? Set.of() : new HashSet<>(ligacao.naoLigadas());
        Set<Integer> ambiguas = ligacao == null ? Set.of() : new HashSet<>(ligacao.ambiguas());
        boolean porCodigo = ligacao != null && ligacao.por() == LigacaoDeAbas.Por.CODIGO;
        Set<String> vistos = new HashSet<>();
        for (Linha l : aba.dados()) {
            String ref = texto(l, cRef).toLowerCase(Locale.ROOT);
            Celula data = LigacaoDeAbas.celula(l, r.coluna(Campo.DATA));
            Celula peso = LigacaoDeAbas.celula(l, r.coluna(Campo.PESO));
            LocalDate dia = ReconhecimentoDeAbas.vazia(data) ? null : data(data, data1904);
            String problema = cRef >= 0 && ref.isEmpty() ? "SEM_REFERENCIA"
                    : naoLigadas.contains(l.numero()) ? "LINHA_SEM_LIGACAO"
                    : ambiguas.contains(l.numero()) ? "LIGACAO_AMBIGUA"
                    : porCodigo && contas.alunosFora.contains(ref) ? "ALUNO_FORA"
                    : null;
            Campo campo = campoRef;
            if (problema == null) {
                campo = Campo.DATA;
                problema = ReconhecimentoDeAbas.vazia(data) ? "SEM_DATA" : dia == null ? "DATA_INVALIDA"
                        : dia.isAfter(hoje) ? "DATA_NO_FUTURO" : null;
            }
            if (problema == null) {
                campo = Campo.PESO;
                problema = ReconhecimentoDeAbas.vazia(peso) ? "SEM_PESO" : pesoKg(peso) == null ? "PESO_INVALIDO" : null;
            }
            if (problema == null && !vistos.add(ref + "|" + dia)) {
                campo = Campo.DATA;
                problema = "PESO_REPETIDO";
            }
            if (problema != null) {
                problemas.add(aba.nome(), l.numero(), campo, problema);
            } else {
                contas.pesos++;
            }
        }
        if (porCodigo) {
            for (String inicial : contas.iniciais) {
                if (vistos.contains(inicial)) {
                    contas.iniciaisNoHistorico++;
                } else {
                    contas.pesosIniciais++;
                }
            }
        }
    }

    private static void treino(AbaReconhecida aba, boolean data1904, Contas contas, Ocorrencias exercicios, Problemas problemas) {
        Reconhecimento r = aba.reconhecimento();
        int referencia = primeiraColuna(r, Campo.ROTINA_CODIGO, Campo.ALUNO_CODIGO, Campo.ALUNO);
        int treino = primeiraColuna(r, Campo.LETRA_TREINO, Campo.NOME_TREINO);
        for (Linha l : aba.dados()) {
            String nome = texto(l, r.coluna(Campo.EXERCICIO));
            if (nome.isEmpty()) {
                problemas.add(aba.nome(), l.numero(), Campo.EXERCICIO, "EXERCICIO_SEM_NOME");
                continue;
            }
            contas.exercicios++;
            exercicios.add(nome);
            contas.treinos.add(aba.indice() + "|" + texto(l, referencia).toLowerCase(Locale.ROOT) + "|"
                    + texto(l, treino).toLowerCase(Locale.ROOT));
            for (Campo campo : List.of(Campo.PRESCRICAO, Campo.SERIES, Campo.REPETICOES, Campo.CARGA)) {
                Celula c = LigacaoDeAbas.celula(l, r.coluna(campo));
                if (!ReconhecimentoDeAbas.vazia(c)) {
                    prescricao(aba, l, campo, c, data1904, contas, problemas);
                }
            }
            for (Campo campo : List.of(Campo.SERIES_TRABALHO, Campo.SERIES_PREPARACAO)) {
                Celula c = LigacaoDeAbas.celula(l, r.coluna(campo));
                if (!ReconhecimentoDeAbas.vazia(c) && quantidade(c) == null) {
                    problemas.add(aba.nome(), l.numero(), campo, "QUANTIDADE_DE_SERIES_INVALIDA");
                }
            }
        }
    }

    private static void prescricao(AbaReconhecida aba, Linha l, Campo campo, Celula c, boolean data1904, Contas contas,
                                   Problemas problemas) {
        contas.prescricoes++;
        if (campo == Campo.REPETICOES
                && LeitorDePrescricao.faixaDeRepeticoes(c, data1904).erro() == ErroDaFaixa.DATA) {
            contas.naoEntendidas++;
            problemas.add(aba.nome(), l.numero(), campo, "REPETICOES_VIROU_DATA");
            return;
        }
        if (campo == Campo.SERIES && c.numero()) {
            if (quantidadeDeSeries(c) == null) {
                contas.naoEntendidas++;
                problemas.add(aba.nome(), l.numero(), campo, "PRESCRICAO_NAO_ENTENDIDA");
            }
            return;
        }
        Prescricao p = LeitorDePrescricao.ler(c, data1904);
        if (p.naoEntendida()) {
            contas.naoEntendidas++;
            problemas.add(aba.nome(), l.numero(), campo, "PRESCRICAO_NAO_ENTENDIDA");
        } else if (p.comSobra()) {
            contas.comSobra++;
        }
        if (p.faixaDeData()) {
            contas.faixasDeData++;
        }
    }

    private static void dieta(AbaReconhecida aba, Contas contas, Ocorrencias alimentos, Problemas problemas) {
        Reconhecimento r = aba.reconhecimento();
        int referencia = primeiraColuna(r, Campo.PLANO_CODIGO, Campo.ALUNO_CODIGO, Campo.ALUNO);
        int refeicao = primeiraColuna(r, Campo.REFEICAO, Campo.TITULO);
        for (Linha l : aba.dados()) {
            String alimento = texto(l, r.coluna(Campo.ALIMENTO));
            if (alimento.isEmpty()) {
                problemas.add(aba.nome(), l.numero(), Campo.ALIMENTO, "ITEM_SEM_ALIMENTO");
                continue;
            }
            contas.itensDeDieta++;
            alimentos.add(alimento);
            contas.refeicoes.add(aba.indice() + "|" + texto(l, referencia).toLowerCase(Locale.ROOT) + "|"
                    + texto(l, refeicao).toLowerCase(Locale.ROOT));
        }
    }

    private static void suplementos(AbaReconhecida aba, Contas contas, Map<String, String[]> nomes, Problemas problemas) {
        int coluna = aba.reconhecimento().coluna(Campo.SUPLEMENTO);
        for (Linha l : aba.dados()) {
            String nome = texto(l, coluna).strip().replaceAll("\\s+", " ");
            if (nome.isEmpty()) {
                problemas.add(aba.nome(), l.numero(), Campo.SUPLEMENTO, "SUPLEMENTO_SEM_NOME");
            } else {
                contas.suplementos++;
                String k = MontagemDaImportacao.nomeDeSuplemento(nome);
                if (!k.isEmpty() && nome.length() <= RespostasDaPlanilha.TEXTO_MAXIMO) {
                    String[] atual = nomes.computeIfAbsent(k, x -> new String[] {nome, "0"});
                    atual[1] = String.valueOf(Integer.parseInt(atual[1]) + 1);
                }
            }
        }
    }

    /** Nomes distintos da aba de suplementos com a sugestão de destino; a ordem é a da planilha. */
    private static List<PerguntaDeSuplemento> perguntasDeSuplemento(Map<String, String[]> nomes,
                                                                   Collection<String> suplementos,
                                                                   Collection<String> ergogenicos) {
        List<String> ergo = ergogenicos.stream().map(MontagemDaImportacao::nomeDeSuplemento).toList();
        List<String> supl = suplementos.stream().map(MontagemDaImportacao::nomeDeSuplemento).toList();
        List<PerguntaDeSuplemento> saida = new ArrayList<>();
        nomes.forEach((k, v) -> {
            String sugestao = ergo.stream().anyMatch(e -> MontagemDaImportacao.parecido(k, e)) ? "SENSIVEL"
                    : supl.stream().anyMatch(e -> MontagemDaImportacao.parecido(k, e)) ? "SUPLEMENTO" : null;
            saida.add(new PerguntaDeSuplemento(v[0], sugestao, Integer.parseInt(v[1])));
        });
        return List.copyOf(saida);
    }

    private static Aba aba(AbaReconhecida a) {
        Reconhecimento r = a.reconhecimento();
        Map<String, Integer> campos = new LinkedHashMap<>();
        r.campos().entrySet().stream().sorted(Map.Entry.comparingByKey())
                .forEach(e -> campos.put(e.getKey().name(), e.getValue()));
        List<Aviso> avisos = r.avisos().stream().map(v -> new Aviso(v.codigo(), v.linha(), v.coluna())).toList();
        return new Aba(a.indice(), a.nome(), r.tipo().name(), r.linhaDoCabecalho(), a.dados().size(), campos, avisos);
    }

    private static Ligacao ligacao(LigacaoDeAbas.Ligacao l) {
        List<LinhaAmbigua> pendentes = new ArrayList<>();
        for (Integer linha : l.ambiguas()) {
            if (pendentes.size() == LINHAS_AMBIGUAS_NA_RESPOSTA) {
                break;
            }
            pendentes.add(new LinhaAmbigua(linha, List.copyOf(l.candidatas().getOrDefault(linha, List.of()))));
        }
        return new Ligacao(l.filha(), l.colunaFilha(), l.mae(), l.colunaMae(), l.por().name(), l.ligadas().size(),
                l.naoLigadas().size(), l.ambiguas().size(), List.copyOf(pendentes));
    }

    static Campo campoDaColuna(Reconhecimento r, int coluna) {
        return r.campos().entrySet().stream().filter(e -> e.getValue() == coluna).map(Map.Entry::getKey).findFirst().orElse(null);
    }

    private static int primeiraColuna(Reconhecimento r, Campo... campos) {
        for (Campo c : campos) {
            if (r.tem(c)) {
                return r.coluna(c);
            }
        }
        return -1;
    }

    static boolean emBranco(Linha l) {
        return l.celulas().stream().allMatch(ReconhecimentoDeAbas::vazia);
    }

    static String texto(Linha l, int coluna) {
        Celula c = LigacaoDeAbas.celula(l, coluna);
        return c == null || c.erro() ? "" : c.texto().strip();
    }

    /** Data do peso: série do Excel ou texto DD/MM/AAAA ou AAAA-MM-DD; dia que não existe = null. */
    static LocalDate data(Celula c, boolean data1904) {
        if (c.erro()) {
            return null;
        }
        if (c.numero()) {
            try {
                return LeitorDePlanilha.dataSerial(new BigDecimal(c.texto()), data1904);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        String t = c.texto().strip();
        try {
            Matcher m = DATA_BR.matcher(t);
            if (m.matches()) {
                return LocalDate.of(Integer.parseInt(m.group(3)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(1)));
            }
            m = DATA_ISO.matcher(t);
            if (m.matches()) {
                return LocalDate.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
            }
        } catch (DateTimeException e) {
            return null;
        }
        return null;
    }

    /**
     * Peso em kg, como o {@code pesoKg} do script: maior que 0 e menor que 500, no máximo duas casas. Número do Excel
     * com resto de conta (81.9000000001) volta às duas casas; com uma terceira casa de verdade é inválido (nunca
     * arredonda peso). Texto aceita vírgula e "kg" no fim.
     */
    static BigDecimal pesoKg(Celula c) {
        if (c.erro()) {
            return null;
        }
        BigDecimal v;
        if (c.numero()) {
            try {
                BigDecimal n = new BigDecimal(c.texto());
                BigDecimal r = n.setScale(2, java.math.RoundingMode.HALF_UP);
                if (n.subtract(r).abs().compareTo(new BigDecimal("0.000001")) > 0) {
                    return null;
                }
                v = r.stripTrailingZeros();
            } catch (NumberFormatException e) {
                return null;
            }
        } else {
            String t = c.texto().strip().replaceAll("(?i)\\s*kg$", "");
            Matcher m = PESO_ESCRITO.matcher(t);
            if (!m.matches()) {
                return null;
            }
            v = new BigDecimal(t.replace(',', '.'));
        }
        return v.signum() > 0 && v.compareTo(BigDecimal.valueOf(500)) < 0 ? v : null;
    }

    /** Quantidade de séries de um tipo (0 a {@value #SERIES_POR_TIPO}), inteira; senão null. */
    private static Integer quantidade(Celula c) {
        Integer n = inteiro(c);
        return n != null && n >= 0 && n <= SERIES_POR_TIPO ? n : null;
    }

    private static Integer quantidadeDeSeries(Celula c) {
        Integer n = inteiro(c);
        return n != null && n >= 1 && n <= LeitorDePrescricao.SERIES_MAXIMAS ? n : null;
    }

    private static Integer inteiro(Celula c) {
        if (c.erro()) {
            return null;
        }
        try {
            BigDecimal n = new BigDecimal(c.texto().strip().replace(',', '.'));
            return n.signum() == 0 || n.stripTrailingZeros().scale() <= 0 ? n.intValueExact() : null;
        } catch (NumberFormatException | ArithmeticException e) {
            return null;
        }
    }
}
