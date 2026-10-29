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
import br.com.treinos.api.web.ConflitoComRecursoException;
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
import java.util.TreeSet;
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
    /** Id que nunca existe, para a consulta de conflito quando não há nada a ignorar. */
    private static final UUID NINGUEM = new UUID(0L, 0L);

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

    /**
     * Marca um compromisso ou, com {@code repeticao}, uma série: cada ocorrência é um compromisso de verdade (mesmo
     * {@code serieId}, mesmos participantes e dados), até {@value AgendaDtos#OCORRENCIAS_MAXIMO}; a regra das datas está
     * em {@link RepeticaoDeCompromisso}. O conflito do responsável é conferido em CADA ocorrência e, se alguma conflitar,
     * a criação inteira é recusada (nada é gravado): 409 {@code HORARIO_OCUPADO} com as datas em {@code fieldErrors}
     * ({@code datasEmConflito}). Responde com a primeira ocorrência.
     */
    @Transactional
    @Auditar(acao = "COMPROMISSO_CRIADO", entidade = "COMPROMISSO", resumo = "Marcou um compromisso na agenda.")
    public CompromissoResponse criar(CompromissoRequest r, UUID quem) {
        travarConsultoria();
        List<UUID> alunoIds = exigirAlunoIds(r.alunoIds());
        alunoIds.forEach(this::exigirAlunoParaMarcar);
        UUID responsavel = exigirResponsavel(r.responsavelId());
        List<LocalDate> dias = r.repeticao() == null ? List.of(r.data())
                : RepeticaoDeCompromisso.expandir(r.data(), r.repeticao());
        List<Instant> inicios = dias.stream().map(d -> inicioEmBrasilia(d, r.hora())).toList();
        exigirHorariosLivres(inicios.stream().map(i -> new Janela(responsavel, i, Compromisso.fimDe(i, r.duracaoMinutos())))
                .toList(), List.of());
        UUID serieId = r.repeticao() == null ? null : UUID.randomUUID();
        String observacao = AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR") ? Buscas.opcional(r.observacao()) : null;
        List<Compromisso> criados = new ArrayList<>();
        List<CompromissoAluno> novosParticipantes = new ArrayList<>();
        List<MudancaDoAluno> mudancas = new ArrayList<>();
        for (Instant inicio : inicios) {
            Compromisso c = new Compromisso(responsavel, inicio, r.duracaoMinutos(), Buscas.opcional(r.local()), observacao,
                    quem);
            c.pertencerASerie(serieId);
            criados.add(compromissos.save(c));
        }
        compromissos.flush();
        for (Compromisso c : criados) {
            for (UUID a : alunoIds) {
                novosParticipantes.add(new CompromissoAluno(c.getId(), a, SituacaoCompromisso.AGENDADO));
                mudancas.add(new MudancaDoAluno(c, a, Mudanca.ENTROU));
            }
        }
        participantes.saveAll(novosParticipantes);
        registrarAvisos(mudancas);
        return respostas(List.of(criados.getFirst())).getFirst();
    }

    /**
     * Remarcar ou corrigir (alunos, responsável, data, hora, duração, local, observação), com a versão lida (409
     * {@code CONFLITO_EDICAO}). A lista de alunos é trocada inteira: quem entra nasce {@code AGENDADO} (ou {@code CANCELADO},
     * se o compromisso está cancelado), quem sai é apagado do compromisso e quem fica mantém a situação. Exige alunos ativos
     * e não anonimizados (409 {@code ALUNO_INATIVO}/{@code ALUNO_ANONIMIZADO}) para quem entra e para quem fica sem estar
     * cancelado, e passa pela mesma conferência de horário do responsável, menos quando o compromisso fica cancelado (que
     * não ocupa horário).
     *
     * <p><b>Série.</b> Com {@code escopo} {@code SEGUINTES} ou {@code TODAS} o mesmo pedido vale para várias ocorrências
     * ({@link #ocorrenciasDoEscopo}); cada uma conserva o próprio dia e recebe a hora, duração, local, responsável,
     * observação e alunos do pedido (a observação de quem não tem {@code ALUNO_SENSIVEL_ALTERAR} fica a de cada uma). A data
     * só muda em {@code ESTA} (senão 400 {@code DATA_SO_NESTA_OCORRENCIA}). Cada ocorrência é conferida no conflito e, se
     * alguma conflitar, nada muda (409 com as datas). A {@code versao} do pedido é a da ocorrência escolhida: as outras o
     * cliente nunca viu, então cada uma é lida aqui, dentro da trava da consultoria que serializa toda escrita da agenda, e
     * o {@code @Version} protege a gravação. Responde com a ocorrência escolhida, já com o estado novo.
     */
    @Transactional
    @Auditar(acao = "COMPROMISSO_ALTERADO", entidade = "COMPROMISSO", resumo = "Alterou um compromisso da agenda.")
    public CompromissoResponse alterar(UUID id, CompromissoRequest r, EscopoDaSerie escopo) {
        travarConsultoria();
        if (r.repeticao() != null) {
            throw new BadRequestException("A repetição só vale ao marcar um compromisso novo.", "REPETICAO_SO_AO_CRIAR");
        }
        Compromisso escolhida = buscar(id);
        exigirVersao(escolhida, r.versao());
        List<Compromisso> alvo = ocorrenciasDoEscopo(escolhida, escopo);
        if (escopo != EscopoDaSerie.ESTA && !r.data().equals(data(escolhida.getInicio()))) {
            throw new BadRequestException("A data só muda em \"somente esta ocorrência\".", "DATA_SO_NESTA_OCORRENCIA");
        }
        List<UUID> alunoIds = exigirAlunoIds(r.alunoIds());
        Map<UUID, List<CompromissoAluno>> doCompromisso = participantesPorCompromisso(alvo);
        List<PlanoDeAlteracao> planos = new ArrayList<>();
        for (Compromisso c : alvo) {
            Map<UUID, CompromissoAluno> atuais = porAluno(doCompromisso.getOrDefault(c.getId(), List.of()));
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
            LocalDate dia = escopo == EscopoDaSerie.ESTA ? r.data() : data(c.getInicio());
            planos.add(new PlanoDeAlteracao(c, entram, ficam,
                    atuais.values().stream().filter(p -> !alunoIds.contains(p.getAlunoId())).toList(), ficaCancelado,
                    inicioEmBrasilia(dia, r.hora())));
        }
        UUID responsavel = exigirResponsavel(r.responsavelId());
        // Todas as conferências antes de mexer em qualquer entidade (a consulta dispara o flush do que já mudou).
        exigirHorariosLivres(planos.stream().filter(p -> !p.ficaCancelado())
                .map(p -> new Janela(responsavel, p.novoInicio(), Compromisso.fimDe(p.novoInicio(), r.duracaoMinutos())))
                .toList(), alvo.stream().map(Compromisso::getId).toList());
        boolean pode = AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR");
        List<MudancaDoAluno> mudancas = new ArrayList<>();
        for (PlanoDeAlteracao p : planos) {
            Compromisso c = p.compromisso();
            boolean remarcou = !p.novoInicio().equals(c.getInicio()) || r.duracaoMinutos() != c.getDuracaoMinutos();
            String observacao = pode ? Buscas.opcional(r.observacao()) : c.getObservacao();
            c.alterar(responsavel, p.novoInicio(), r.duracaoMinutos(), Buscas.opcional(r.local()), observacao);
            p.saem().forEach(participantes::delete);
            SituacaoCompromisso nasce = c.isCancelado() ? SituacaoCompromisso.CANCELADO : SituacaoCompromisso.AGENDADO;
            participantes.saveAll(p.entram().stream().map(a -> new CompromissoAluno(c.getId(), a, nasce)).toList());
            if (c.isCancelado() != p.ficaCancelado()) {
                c.definirCancelado(p.ficaCancelado());
            }
            p.entram().forEach(a -> mudancas.add(new MudancaDoAluno(c, a, Mudanca.ENTROU)));
            p.saem().forEach(s -> mudancas.add(new MudancaDoAluno(c, s.getAlunoId(), Mudanca.SAIU)));
            if (remarcou) {
                p.ficam().stream().filter(f -> f.getSituacao() != SituacaoCompromisso.CANCELADO)
                        .forEach(f -> mudancas.add(new MudancaDoAluno(c, f.getAlunoId(), Mudanca.REMARCADO)));
            }
        }
        compromissos.saveAllAndFlush(alvo);
        registrarAvisos(mudancas);
        return respostas(List.of(escolhida)).getFirst();
    }

    /**
     * Cancela o compromisso inteiro (todos os participantes ficam cancelados e o horário do responsável é liberado) ou o
     * reabre (todos voltam a agendado). A mesma situação não muda nada (nem audita). Reabrir volta a ocupar o horário:
     * exige alunos ativos, responsável ativo e o horário livre, como marcar de novo.
     *
     * <p><b>Série.</b> Com {@code escopo} {@code SEGUINTES} ou {@code TODAS} a mesma operação vale para as ocorrências do
     * escopo; as que já estão na situação pedida ficam como estão. Reabrir confere o horário de cada uma e, se alguma
     * conflitar, nada muda (409 {@code HORARIO_OCUPADO} com as datas). A {@code versao} é a da ocorrência escolhida (ver
     * {@link #alterar}).
     */
    @Transactional
    public CompromissoResponse alterarCancelamento(UUID id, boolean cancelar, Long versao, EscopoDaSerie escopo) {
        travarConsultoria();
        Compromisso c = buscar(id);
        exigirVersao(c, versao);
        List<Compromisso> mudam = ocorrenciasDoEscopo(c, escopo).stream().filter(o -> o.isCancelado() != cancelar).toList();
        if (mudam.isEmpty()) {
            return respostas(List.of(c)).getFirst();
        }
        Map<UUID, List<CompromissoAluno>> doCompromisso = participantesPorCompromisso(mudam);
        if (!cancelar) {
            List<Janela> janelas = new ArrayList<>();
            for (Compromisso o : mudam) {
                doCompromisso.getOrDefault(o.getId(), List.of()).forEach(p -> exigirAlunoParaMarcar(p.getAlunoId()));
                exigirResponsavel(o.getResponsavelId());
                janelas.add(new Janela(o.getResponsavelId(), o.getInicio(), o.getFim()));
            }
            exigirHorariosLivres(janelas, mudam.stream().map(Compromisso::getId).toList());
        }
        List<MudancaDoAluno> mudancas = new ArrayList<>();
        for (Compromisso o : mudam) {
            for (CompromissoAluno p : doCompromisso.getOrDefault(o.getId(), List.of())) {
                if (cancelar && p.getSituacao() != SituacaoCompromisso.CANCELADO) {
                    mudancas.add(new MudancaDoAluno(o, p.getAlunoId(), Mudanca.CANCELADO));
                } else if (!cancelar) {
                    mudancas.add(new MudancaDoAluno(o, p.getAlunoId(), Mudanca.REABERTO));
                }
                p.alterarSituacao(cancelar ? SituacaoCompromisso.CANCELADO : SituacaoCompromisso.AGENDADO);
            }
            o.definirCancelado(cancelar);
        }
        compromissos.saveAllAndFlush(mudam);
        auditoria.registrarEvento("COMPROMISSO_SITUACAO_ALTERADA", "COMPROMISSO", c.getId(),
                "Alterou a situação de um compromisso da agenda.");
        registrarAvisos(mudancas);
        return respostas(List.of(c)).getFirst();
    }

    /**
     * A situação de um aluno no compromisso: realizado, falta, cancelado ou de volta a agendado, com a versão lida. A mesma
     * situação não muda nada (nem audita). Realizado e falta só depois do início (409 {@code COMPROMISSO_NO_FUTURO}). Sair do
     * cancelado confere o aluno ativo e, se o compromisso estava cancelado, reabre-o (responsável ativo e horário livre). O
     * último participante não cancelado que for cancelado cancela o compromisso, na mesma transação. Aluno que não está no
     * compromisso = 404. Sempre sobe a {@code versao} do compromisso.
     *
     * <p><b>Série.</b> Com {@code escopo} {@code SEGUINTES} ou {@code TODAS} a mesma situação vale para o aluno em cada
     * ocorrência do escopo em que ele participa (as outras são puladas; ele precisa estar na escolhida, senão 404). Só
     * cancelar e voltar a agendado: realizado e falta são sempre de uma ocorrência só (400
     * {@code SITUACAO_SO_NESTA_OCORRENCIA}). Se alguma ocorrência reaberta conflitar no horário, nada muda (409 com as
     * datas). A {@code versao} é a da escolhida (ver {@link #alterar}).
     */
    @Transactional
    public CompromissoResponse alterarSituacaoDoAluno(UUID id, UUID alunoId, SituacaoCompromisso nova, Long versao,
                                                      EscopoDaSerie escopo) {
        travarConsultoria();
        Compromisso c = buscar(id);
        exigirVersao(c, versao);
        Map<UUID, List<CompromissoAluno>> doCompromisso = participantesPorCompromisso(List.of(c));
        boolean naEscolhida = doCompromisso.getOrDefault(c.getId(), List.of()).stream()
                .anyMatch(p -> p.getAlunoId().equals(alunoId));
        if (!naEscolhida) {
            throw new NaoEncontradoException("Aluno não encontrado neste compromisso.");
        }
        if (escopo != EscopoDaSerie.ESTA && SituacaoCompromisso.DEPOIS_DO_INICIO.contains(nova)) {
            throw new BadRequestException("Realizado e falta valem para uma ocorrência só.", "SITUACAO_SO_NESTA_OCORRENCIA");
        }
        List<Compromisso> alvo = ocorrenciasDoEscopo(c, escopo);
        if (escopo != EscopoDaSerie.ESTA) {
            doCompromisso = participantesPorCompromisso(alvo);
        }
        List<Compromisso> mudam = new ArrayList<>();
        Map<UUID, CompromissoAluno> doAluno = new HashMap<>();
        for (Compromisso o : alvo) {
            List<CompromissoAluno> todos = doCompromisso.getOrDefault(o.getId(), List.of());
            todos.stream().filter(p -> p.getAlunoId().equals(alunoId) && p.getSituacao() != nova).findFirst()
                    .ifPresent(p -> {
                        mudam.add(o);
                        doAluno.put(o.getId(), p);
                    });
        }
        if (mudam.isEmpty()) {
            return respostas(List.of(c)).getFirst();
        }
        List<Janela> reabertas = new ArrayList<>();
        for (Compromisso o : mudam) {
            CompromissoAluno p = doAluno.get(o.getId());
            if (SituacaoCompromisso.DEPOIS_DO_INICIO.contains(nova) && o.getInicio().isAfter(Instant.now())) {
                throw new ConflictException("Só dá para marcar como realizado ou falta depois do horário do compromisso.",
                        "COMPROMISSO_NO_FUTURO");
            }
            if (p.getSituacao() == SituacaoCompromisso.CANCELADO) {
                exigirAlunoParaMarcar(alunoId);
                if (o.isCancelado()) {
                    exigirResponsavel(o.getResponsavelId());
                    reabertas.add(new Janela(o.getResponsavelId(), o.getInicio(), o.getFim()));
                }
            }
        }
        exigirHorariosLivres(reabertas, mudam.stream().map(Compromisso::getId).toList());
        List<MudancaDoAluno> mudancas = new ArrayList<>();
        for (Compromisso o : mudam) {
            CompromissoAluno p = doAluno.get(o.getId());
            if (nova == SituacaoCompromisso.CANCELADO) {
                mudancas.add(new MudancaDoAluno(o, alunoId, Mudanca.CANCELADO));
            } else if (p.getSituacao() == SituacaoCompromisso.CANCELADO) {
                mudancas.add(new MudancaDoAluno(o, alunoId, Mudanca.REABERTO));
            }
            p.alterarSituacao(nova);
            recalcularCancelado(o, doCompromisso.get(o.getId()));
        }
        compromissos.saveAllAndFlush(mudam);
        auditoria.registrarEvento("COMPROMISSO_SITUACAO_ALTERADA", "COMPROMISSO", c.getId(),
                "Alterou a situação de um compromisso da agenda.");
        registrarAvisos(mudancas);
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

    /** Um horário que vai ocupar a agenda de um responsável. */
    private record Janela(UUID responsavelId, Instant inicio, Instant fim) { }

    /**
     * Confere todos os horários e só então recusa: 409 {@code HORARIO_OCUPADO} com a data (de Brasília) de CADA um que
     * conflita em {@code fieldErrors} ({@code datasEmConflito}), sem nada do compromisso que ocupa o horário. Além dos já
     * gravados (menos os {@code ignorar}: o próprio ao remarcar, ou todas as ocorrências do escopo, para uma não conflitar
     * com a posição antiga da outra), confere os horários entre si (na mesma série nunca se sobrepõem, mas uma ocorrência
     * cancelada e movida antes pode ter ficado sobre outra).
     */
    private void exigirHorariosLivres(List<Janela> janelas, Collection<UUID> ignorar) {
        Collection<UUID> ignorados = ignorar.isEmpty() ? List.of(NINGUEM) : ignorar;
        Set<String> datas = new TreeSet<>();
        for (int i = 0; i < janelas.size(); i++) {
            Janela j = janelas.get(i);
            boolean ocupado = compromissos.sobrepostos(j.responsavelId(), j.inicio(), j.fim(), ignorados) > 0;
            for (int k = i + 1; k < janelas.size() && !ocupado; k++) {
                Janela outra = janelas.get(k);
                if (outra.responsavelId().equals(j.responsavelId()) && outra.inicio().isBefore(j.fim())
                        && outra.fim().isAfter(j.inicio())) {
                    ocupado = true;
                    datas.add(data(outra.inicio()).toString());
                }
            }
            if (ocupado) {
                datas.add(data(j.inicio()).toString());
            }
        }
        if (!datas.isEmpty()) {
            throw new ConflitoComRecursoException(datas.size() == 1
                    ? "O responsável já tem um compromisso nesse horário. Escolha outro horário."
                    : "O responsável já tem compromisso nesse horário em " + datas.size() + " datas. Escolha outro horário.",
                    "HORARIO_OCUPADO", "datasEmConflito", List.copyOf(datas));
        }
    }

    /**
     * As ocorrências que a operação atinge. {@code ESTA}: só a escolhida. {@code SEGUINTES}: as da série que começam a partir
     * da escolhida (inclusive) e ainda não terminaram. {@code TODAS}: as da série que ainda não começaram. As passadas nunca
     * entram, então a escolhida pode ficar de fora (já terminou, ou já começou em {@code TODAS}). Escopo diferente de
     * {@code ESTA} num compromisso avulso = 400 {@code COMPROMISSO_SEM_SERIE}; escopo sem nenhuma ocorrência a alterar = 409
     * {@code SERIE_SEM_OCORRENCIAS}. Em ordem de início.
     */
    private List<Compromisso> ocorrenciasDoEscopo(Compromisso escolhida, EscopoDaSerie escopo) {
        if (escopo == EscopoDaSerie.ESTA) {
            return List.of(escolhida);
        }
        if (escolhida.getSerieId() == null) {
            throw new BadRequestException("Este compromisso não faz parte de uma série. Use o escopo ESTA.",
                    "COMPROMISSO_SEM_SERIE");
        }
        Instant agora = Instant.now();
        List<Compromisso> alvo = compromissos.findBySerieIdOrderByInicioAscIdAsc(escolhida.getSerieId()).stream()
                .filter(o -> escopo == EscopoDaSerie.TODAS ? o.getInicio().isAfter(agora)
                        : !o.getInicio().isBefore(escolhida.getInicio()) && o.getFim().isAfter(agora))
                .toList();
        if (alvo.isEmpty()) {
            throw new ConflictException("Nenhuma ocorrência desta série pode mais ser alterada: as que já passaram não mudam.",
                    "SERIE_SEM_OCORRENCIAS");
        }
        return alvo;
    }

    private Map<UUID, List<CompromissoAluno>> participantesPorCompromisso(Collection<Compromisso> lista) {
        Map<UUID, List<CompromissoAluno>> doCompromisso = new HashMap<>();
        if (!lista.isEmpty()) {
            participantes.findByCompromissoIdIn(lista.stream().map(Compromisso::getId).toList())
                    .forEach(p -> doCompromisso.computeIfAbsent(p.getCompromissoId(), k -> new ArrayList<>()).add(p));
        }
        return doCompromisso;
    }

    /** O que mudou para um aluno num compromisso: a matéria-prima do aviso dentro do app (D12, passo 3). */
    private enum Mudanca { ENTROU, SAIU, REMARCADO, CANCELADO, REABERTO }

    private record MudancaDoAluno(Compromisso compromisso, UUID alunoId, Mudanca mudanca) { }

    /** O que {@link #alterar} decidiu para uma ocorrência, antes de mexer em qualquer entidade. */
    private record PlanoDeAlteracao(Compromisso compromisso, List<UUID> entram, List<CompromissoAluno> ficam,
                                    List<CompromissoAluno> saem, boolean ficaCancelado, Instant novoInicio) { }

    /**
     * Ponto de extensão do passo 3 (aviso dentro do app, D12): chamado uma vez no fim de cada operação que muda
     * compromissos (marcar, alterar, cancelar, mudar a situação de um aluno), na mesma transação, com TODAS as mudanças por
     * aluno de TODAS as ocorrências tocadas, para gerar um aviso por aluno por operação. Hoje não faz nada (por
     * isso o {@code UnusedVariable} do Error Prone é suprimido aqui; tire a supressão ao implementar).
     */
    @SuppressWarnings("UnusedVariable")
    private void registrarAvisos(List<MudancaDoAluno> mudancas) {
        // Passo 3: gerar o aviso de cada aluno a partir das mudanças (sem observação, local nem nome de outro aluno).
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
        Map<UUID, List<CompromissoAluno>> doCompromisso = participantesPorCompromisso(lista);
        // Posição e total só dos que são de série (os avulsos não pesam).
        Map<UUID, int[]> naSerie = new HashMap<>();
        List<UUID> deSerie = lista.stream().filter(c -> c.getSerieId() != null).map(Compromisso::getId).toList();
        if (!deSerie.isEmpty()) {
            compromissos.posicoesNaSerie(deSerie).forEach(l ->
                    naSerie.put((UUID) l[0], new int[] {((Long) l[1]).intValue(), ((Long) l[2]).intValue()}));
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
                c.getVersao() == null ? 0 : c.getVersao(), c.getSerieId(),
                naSerie.containsKey(c.getId()) ? naSerie.get(c.getId())[0] : null,
                naSerie.containsKey(c.getId()) ? naSerie.get(c.getId())[1] : null)).toList();
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
