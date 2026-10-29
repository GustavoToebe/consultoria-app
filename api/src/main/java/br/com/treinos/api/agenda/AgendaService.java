package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.agenda.AgendaDtos.AlunoOcupado;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoDoAluno;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoExportado;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoRequest;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoResponse;
import br.com.treinos.api.agenda.AgendaDtos.Participante;
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
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Agenda presencial do consultório (28/10): só a equipe marca, com de 1 a {@value AgendaDtos#ALUNOS_MAXIMO} alunos ativos
 * (cada um é um participante com a situação dele) e um responsável ativo da equipe.
 *
 * <p><b>Fuso.</b> Data e hora entram e saem sempre no horário de Brasília ({@link Fuso#BRASILIA}), nunca no do servidor:
 * o banco guarda o instante. O período da listagem também é de dias de Brasília.
 *
 * <p><b>Conflito.</b> O mesmo responsável não tem dois compromissos não cancelados que se sobreponham: 409
 * {@code HORARIO_OCUPADO}, sem nada do outro compromisso (nem os alunos) na resposta. Aluno que já tem outro compromisso
 * no horário é só aviso ({@link #alunosOcupados}). Toda escrita trava a linha da consultoria antes de contar
 * ({@link ConsultoriaRepository#travar}): duas reservas simultâneas do mesmo horário ficam em série e a segunda vê a
 * primeira. A trava é da consultoria inteira (e não do responsável) porque remarcar pode trocar o responsável e a agenda
 * tem pouco movimento; a mesma trava já serializa as mutações de membros e o plano aplicado.
 *
 * <p><b>Cancelado.</b> {@code Compromisso.cancelado} vale exatamente quando todos os participantes estão cancelados, e só
 * ele libera o horário do responsável. Toda escrita termina recalculando isso na mesma transação, e toda mudança por aluno
 * sobe a {@code versao} do compromisso ({@link Compromisso#tocar()}).
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
    private final CompromissoAlunoRepository participantes;
    private final AvisoCompromissoRepository avisos;
    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;

    public AgendaService(CompromissoRepository compromissos, CompromissoAlunoRepository participantes,
                         AvisoCompromissoRepository avisos, AlunoRepository alunos, UsuarioRepository usuarios,
                         ConsultoriaRepository consultorias, Auditoria auditoria) {
        this.compromissos = compromissos;
        this.participantes = participantes;
        this.avisos = avisos;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
        this.auditoria = auditoria;
    }

    // ---- Equipe ----

    /**
     * Compromissos que tocam os dias [{@code de}, {@code ate}] de Brasília (padrão: hoje e os 6 seguintes). Mais de
     * {@value #JANELA_MAXIMA_DIAS} dias, ou {@code ate} antes de {@code de}: 400. Sem {@code situacoes}, todas; com elas,
     * os compromissos em que algum aluno está numa delas.
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
        List<UUID> alunoIds = exigirAlunoIds(r.alunoIds());
        alunoIds.forEach(this::exigirAlunoParaMarcar);
        UUID responsavel = exigirResponsavel(r.responsavelId());
        Instant inicio = inicioEmBrasilia(r.data(), r.hora());
        exigirHorarioLivre(responsavel, inicio, r.duracaoMinutos(), null);
        String observacao = AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR") ? Buscas.opcional(r.observacao()) : null;
        Compromisso c = compromissos.saveAndFlush(new Compromisso(responsavel, inicio, r.duracaoMinutos(),
                Buscas.opcional(r.local()), observacao, quem));
        participantes.saveAll(alunoIds.stream()
                .map(a -> new CompromissoAluno(c.getId(), a, SituacaoCompromisso.AGENDADO)).toList());
        return respostas(List.of(c)).getFirst();
    }

    /**
     * Remarcar ou corrigir (alunos, responsável, data, hora, duração, local, observação), com a versão lida (409
     * {@code CONFLITO_EDICAO}). A lista de alunos é trocada inteira: quem entra nasce {@code AGENDADO} (ou {@code CANCELADO},
     * se o compromisso está cancelado), quem sai é apagado do compromisso e quem fica mantém a situação. Exige alunos ativos
     * e não anonimizados (409 {@code ALUNO_INATIVO}/{@code ALUNO_ANONIMIZADO}) para quem entra e para quem fica sem estar
     * cancelado, e passa pela mesma conferência de horário do responsável, menos quando o compromisso fica cancelado (que
     * não ocupa horário).
     */
    @Transactional
    @Auditar(acao = "COMPROMISSO_ALTERADO", entidade = "COMPROMISSO", resumo = "Alterou um compromisso da agenda.")
    public CompromissoResponse alterar(UUID id, CompromissoRequest r) {
        travarConsultoria();
        Compromisso c = buscar(id);
        exigirVersao(c, r.versao());
        List<UUID> alunoIds = exigirAlunoIds(r.alunoIds());
        Map<UUID, CompromissoAluno> atuais = porAluno(participantes.findByCompromissoId(c.getId()));
        List<UUID> entram = alunoIds.stream().filter(a -> !atuais.containsKey(a)).toList();
        List<CompromissoAluno> ficam = atuais.values().stream().filter(p -> alunoIds.contains(p.getAlunoId())).toList();
        // Sem ninguém novo e com todos os que ficam cancelados, o compromisso continua (ou passa a ser) cancelado.
        boolean ficaCancelado = c.isCancelado()
                || (entram.isEmpty() && ficam.stream().allMatch(p -> p.getSituacao() == SituacaoCompromisso.CANCELADO));
        entram.forEach(this::exigirAlunoParaMarcar);
        if (!ficaCancelado) {
            ficam.stream().filter(p -> p.getSituacao() != SituacaoCompromisso.CANCELADO)
                    .forEach(p -> exigirAlunoParaMarcar(p.getAlunoId()));
        }
        UUID responsavel = exigirResponsavel(r.responsavelId());
        Instant inicio = inicioEmBrasilia(r.data(), r.hora());
        if (!ficaCancelado) {
            exigirHorarioLivre(responsavel, inicio, r.duracaoMinutos(), c.getId());
        }
        String observacao = AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR") ? Buscas.opcional(r.observacao()) : c.getObservacao();
        c.alterar(responsavel, inicio, r.duracaoMinutos(), Buscas.opcional(r.local()), observacao);
        atuais.values().stream().filter(p -> !alunoIds.contains(p.getAlunoId())).forEach(participantes::delete);
        SituacaoCompromisso nasce = c.isCancelado() ? SituacaoCompromisso.CANCELADO : SituacaoCompromisso.AGENDADO;
        participantes.saveAll(entram.stream().map(a -> new CompromissoAluno(c.getId(), a, nasce)).toList());
        if (c.isCancelado() != ficaCancelado) {
            c.definirCancelado(ficaCancelado);
        }
        return respostas(List.of(compromissos.saveAndFlush(c))).getFirst();
    }

    /**
     * Cancela o compromisso inteiro (todos os participantes ficam cancelados e o horário do responsável é liberado) ou o
     * reabre (todos voltam a agendado). A mesma situação não muda nada (nem audita). Reabrir volta a ocupar o horário:
     * exige alunos ativos, responsável ativo e o horário livre, como marcar de novo.
     */
    @Transactional
    public CompromissoResponse alterarCancelamento(UUID id, boolean cancelar, Long versao) {
        travarConsultoria();
        Compromisso c = buscar(id);
        exigirVersao(c, versao);
        if (cancelar == c.isCancelado()) {
            return respostas(List.of(c)).getFirst();
        }
        List<CompromissoAluno> todos = participantes.findByCompromissoId(c.getId());
        if (cancelar) {
            todos.forEach(p -> p.alterarSituacao(SituacaoCompromisso.CANCELADO));
        } else {
            todos.forEach(p -> exigirAlunoParaMarcar(p.getAlunoId()));
            exigirResponsavel(c.getResponsavelId());
            exigirHorarioLivre(c.getResponsavelId(), c.getInicio(), c.getDuracaoMinutos(), c.getId());
            todos.forEach(p -> p.alterarSituacao(SituacaoCompromisso.AGENDADO));
        }
        c.definirCancelado(cancelar);
        compromissos.saveAndFlush(c);
        auditoria.registrarEvento("COMPROMISSO_SITUACAO_ALTERADA", "COMPROMISSO", c.getId(),
                "Alterou a situação de um compromisso da agenda.");
        return respostas(List.of(c)).getFirst();
    }

    /**
     * A situação de um aluno no compromisso: realizado, falta, cancelado ou de volta a agendado, com a versão lida. A mesma
     * situação não muda nada (nem audita). Realizado e falta só depois do início (409 {@code COMPROMISSO_NO_FUTURO}). Sair do
     * cancelado confere o aluno ativo e, se o compromisso estava cancelado, reabre-o (responsável ativo e horário livre). O
     * último participante não cancelado que for cancelado cancela o compromisso, na mesma transação. Aluno que não está no
     * compromisso = 404. Sempre sobe a {@code versao} do compromisso.
     */
    @Transactional
    public CompromissoResponse alterarSituacaoDoAluno(UUID id, UUID alunoId, SituacaoCompromisso nova, Long versao) {
        travarConsultoria();
        Compromisso c = buscar(id);
        exigirVersao(c, versao);
        List<CompromissoAluno> todos = participantes.findByCompromissoId(c.getId());
        CompromissoAluno alvo = todos.stream().filter(p -> p.getAlunoId().equals(alunoId)).findFirst()
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado neste compromisso."));
        if (nova == alvo.getSituacao()) {
            return respostas(List.of(c)).getFirst();
        }
        if (SituacaoCompromisso.DEPOIS_DO_INICIO.contains(nova) && c.getInicio().isAfter(Instant.now())) {
            throw new ConflictException("Só dá para marcar como realizado ou falta depois do horário do compromisso.",
                    "COMPROMISSO_NO_FUTURO");
        }
        if (alvo.getSituacao() == SituacaoCompromisso.CANCELADO) {
            exigirAlunoParaMarcar(alunoId);
            if (c.isCancelado()) {
                exigirResponsavel(c.getResponsavelId());
                exigirHorarioLivre(c.getResponsavelId(), c.getInicio(), c.getDuracaoMinutos(), c.getId());
            }
        }
        alvo.alterarSituacao(nova);
        recalcularCancelado(c, todos);
        compromissos.saveAndFlush(c);
        auditoria.registrarEvento("COMPROMISSO_SITUACAO_ALTERADA", "COMPROMISSO", c.getId(),
                "Alterou a situação de um compromisso da agenda.");
        return respostas(List.of(c)).getFirst();
    }

    /**
     * Quais dos {@code alunoIds} já têm outro compromisso (não cancelado, e em que eles não estão cancelados) que sobrepõe
     * [{@code data} {@code hora}, + {@code duracaoMinutos}). Só aviso: nunca bloqueia, e devolve só id e nome (nada do outro
     * compromisso). Encostar não conta. {@code ignorar} é o próprio compromisso, ao remarcar. Aluno de outra consultoria
     * simplesmente não aparece.
     */
    @Transactional(readOnly = true)
    public List<AlunoOcupado> alunosOcupados(LocalDate data, LocalTime hora, int duracaoMinutos, Collection<UUID> alunoIds,
                                             UUID ignorar) {
        if (duracaoMinutos < AgendaDtos.DURACAO_MINIMA || duracaoMinutos > AgendaDtos.DURACAO_MAXIMA) {
            throw new BadRequestException("A duração precisa ser de " + AgendaDtos.DURACAO_MINIMA + " a "
                    + AgendaDtos.DURACAO_MAXIMA + " minutos.");
        }
        List<UUID> ids = exigirAlunoIds(new ArrayList<>(alunoIds));
        Instant inicio = inicioEmBrasilia(data, hora);
        List<UUID> ocupados = compromissos.alunosOcupados(TenantContext.get(), ids, inicio,
                Compromisso.fimDe(inicio, duracaoMinutos), ignorar);
        if (ocupados.isEmpty()) {
            return List.of();
        }
        return alunos.findAllById(ocupados).stream().map(a -> new AlunoOcupado(a.getId(), a.getNome()))
                .sorted(Comparator.comparing(AlunoOcupado::nome, String.CASE_INSENSITIVE_ORDER)).toList();
    }

    // ---- Aluno ----

    /**
     * Os próximos compromissos do aluno da sessão (ainda não terminados) em que a situação DELE é agendado ou cancelado, no
     * máximo {@value #PROXIMOS_DO_ALUNO}. Com a situação do próprio aluno; sem a lista de participantes, sem ids de aluno ou
     * da equipe e sem observação; com o nome do responsável (o aluno precisa saber com quem vai se encontrar).
     */
    @Transactional(readOnly = true)
    public List<CompromissoDoAluno> doAluno(UUID alunoId) {
        List<Object[]> lista = compromissos.proximosDoAluno(TenantContext.get(), alunoId, Instant.now(),
                SituacaoCompromisso.DO_ALUNO).stream().limit(PROXIMOS_DO_ALUNO).toList();
        Map<UUID, String> nomes = nomesDaEquipe(lista.stream().map(l -> ((Compromisso) l[0]).getResponsavelId()).toList());
        return lista.stream().map(l -> {
            Compromisso c = (Compromisso) l[0];
            return new CompromissoDoAluno(c.getId(), c.getInicio(), c.getFim(), data(c.getInicio()), hora(c.getInicio()),
                    hora(c.getFim()), c.getDuracaoMinutos(), c.getLocal(), (SituacaoCompromisso) l[1],
                    nomes.get(c.getResponsavelId()));
        }).toList();
    }

    // ---- Privacidade ----

    /**
     * Exportação do aluno (seção {@code compromissos}, com {@code AGENDA_LER}): todos os compromissos dele, com a situação
     * dele e sem os nomes dos outros participantes. Com mais de um participante a observação sai nula (texto compartilhado
     * da equipe, pode citar outro aluno); com um só continua como antes.
     */
    @Transactional(readOnly = true)
    public List<CompromissoExportado> exportar(UUID alunoId) {
        List<Object[]> lista = compromissos.doAluno(TenantContext.get(), alunoId);
        List<UUID> ids = lista.stream().map(l -> ((Compromisso) l[0]).getId()).toList();
        Map<UUID, Long> quantos = new HashMap<>();
        if (!ids.isEmpty()) {
            participantes.contarPorCompromisso(TenantContext.get(), ids).forEach(l -> quantos.put((UUID) l[0], (Long) l[1]));
        }
        Map<UUID, String> nomes = nomesDaEquipe(lista.stream().map(l -> ((Compromisso) l[0]).getResponsavelId()).toList());
        return lista.stream().map(l -> {
            Compromisso c = (Compromisso) l[0];
            boolean emGrupo = quantos.getOrDefault(c.getId(), 1L) > 1;
            return new CompromissoExportado(c.getId(), c.getInicio(), data(c.getInicio()), hora(c.getInicio()),
                    c.getDuracaoMinutos(), c.getLocal(), emGrupo ? null : c.getObservacao(), (SituacaoCompromisso) l[1],
                    nomes.get(c.getResponsavelId()), c.getCriadoEm());
        }).toList();
    }

    /**
     * Anonimização e "Excluir minha conta": na transação de quem chama, o aluno sai de todos os compromissos e os avisos
     * dele são apagados. O compromisso em que ele era o único participante é apagado (o CASCADE do banco leva o resto); nos
     * de grupo só a participação dele sai, a {@code versao} sobe e, se os que sobraram estão todos cancelados, o compromisso
     * passa a cancelado.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID consultoriaId, UUID alunoId) {
        avisos.apagarDoAluno(consultoriaId, alunoId);
        List<CompromissoAluno> dele = participantes.findByConsultoriaIdAndAlunoId(consultoriaId, alunoId);
        if (dele.isEmpty()) {
            return;
        }
        Map<UUID, List<CompromissoAluno>> porCompromisso = new HashMap<>();
        participantes.findByCompromissoIdIn(dele.stream().map(CompromissoAluno::getCompromissoId).toList())
                .forEach(p -> porCompromisso.computeIfAbsent(p.getCompromissoId(), k -> new ArrayList<>()).add(p));
        for (CompromissoAluno meu : dele) {
            List<CompromissoAluno> todos = porCompromisso.get(meu.getCompromissoId());
            participantes.delete(meu);
            if (todos.size() == 1) {
                compromissos.deleteById(meu.getCompromissoId());
                continue;
            }
            todos.remove(meu);
            compromissos.findById(meu.getCompromissoId()).ifPresent(c -> recalcularCancelado(c, todos));
        }
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

    /** De 1 a {@value AgendaDtos#ALUNOS_MAXIMO} alunos, sem repetir (400), na ordem recebida. */
    private static List<UUID> exigirAlunoIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > AgendaDtos.ALUNOS_MAXIMO || ids.contains(null)) {
            throw new BadRequestException("Escolha de 1 a " + AgendaDtos.ALUNOS_MAXIMO + " alunos.", "ALUNOS_INVALIDOS");
        }
        if (new HashSet<>(ids).size() != ids.size()) {
            throw new BadRequestException("Há aluno repetido na lista.", "ALUNOS_REPETIDOS");
        }
        return ids;
    }

    private static Map<UUID, CompromissoAluno> porAluno(List<CompromissoAluno> lista) {
        Map<UUID, CompromissoAluno> mapa = new LinkedHashMap<>();
        lista.forEach(p -> mapa.put(p.getAlunoId(), p));
        return mapa;
    }

    /**
     * A regra única do cancelamento: o compromisso está cancelado exatamente quando todos os participantes estão. Chamada
     * depois de qualquer mudança de situação por aluno; sobe a {@code versao} do compromisso de qualquer forma.
     */
    private static void recalcularCancelado(Compromisso c, Collection<CompromissoAluno> participantes) {
        boolean todosCancelados = participantes.stream().allMatch(p -> p.getSituacao() == SituacaoCompromisso.CANCELADO);
        if (todosCancelados != c.isCancelado()) {
            c.definirCancelado(todosCancelados);
        } else {
            c.tocar();
        }
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
    static Instant inicioEmBrasilia(LocalDate data, LocalTime hora) {
        return ZonedDateTime.of(data, hora.truncatedTo(ChronoUnit.MINUTES), Fuso.BRASILIA).toInstant();
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

    /** Respostas em lote: participantes dos compromissos numa consulta e nomes dos alunos e da equipe em outras duas. */
    private List<CompromissoResponse> respostas(List<Compromisso> lista) {
        Map<UUID, List<CompromissoAluno>> doCompromisso = new HashMap<>();
        if (!lista.isEmpty()) {
            participantes.findByCompromissoIdIn(lista.stream().map(Compromisso::getId).toList())
                    .forEach(p -> doCompromisso.computeIfAbsent(p.getCompromissoId(), k -> new ArrayList<>()).add(p));
        }
        Map<UUID, String> nomesAlunos = new HashMap<>();
        List<UUID> idsAlunos = doCompromisso.values().stream().flatMap(List::stream).map(CompromissoAluno::getAlunoId)
                .distinct().toList();
        if (!idsAlunos.isEmpty()) {
            alunos.findAllById(idsAlunos).forEach(a -> nomesAlunos.put(a.getId(), a.getNome()));
        }
        Map<UUID, String> nomesEquipe = nomesDaEquipe(lista.stream().map(Compromisso::getResponsavelId).toList());
        boolean veObservacao = AcessoAtual.pode("ALUNO_SENSIVEL_LER");
        return lista.stream().map(c -> new CompromissoResponse(c.getId(), c.getResponsavelId(),
                nomesEquipe.get(c.getResponsavelId()), c.getInicio(), c.getFim(), data(c.getInicio()), hora(c.getInicio()),
                hora(c.getFim()), c.getDuracaoMinutos(), c.getLocal(), veObservacao ? c.getObservacao() : null,
                c.isCancelado(), doCompromisso.getOrDefault(c.getId(), List.of()).stream()
                        .map(p -> new Participante(p.getAlunoId(), nomesAlunos.get(p.getAlunoId()), p.getSituacao()))
                        .sorted(Comparator.comparing(Participante::nome, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                                .thenComparing(Participante::id)).toList(),
                c.getVersao() == null ? 0 : c.getVersao())).toList();
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
