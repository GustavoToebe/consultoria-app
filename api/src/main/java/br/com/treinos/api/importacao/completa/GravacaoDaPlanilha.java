package br.com.treinos.api.importacao.completa;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.Ergogenico;
import br.com.treinos.api.biblioteca.ErgogenicoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.biblioteca.Suplemento;
import br.com.treinos.api.biblioteca.SuplementoRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.conta.PlanoDaConsultoria;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.PlanoDieta;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.Importacao;
import br.com.treinos.api.importacao.ImportacaoDtos.Erro;
import br.com.treinos.api.importacao.ImportacaoRepository;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlimentoDaBiblioteca;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoExistente;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Contexto;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Dono;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.ExercicioDaBiblioteca;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.ExercicioNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Montagem;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Permissoes;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PesoNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PlanosDoAluno;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Confirmacao;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Criacao;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Previa;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Problema;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Validacao;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.treino.ValidadorTreino;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Prévia e confirmação da planilha completa. A prévia só monta ({@link MontagemDaImportacao}) e conta; a confirmação
 * relê o arquivo, confere o hash (arquivo + respostas), trava a consultoria e grava tudo numa transação: alunos sem
 * convite (vaga do plano conferida por aluno ativo novo), pesos, exercícios novos, e por aluno uma pasta com o treino e a
 * dieta <b>em rascunho</b>. Nada é publicado. Toda linha criada leva o {@code importacao_id} (V049), que o "Desfazer"
 * usa. Um único evento de auditoria ({@code IMPORTACAO_CONCLUIDA}, resumo fixo), como a importação de uma aba; os
 * serviços com {@code @Auditar} não são chamados.
 *
 * <p>Cada parte exige a permissão dela (conferida antes de qualquer efeito, porque a montagem já a deixa de fora):
 * pesos {@code ALUNO_SENSIVEL_ALTERAR}; objetivo e observações do aluno também; exercícios {@code BIBLIOTECA_ALTERAR};
 * treino {@code PASTA_ALTERAR} + {@code TREINO_ALTERAR}; dieta {@code PASTA_ALTERAR} + {@code DIETA_ALTERAR}; medicação e
 * ergogênicos {@code ERGOGENICO_ALTERAR}. A rota exige {@code ALUNO_ALTERAR}.
 */
@Service
public class GravacaoDaPlanilha {

    public static final String DESTINO = "planilha-completa";
    private static final int ERROS_GUARDADOS = 1000;
    private static final int TITULO = 120;

    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;
    private final SuplementoRepository suplementos;
    private final ErgogenicoRepository ergogenicos;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final PastaRepository pastas;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final ImportacaoRepository importacoes;
    private final ReceitaService receitas;
    private final PlanoDaConsultoria plano;
    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;
    private final VideoUrls videos;
    private final ValidadorTreino validador;
    private final JsonMapper json;
    private final GuardaDasRespostas guarda;

    public GravacaoDaPlanilha(ExercicioRepository exercicios, AlimentoRepository alimentos,
                              SuplementoRepository suplementos, ErgogenicoRepository ergogenicos, AlunoRepository alunos,
                              RegistroPesoRepository pesos, PastaRepository pastas, PlanoTreinoRepository treinos,
                              PlanoDietaRepository dietas, ImportacaoRepository importacoes, ReceitaService receitas,
                              PlanoDaConsultoria plano, ConsultoriaRepository consultorias, Auditoria auditoria,
                              VideoUrls videos, ValidadorTreino validador, JsonMapper json, GuardaDasRespostas guarda) {
        this.exercicios = exercicios;
        this.alimentos = alimentos;
        this.suplementos = suplementos;
        this.ergogenicos = ergogenicos;
        this.alunos = alunos;
        this.pesos = pesos;
        this.pastas = pastas;
        this.treinos = treinos;
        this.dietas = dietas;
        this.importacoes = importacoes;
        this.receitas = receitas;
        this.plano = plano;
        this.consultorias = consultorias;
        this.auditoria = auditoria;
        this.videos = videos;
        this.validador = validador;
        this.json = json;
        this.guarda = guarda;
    }

