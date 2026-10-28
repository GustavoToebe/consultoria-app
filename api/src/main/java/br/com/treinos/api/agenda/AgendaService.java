package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoDoAluno;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoExportado;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoRequest;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoResponse;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Agenda presencial do consultório (28/10): só a equipe marca, com um aluno ativo e um responsável ativo da equipe.
 *
 * <p><b>Fuso.</b> Data e hora entram e saem sempre no horário de Brasília ({@link Fuso#BRASILIA}), nunca no do servidor:
 * o banco guarda o instante. O período da listagem também é de dias de Brasília.
 *
 * <p><b>Conflito.</b> O mesmo responsável não tem dois compromissos não cancelados que se sobreponham: 409
 * {@code HORARIO_OCUPADO}, sem nada do outro compromisso (nem o aluno) na resposta. Toda escrita trava a linha da
 * consultoria antes de contar ({@link ConsultoriaRepository#travar}): duas reservas simultâneas do mesmo horário ficam em
 * série e a segunda vê a primeira. A trava é da consultoria inteira (e não do responsável) porque remarcar pode trocar o
 * responsável e a agenda tem pouco movimento; a mesma trava já serializa as mutações de membros e o plano aplicado.
 *
 * <p><b>Observação.</b> Texto livre da equipe, tratado como dado sensível: nunca em log nem na auditoria (resumos fixos),
 * lido só com {@code ALUNO_SENSIVEL_LER} e gravado só com {@code ALUNO_SENSIVEL_ALTERAR} (sem ela, o que vier é ignorado e
 * a gravada fica, como CPF e endereço do aluno).
 */
@Service
public class AgendaService {

    /** Maior período de uma listagem, em dias (inclusive as pontas). */
    static final int JANELA_MAXIMA_DIAS = 62;
    /** Quantos próximos compromissos o aluno vê. */
    static final int PROXIMOS_DO_ALUNO = 20;
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");

    private final CompromissoRepository compromissos;
    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;

    public AgendaService(CompromissoRepository compromissos, AlunoRepository alunos, UsuarioRepository usuarios,
                         ConsultoriaRepository consultorias, Auditoria auditoria) {
        this.compromissos = compromissos;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
        this.auditoria = auditoria;
    }

    // ---- Equipe ----

    /**
     * Compromissos que tocam os dias [{@code de}, {@code ate}] de Brasília (padrão: hoje e os 6 seguintes). Mais de
     * {@value #JANELA_MAXIMA_DIAS} dias, ou {@code ate} antes de {@code de}: 400. Sem {@code situacoes}, todas.
     */
    @Transactional(readOnly = true)
    public List<CompromissoResponse> listar(LocalDate de, LocalDate ate, UUID responsavelId, Collection<String> situacoes) {
        LocalDate inicio = de == null ? LocalDate.now(Fuso.BRASILIA) : de;
        LocalDate fim = ate == null ? inicio.plusDays(6) : ate;
        if (fim.isBefore(inicio)) {
            throw new BadRequestException("A data final vem antes da inicial.", "PERIODO_INVALIDO");
        }
        if (ChronoUnit.DAYS.between(inicio, fim) + 1 > JANELA_MAXIMA_DIAS) {
            throw new BadRequestException("Escolha um período de até " + JANELA_MAXIMA_DIAS + " dias.", "PERIODO_INVALIDO");
        }
        List<Compromisso> lista = compromissos.doPeriodo(inicio.atStartOfDay(Fuso.BRASILIA).toInstant(),
                fim.plusDays(1).atStartOfDay(Fuso.BRASILIA).toInstant(), responsavelId, filtro(situacoes));
        return respostas(lista);
    }

    @Transactional(readOnly = true)
    public CompromissoResponse detalhe(UUID id) {
        return respostas(List.of(buscar(id))).getFirst();
    }

    @Transactional
    @Auditar(acao = "COMPROMISSO_CRIADO", entidade = "COMPROMISSO", resumo = "Marcou um compromisso na agenda.")
    public CompromissoResponse criar(CompromissoRequest r, UUID quem) {
        travarConsultoria();
        Aluno aluno = exigirAlunoParaMarcar(r.alunoId());
        UUID responsavel = exigirResponsavel(r.responsavelId());
        Instant inicio = inicioEmBrasilia(r);
        exigirHorarioLivre(responsavel, inicio, r.duracaoMinutos(), null);
        String observacao = AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR") ? Buscas.opcional(r.observacao()) : null;
        Compromisso c = new Compromisso(aluno.getId(), responsavel, inicio, r.duracaoMinutos(), Buscas.opcional(r.local()),
                observacao, quem);
        return respostas(List.of(compromissos.saveAndFlush(c))).getFirst();
    }

    /**
     * Remarcar ou corrigir (aluno, responsável, data, hora, duração, local, observação), com a versão lida (409
     * {@code CONFLITO_EDICAO}). Passa pela mesma conferência de horário, menos o cancelado (que não ocupa horário).
     */
    @Transactional
    @Auditar(acao = "COMPROMISSO_ALTERADO", entidade = "COMPROMISSO", resumo = "Alterou um compromisso da agenda.")
    public CompromissoResponse alterar(UUID id, CompromissoRequest r) {
        travarConsultoria();
        Compromisso c = buscar(id);
        exigirVersao(c, r.versao());
        Aluno aluno = exigirAlunoParaMarcar(r.alunoId());
        UUID responsavel = exigirResponsavel(r.responsavelId());
        Instant inicio = inicioEmBrasilia(r);
        if (c.getSituacao().ocupaHorario()) {
            exigirHorarioLivre(responsavel, inicio, r.duracaoMinutos(), c.getId());
        }
        String observacao = AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR") ? Buscas.opcional(r.observacao()) : c.getObservacao();
        c.alterar(aluno.getId(), responsavel, inicio, r.duracaoMinutos(), Buscas.opcional(r.local()), observacao);
        return respostas(List.of(compromissos.saveAndFlush(c))).getFirst();
    }

    /**
     * Realizado, falta, cancelado ou de volta a agendado, com a versão lida. A mesma situação não muda nada (nem audita).
     * Realizado e falta só depois do início (409 {@code COMPROMISSO_NO_FUTURO}). Sair do cancelado volta a ocupar o
     * horário: exige aluno ativo, responsável ativo e o horário livre, como marcar de novo.
     */
    @Transactional
    public CompromissoResponse alterarSituacao(UUID id, SituacaoCompromisso nova, Long versao) {
        travarConsultoria();
        Compromisso c = buscar(id);
        exigirVersao(c, versao);
        if (nova == c.getSituacao()) {
            return respostas(List.of(c)).getFirst();
        }
        if (SituacaoCompromisso.DEPOIS_DO_INICIO.contains(nova) && c.getInicio().isAfter(Instant.now())) {
            throw new ConflictException("Só dá para marcar como realizado ou falta depois do horário do compromisso.",
                    "COMPROMISSO_NO_FUTURO");
        }
        if (!c.getSituacao().ocupaHorario() && nova.ocupaHorario()) {
            exigirAlunoParaMarcar(c.getAlunoId());
            exigirResponsavel(c.getResponsavelId());
            exigirHorarioLivre(c.getResponsavelId(), c.getInicio(), c.getDuracaoMinutos(), c.getId());
        }
        c.alterarSituacao(nova);
        compromissos.saveAndFlush(c);
        auditoria.registrarEvento("COMPROMISSO_SITUACAO_ALTERADA", "COMPROMISSO", c.getId(),
                "Alterou a situação de um compromisso da agenda.");
        return respostas(List.of(c)).getFirst();
    }

    // ---- Aluno ----

    /**
     * Os próximos compromissos do aluno da sessão (ainda não terminados, agendados ou cancelados), no máximo
     * {@value #PROXIMOS_DO_ALUNO}. Sem observação e sem ids da equipe; com o nome do responsável (o aluno precisa saber
     * com quem vai se encontrar).
     */
    @Transactional(readOnly = true)
    public List<CompromissoDoAluno> doAluno(UUID alunoId) {
        List<Compromisso> lista = compromissos.proximosDoAluno(alunoId, Instant.now(), SituacaoCompromisso.DO_ALUNO)
                .stream().limit(PROXIMOS_DO_ALUNO).toList();
        Map<UUID, String> nomes = nomesDaEquipe(lista.stream().map(Compromisso::getResponsavelId).toList());
        return lista.stream().map(c -> new CompromissoDoAluno(c.getId(), c.getInicio(), c.getFim(), data(c.getInicio()),
                hora(c.getInicio()), hora(c.getFim()), c.getDuracaoMinutos(), c.getLocal(), c.getSituacao(),
                nomes.get(c.getResponsavelId()))).toList();
    }

    // ---- Privacidade ----

    /** Exportação do aluno (seção {@code compromissos}, com {@code AGENDA_LER}): todos, com a observação. */
    @Transactional(readOnly = true)
    public List<CompromissoExportado> exportar(UUID alunoId) {
        List<Compromisso> lista = compromissos.findByAlunoIdOrderByInicioAsc(alunoId);
        Map<UUID, String> nomes = nomesDaEquipe(lista.stream().map(Compromisso::getResponsavelId).toList());
        return lista.stream().map(c -> new CompromissoExportado(c.getId(), c.getInicio(), data(c.getInicio()),
                hora(c.getInicio()), c.getDuracaoMinutos(), c.getLocal(), c.getObservacao(), c.getSituacao(),
                nomes.get(c.getResponsavelId()), c.getCriadoEm())).toList();
    }

    /** Anonimização e "Excluir minha conta": na transação de quem chama, todos os compromissos do aluno saem. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID consultoriaId, UUID alunoId) {
        compromissos.apagarDoAluno(consultoriaId, alunoId);
    }

    // ---- Auxiliares ----

    private void travarConsultoria() {
        if (consultorias.travar(TenantContext.get()).isEmpty()) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
    }

    private Compromisso buscar(UUID id) {
        return compromissos.findById(id).orElseThrow(() -> new NaoEncontradoException("Compromisso não encontrado."));
    }

    /** Aluno da consultoria (senão 404), ativo (409 {@code ALUNO_INATIVO}) e não anonimizado (409 {@code ALUNO_ANONIMIZADO}). */
    private Aluno exigirAlunoParaMarcar(UUID alunoId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (aluno.isAnonimizado()) {
            throw new ConflictException("Este aluno foi anonimizado e não pode ter compromissos.", "ALUNO_ANONIMIZADO");
        }
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo. Reative para marcar um compromisso.", "ALUNO_INATIVO");
        }
        return aluno;
    }

    /** Membro ativo da equipe desta consultoria ({@code Usuario} é global: a consultoria é conferida à mão). Senão 404. */
    private UUID exigirResponsavel(UUID id) {
        boolean valido = id != null && usuarios.findById(id).filter(this::daConsultoria)
                .filter(u -> u.isAtivo() && u.getPapel() == Papel.TREINADOR).isPresent();
        if (!valido) {
            throw new NaoEncontradoException("Responsável não encontrado.");
        }
        return id;
    }

    private void exigirHorarioLivre(UUID responsavelId, Instant inicio, int duracaoMinutos, UUID ignorar) {
        if (compromissos.sobrepostos(responsavelId, inicio, Compromisso.fimDe(inicio, duracaoMinutos), ignorar) > 0) {
            throw new ConflictException("O responsável já tem um compromisso nesse horário. Escolha outro horário.",
                    "HORARIO_OCUPADO");
        }
    }

    private static void exigirVersao(Compromisso c, Long versao) {
        if (versao == null || !versao.equals(c.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou este compromisso. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    /** Data e hora são de Brasília: o instante sai daqui, nunca do fuso do servidor. */
    static Instant inicioEmBrasilia(CompromissoRequest r) {
        return ZonedDateTime.of(r.data(), r.hora().truncatedTo(ChronoUnit.MINUTES), Fuso.BRASILIA).toInstant();
    }

    static LocalDate data(Instant instante) {
        return instante.atZone(Fuso.BRASILIA).toLocalDate();
    }

    static String hora(Instant instante) {
        return instante.atZone(Fuso.BRASILIA).format(HORA);
    }

    private static Set<SituacaoCompromisso> filtro(Collection<String> situacoes) {
        if (situacoes == null || situacoes.stream().allMatch(s -> s == null || s.isBlank())) {
            return EnumSet.allOf(SituacaoCompromisso.class);
        }
        Set<SituacaoCompromisso> filtro = EnumSet.noneOf(SituacaoCompromisso.class);
        for (String s : situacoes) {
            if (s == null || s.isBlank()) continue;
            try {
                filtro.add(SituacaoCompromisso.valueOf(s.trim().toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Situação precisa ser AGENDADO, REALIZADO, CANCELADO ou FALTOU.");
            }
        }
        return filtro;
    }

    private List<CompromissoResponse> respostas(List<Compromisso> lista) {
        Map<UUID, String> nomesAlunos = new HashMap<>();
        List<UUID> idsAlunos = lista.stream().map(Compromisso::getAlunoId).distinct().toList();
        if (!idsAlunos.isEmpty()) {
            alunos.findAllById(idsAlunos).forEach(a -> nomesAlunos.put(a.getId(), a.getNome()));
        }
        Map<UUID, String> nomesEquipe = nomesDaEquipe(lista.stream().map(Compromisso::getResponsavelId).toList());
        boolean veObservacao = AcessoAtual.pode("ALUNO_SENSIVEL_LER");
        return lista.stream().map(c -> new CompromissoResponse(c.getId(), c.getAlunoId(), nomesAlunos.get(c.getAlunoId()),
                c.getResponsavelId(), nomesEquipe.get(c.getResponsavelId()), c.getInicio(), c.getFim(), data(c.getInicio()),
                hora(c.getInicio()), hora(c.getFim()), c.getDuracaoMinutos(), c.getLocal(),
                veObservacao ? c.getObservacao() : null, c.getSituacao(), c.getVersao() == null ? 0 : c.getVersao())).toList();
    }

    private Map<UUID, String> nomesDaEquipe(Collection<UUID> ids) {
        Map<UUID, String> nomes = new HashMap<>();
        List<UUID> unicos = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (unicos.isEmpty()) return nomes;
        usuarios.findAllById(unicos).stream().filter(this::daConsultoria).forEach(u -> nomes.put(u.getId(), u.getNome()));
        return nomes;
    }

    private boolean daConsultoria(Usuario u) {
        return u.getConsultoriaId().equals(TenantContext.get());
    }
}