    @Transactional(readOnly = true)
    public Previa previa(String nomeDoArquivo, byte[] bytes, String respostasJson) {
        RespostasDaPlanilha respostas = RespostasDaPlanilha.ler(respostasJson, json);
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler(nomeDoArquivo, bytes);
        Montagem m = MontagemDaImportacao.montar(leitura, respostas, contexto());
        List<Problema> problemas = m.problemas();
        int mostrados = Math.min(AnaliseDaPlanilha.PROBLEMAS_NA_RESPOSTA, problemas.size());
        return new Previa(RespostasDaPlanilha.hash(bytes, respostas, json), criacao(m), m.partesPuladas(), m.pendencias(),
                validacao(m), List.copyOf(problemas.subList(0, mostrados)), problemas.size() - mostrados,
                porTipo(problemas));
    }

    @Transactional
    public Confirmacao confirmar(UsuarioAutenticado eu, String nomeDoArquivo, byte[] bytes, String respostasJson,
                                 String hash) {
        RespostasDaPlanilha respostas = RespostasDaPlanilha.ler(respostasJson, json);
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler(nomeDoArquivo, bytes);
        String calculado = RespostasDaPlanilha.hash(bytes, respostas, json);
        if (hash == null || !MessageDigest.isEqual(calculado.getBytes(StandardCharsets.UTF_8),
                hash.getBytes(StandardCharsets.UTF_8))) {
            throw new ConflictException("Algo mudou desde a prévia. Gere a prévia de novo.", "PREVIA_DESATUALIZADA");
        }
        // Antes de ler alunos e contar vagas: duas confirmações na mesma consultoria não correm por e-mail ou vaga.
        Exigir.existe(consultorias.travar(TenantContext.get()), () -> new NaoEncontradoException("Importação não encontrada."));

        Montagem antes = MontagemDaImportacao.montar(leitura, respostas, contexto());
        Criacao criacao = criacao(antes);
        int total = criacao.alunosNovos() + criacao.pesos() + criacao.exercicios() + criacao.pastas();
        String situacao = total == 0 ? "FALHOU" : antes.problemas().isEmpty() ? "CONCLUIDA" : "CONCLUIDA_COM_ERROS";
        Importacao importacao = importacoes.saveAndFlush(new Importacao(DESTINO, extensao(nomeDoArquivo, bytes),
                eu.usuarioId(), antes.linhas(), total, antes.alunosReaproveitados(), 0, antes.problemas().size(), situacao,
                json.writeValueAsString(configuracao(respostas, antes, criacao)), json.writeValueAsString(erros(antes))));
        UUID id = importacao.getId();

        // Os exercícios primeiro; a montagem roda de novo para os treinos ligarem aos ids novos.
        for (ExercicioNovo e : antes.exerciciosNovos()) {
            Exercicio criado = new Exercicio(e.nome(), e.grupo(), null, Exercicio.Modalidade.MAQUINA, e.videoUrl(), null,
                    Exercicio.Origem.IMPORTACAO);
            criado.marcarImportacao(id);
            exercicios.saveAndFlush(criado);
        }
        Montagem m = antes.exerciciosNovos().isEmpty() ? antes : MontagemDaImportacao.montar(leitura, respostas, contexto());

        Map<Dono, UUID> novos = new HashMap<>();
        for (AlunoNovo a : m.alunosNovos()) {
            Aluno aluno = new Aluno(a.nome(), a.email(), a.objetivo(), a.observacoes(), null);
            aluno.alterarSituacao(a.ativo(), Instant.now());
            aluno.alterarResponsavel(eu.usuarioId());
            aluno.guardarTelefoneSemAcesso(a.telefone()); // sem acesso: o telefone fica no cadastro (V048)
            aluno.marcarImportacao(id);
            if (a.ativo()) {
                // Não captura: a 409 LIMITE_DO_PLANO desfaz a confirmação inteira (a prévia já conta as vagas).
                plano.exigirVagaDeAluno();
            }
            alunos.saveAndFlush(aluno);
            novos.put(a.dono(), aluno.getId());
        }
        for (PesoNovo p : m.pesos()) {
            RegistroPeso peso = new RegistroPeso(alunoDe(p.dono(), novos), p.data(), p.kg(), p.observacao(), eu.usuarioId());
            peso.marcarImportacao(id);
            pesos.saveAndFlush(peso);
        }
        for (PlanosDoAluno p : m.planos()) {
            UUID alunoId = alunoDe(p.dono(), novos);
            PastaPlano pasta = new PastaPlano(alunoId, MontagemDaImportacao.TITULO_PASTA, null, null);
            pasta.marcarImportacao(id);
            pastas.saveAndFlush(pasta);
            if (p.treino() != null) {
                PlanoTreino t = new PlanoTreino(alunoId, titulo("Treino de ", p.nome()), null, null,
                        json.writeValueAsString(p.treino()));
                t.definirPasta(pasta.getId());
                t.marcarImportacao(id);
                treinos.saveAndFlush(t);
            }
            if (p.dieta() != null) {
                PlanoDieta d = new PlanoDieta(alunoId, titulo("Dieta de ", p.nome()), null, null,
                        json.writeValueAsString(p.dieta()));
                d.definirPasta(pasta.getId());
                d.marcarImportacao(id);
                dietas.saveAndFlush(d);
            }
        }
        // As respostas ficam guardadas na consultoria e voltam marcadas na próxima análise (as de suplemento, só com a
        // dieta, como na análise). Na mesma transação: se a confirmação desfaz, elas também.
        guarda.guardar(respostas, leitura, AcessoAtual.pode("PASTA_ALTERAR") && AcessoAtual.pode("DIETA_ALTERAR"));
        auditoria.registrarEvento("IMPORTACAO_CONCLUIDA", "IMPORTACAO", id, "Importou dados de planilha completa.");
        return new Confirmacao(id, situacao, criacao(m, criacao.exercicios()), m.partesPuladas(), validacao(m),
                m.problemas().size(), porTipo(m.problemas()));
    }

    /** O que a montagem precisa da consultoria, lido pelos repositórios (já filtrados pelo {@code @TenantId}). */
    private Contexto contexto() {
        List<ExercicioDaBiblioteca> daBiblioteca = exercicios.buscarAtivos("%").stream()
                .map(e -> new ExercicioDaBiblioteca(e.getId(), e.getNome(),
                        e.getModalidade() == null ? null : e.getModalidade().name(), e.getVideoUrl()))
                .toList();
        List<AlimentoDaBiblioteca> alimentosDaBiblioteca = alimentos.buscarAtivos("%").stream()
                .map((Alimento a) -> new AlimentoDaBiblioteca(a.getId(), a.getNome())).toList();
        List<String> nomesDeSuplementos = suplementos.findAll().stream().map(Suplemento::getNome).toList();
        List<String> nomesDeErgogenicos = ergogenicos.findAll().stream().map(Ergogenico::getNome).toList();
        Map<UUID, Set<LocalDate>> datas = new HashMap<>();
        for (RegistroPeso p : pesos.findAll()) {
            datas.computeIfAbsent(p.getAlunoId(), k -> new HashSet<>()).add(p.getData());
        }
        List<AlunoExistente> existentes = alunos.findAll().stream()
                .map(a -> new AlunoExistente(a.getId(), a.getNome(), a.getEmail(), a.isAnonimizado(),
                        datas.getOrDefault(a.getId(), Set.of())))
                .toList();
        boolean pasta = AcessoAtual.pode("PASTA_ALTERAR");
        Permissoes permissoes = new Permissoes(AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR"),
                AcessoAtual.pode("BIBLIOTECA_ALTERAR"), pasta && AcessoAtual.pode("TREINO_ALTERAR"),
                pasta && AcessoAtual.pode("DIETA_ALTERAR"), AcessoAtual.pode("ERGOGENICO_ALTERAR"));
        return new Contexto(daBiblioteca, alimentosDaBiblioteca, nomesDeSuplementos, nomesDeErgogenicos, existentes,
                receitas.metodologiaPadrao().orElse(null), plano.vagasDeAluno(), permissoes, LocalDate.now(Fuso.BRASILIA),
                videos::valida);
    }

    private static UUID alunoDe(Dono dono, Map<Dono, UUID> novos) {
        UUID id = dono.existente() != null ? dono.existente() : novos.get(dono);
        if (id == null) {
            throw new IllegalStateException("Dono sem aluno gravado.");
        }
        return id;
    }

    private static String titulo(String prefixo, String nome) {
        String t = prefixo + (nome == null ? "" : nome);
        return t.length() <= TITULO ? t : t.substring(0, TITULO).strip();
    }

    private static Criacao criacao(Montagem m) {
        return criacao(m, m.exerciciosNovos().size());
    }

    static Criacao criacao(Montagem m, int exerciciosNovos) {
        int treinos = 0;
        int sessoes = 0;
        int exerciciosNosTreinos = 0;
        int ligados = 0;
        int series = 0;
        int dietas = 0;
        int refeicoes = 0;
        int itens = 0;
        int itensLigados = 0;
        int suplementos = 0;
        int ergogenicos = 0;
        for (PlanosDoAluno p : m.planos()) {
            if (p.treino() != null) {
                treinos++;
                for (ConteudoTreino.Sessao s : p.treino().sessoes()) {
                    sessoes++;
                    for (ConteudoTreino.ExercicioPlano e : s.exercicios()) {
                        exerciciosNosTreinos++;
                        ligados += e.exercicioId() == null ? 0 : 1;
                        series += e.series() == null ? 0 : e.series().size();
                    }
                }
            }
            if (p.dieta() != null) {
                ConteudoDieta d = p.dieta();
                dietas++;
                for (ConteudoDieta.Refeicao r : d.refeicoes()) {
                    refeicoes++;
                    for (ConteudoDieta.Opcao o : r.opcoes()) {
                        for (ConteudoDieta.Item i : o.itens()) {
                            itens++;
                            itensLigados += i.alimentoId() == null ? 0 : 1;
                        }
                    }
                }
                suplementos += d.suplementacao() == null ? 0 : d.suplementacao().size();
                ergogenicos += d.ergogenicos() == null ? 0 : d.ergogenicos().size();
            }
        }
        int inativos = (int) m.alunosNovos().stream().filter(a -> !a.ativo()).count();
        return new Criacao(m.alunosNovos().size(), inativos, m.alunosReaproveitados(), m.pesos().size(), m.pesosIniciais(),
                m.pesosJaRegistrados(), exerciciosNovos, m.planos().size(), treinos, sessoes, exerciciosNosTreinos, ligados,
                series, dietas, refeicoes, itens, itensLigados, suplementos, ergogenicos, m.suplementosSensiveisPulados(),
                m.faixasRecuperadasDeData());
    }

    /** Erros e avisos que a publicação apontaria nos treinos (só contados; o rascunho entra de qualquer forma). */
    private Validacao validacao(Montagem m) {
        int erros = 0;
        int avisos = 0;
        for (PlanosDoAluno p : m.planos()) {
            if (p.treino() != null) {
                ResultadoValidacao r = validador.validar(p.treino(), null, null);
                erros += r.erros().size();
                avisos += r.avisos().size();
            }
        }
        return new Validacao(erros, avisos);
    }

    private static Map<String, Integer> porTipo(List<Problema> problemas) {
        Map<String, Integer> contagem = new LinkedHashMap<>();
        problemas.forEach(p -> contagem.merge(p.tipo(), 1, Integer::sum));
        return contagem;
    }

    /**
     * Histórico: aba e linha, campo e o código do problema; nunca o valor da célula. A aba que tem o nome de um aluno
     * (aba de um aluno ou em blocos) vira "Aba N": o histórico fica um ano e não leva nome de aluno.
     */
    static List<Erro> erros(Montagem m) {
        List<Erro> erros = new ArrayList<>();
        for (Problema p : m.problemas()) {
            if (erros.size() == ERROS_GUARDADOS) {
                break;
            }
            String aba = m.abasComNomeDeAluno().getOrDefault(p.aba(), p.aba());
            erros.add(new Erro(p.linha(), p.campo() == null ? "" : p.campo(), aba + ": " + p.tipo()));
        }
        return erros;
    }

    /** A configuração guardada: tipos confirmados das abas, partes puladas e contagens. Sem nomes nem respostas de nomes. */
    private static Map<String, Object> configuracao(RespostasDaPlanilha respostas, Montagem m, Criacao criacao) {
        Map<String, Object> c = new LinkedHashMap<>();
        Map<String, String> abas = new LinkedHashMap<>();
        respostas.abas().forEach(a -> abas.put(String.valueOf(a.indice()), a.tipo()));
        c.put("tiposDasAbas", abas);
        c.put("partesPuladas", m.partesPuladas());
        c.put("criacao", criacao);
        return c;
    }

    /** Só a extensão (LGPD: o nome do arquivo costuma ter o nome do aluno ou do treinador). */
    private static String extensao(String nome, byte[] bytes) {
        String limpo = nome == null ? "" : nome.toLowerCase(java.util.Locale.ROOT).trim();
        boolean zip = bytes != null && bytes.length >= 2 && bytes[0] == 'P' && bytes[1] == 'K';
        return limpo.endsWith(".xlsx") || zip ? ".xlsx" : ".csv";
    }
}
