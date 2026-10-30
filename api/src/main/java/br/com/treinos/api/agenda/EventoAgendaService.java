package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.CruzamentoRequest;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.CruzamentoResponse;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.EventoRequest;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.EventoResponse;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.OcorrenciaDeEvento;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.RepeticaoDeEvento;
import br.com.treinos.api.agenda.RecorrenciaDeEvento.Regra;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Eventos SEM aluno das agendas pessoais (D3, D4, D9, D10, D17). O dono é sempre quem está na sessão: evento de outro
 * membro ou de outra consultoria = 404, nunca 403. A série guarda a REGRA; esta classe a expande na leitura, aplica as
 * exceções (ocorrência cancelada, alterada ou movida) e o app nunca expande.
 *
 * <p><b>Escopos</b> ({@link EscopoDaSerie}) de editar e excluir numa série:
 * <ul>
 *   <li>{@code ESTA}: grava uma exceção na ocorrência ({@code ocorrencia} = o dia da regra, obrigatório). Só guarda o que
 *       difere do evento (o resto herda); em edição a regra do pedido é ignorada e a agenda não muda (400).</li>
 *   <li>{@code SEGUINTES}: corta a série no dia anterior à ocorrência ({@code repete_ate}) e cria outro evento a partir
 *       dela, com o conteúdo e a regra do pedido; na primeira ocorrência equivale a {@code TODAS}. Se a série tinha
 *       {@code vezes} e o pedido repete a mesma regra com o mesmo {@code vezes}, a série nova leva só o que sobrou, para o
 *       total não crescer. Das exceções de {@code ocorrencia} em diante só as canceladas passam para a série nova.</li>
 *   <li>{@code TODAS}: edita a regra e o conteúdo; o primeiro dia da série não muda (a {@code data} do pedido tem de ser a da
 *       ocorrência), e as exceções que a regra nova não alcança mais saem.</li>
 * </ul>
 * Evento avulso só aceita {@code ESTA} (que o altera ou exclui por inteiro). Toda mudança sobe a {@code versao} do evento,
 * inclusive as que só mexem em exceções.
 *
 * <p><b>Privacidade.</b> Título, local e descrição nunca vão a log nem à auditoria (resumos fixos). Não trava a consultoria
 * (o plano dispensa para evento pessoal). Nenhuma consulta nativa.
 */
@Service
public class EventoAgendaService {

    /** Máximo de eventos (séries) por membro (D17). */
    static final int EVENTOS_MAXIMO = 1000;
    /** Maior período de uma listagem, em dias (inclusive as pontas), igual ao dos compromissos. */
    static final int JANELA_MAXIMA_DIAS = AgendaService.JANELA_MAXIMA_DIAS;
    private static final UUID NINGUEM = new UUID(0L, 0L);
    /** Quantas datas a resposta de {@link #cruzamentos} traz. */
    static final int CRUZAMENTOS_DATAS = 5;
    /** Até onde {@link #cruzamentos} olha: este tanto de anos a partir do primeiro dia do evento (a ponta é inclusive). */
    static final int CRUZAMENTOS_ALCANCE_EM_ANOS = 1;
    /**
     * Tetos de segurança de {@link #cruzamentos}. Nenhuma regra válida passa de 367 ocorrências em um ano (a diária), então
     * 400 do evento pedido nunca é alcançado; 20.000 ocorrências dos outros eventos cobrem, por exemplo, 50 eventos
     * diários. Estourado um deles, a resposta sai com {@code incompleto} e a conta pode ser maior.
     */
    static final int CRUZAMENTOS_OCORRENCIAS_MAXIMO = 400;
    static final int CRUZAMENTOS_EXISTENTES_MAXIMO = 20_000;

    private final EventoAgendaRepository eventos;
    private final ExcecaoDeEventoRepository excecoes;
    private final AgendaPessoalService agendas;
    private final CompromissoRepository compromissos;
    private final Auditoria auditoria;

    public EventoAgendaService(EventoAgendaRepository eventos, ExcecaoDeEventoRepository excecoes,
                               AgendaPessoalService agendas, CompromissoRepository compromissos, Auditoria auditoria) {
        this.eventos = eventos;
        this.excecoes = excecoes;
        this.agendas = agendas;
        this.compromissos = compromissos;
        this.auditoria = auditoria;
    }

    // ---- Leitura ----

    /**
     * As ocorrências dos eventos do dono que tocam os dias [{@code de}, {@code ate}] de Brasília (padrão: hoje e os 6
     * seguintes), já expandidas e com as exceções aplicadas, filtradas por {@code agendas} (ids de outro dono são
     * ignorados em silêncio). Mais de {@value #JANELA_MAXIMA_DIAS} dias, ou {@code ate} antes de {@code de}: 400
     * {@code PERIODO_INVALIDO}.
     */
    @Transactional(readOnly = true)
    public List<OcorrenciaDeEvento> listar(UUID dono, LocalDate de, LocalDate ate, Collection<UUID> agendasPedidas) {
        LocalDate inicio = de == null ? LocalDate.now(Fuso.BRASILIA) : de;
        LocalDate fim = ate == null ? inicio.plusDays(6) : ate;
        exigirPeriodo(inicio, fim, JANELA_MAXIMA_DIAS);
        List<Efetiva> lista = efetivas(dono, inicio, fim, agendasPedidas);
        return lista.stream().sorted(PELO_HORARIO).map(EventoAgendaService::ocorrencia).toList();
    }

    /**
     * Quantas ocorrências tocam cada dia de [{@code de}, {@code ate}] (uma ocorrência conta em todo dia que ela toca).
     * Só contagem: nada de texto. Quem chama já limitou o período.
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, Integer> contagemPorDia(UUID dono, LocalDate de, LocalDate ate, Collection<UUID> agendasPedidas) {
        Map<LocalDate, Integer> dias = new TreeMap<>();
        for (Efetiva f : efetivas(dono, de, ate, agendasPedidas)) {
            Instant fim = f.fim();
            LocalDate ultimo = f.diaInteiro() ? f.data() : AgendaService.data(fim.minusNanos(1));
            for (LocalDate d = f.data(); !d.isAfter(ultimo); d = d.plusDays(1)) {
                if (!d.isBefore(de) && !d.isAfter(ate)) {
                    dias.merge(d, 1, Integer::sum);
                }
            }
        }
        return dias;
    }

    /**
     * O aviso "este evento cruza outro seu?" para o que está sendo montado, sem gravar nada (só leitura). Expande a
     * repetição do pedido pela mesma {@link RecorrenciaDeEvento} do salvar, de seu primeiro dia até um ano depois (inclusive),
     * e conta as ocorrências que cruzam alguma ocorrência de OUTRO evento do membro (todas as agendas; as exceções já
     * aplicadas: cancelada não conta, movida vale onde caiu). Cruzar é {@code inicio < fim do outro e fim > inicio do outro}
     * (encostar não cruza); dia inteiro não entra, em nenhum dos lados, como no aviso da tela. Os compromissos NÃO
     * cancelados em que o membro é o responsável entram como segunda fonte, pelo mesmo critério do {@code HORARIO_OCUPADO}
     * ({@link CompromissoRepository#horariosNaoCanceladosDoResponsavel}, par de {@code sobrepostos}), e contam no mesmo teto de
     * {@link #CRUZAMENTOS_EXISTENTES_MAXIMO}; só o horário deles é lido (nunca aluno, local, observação ou id).
     * {@code eventoId} (a edição) tira todas as ocorrências do próprio evento; evento de outro membro ou de outra
     * consultoria = 404. Devolve só a contagem e as primeiras datas; nunca texto de outro evento.
     */
    @Transactional(readOnly = true)
    public CruzamentoResponse cruzamentos(UUID dono, CruzamentoRequest r) {
        Regra regra = regraDe(r.repeticao());
        RecorrenciaDeEvento.validar(r.data(), regra);
        if (r.eventoId() != null) {
            buscar(dono, r.eventoId());
        }
        if (r.diaInteiro()) {
            return new CruzamentoResponse(0, List.of(), false);
        }
        if (r.hora() == null || r.duracaoMinutos() == null) {
            throw invalido("Informe a hora e a duração, ou marque o dia inteiro.");
        }
        LocalDate primeira = RecorrenciaDeEvento.primeira(r.data(), regra);
        LocalDate limite = primeira.plusYears(CRUZAMENTOS_ALCANCE_EM_ANOS);
        List<LocalDate> dias = RecorrenciaDeEvento.expandir(r.data(), regra, primeira, limite);
        boolean incompleto = dias.size() > CRUZAMENTOS_OCORRENCIAS_MAXIMO;
        if (incompleto) {
            dias = dias.subList(0, CRUZAMENTOS_OCORRENCIAS_MAXIMO);
        }
        // Um dia a mais no fim: a última ocorrência pode atravessar a meia-noite e cruzar o que começa no dia seguinte.
        List<Efetiva> existentes = efetivas(dono, primeira, limite.plusDays(1), null, CRUZAMENTOS_EXISTENTES_MAXIMO);
        List<Instant[]> faixas = new ArrayList<>();
        for (Efetiva f : existentes) {
            if (!f.diaInteiro() && !f.evento().getId().equals(r.eventoId())) {
                faixas.add(new Instant[]{f.inicio(), f.fim()});
            }
        }
        // Segunda fonte: os compromissos do membro, no mesmo intervalo (de 00:00 de `primeira` até o fim de `limite + 1`).
        Instant de = AgendaService.inicioEmBrasilia(primeira, LocalTime.MIDNIGHT);
        Instant ate = AgendaService.inicioEmBrasilia(limite.plusDays(2), LocalTime.MIDNIGHT);
        List<Object[]> deCompromissos = compromissos.horariosNaoCanceladosDoResponsavel(dono, de, ate,
                PageRequest.of(0, CRUZAMENTOS_EXISTENTES_MAXIMO + 1));
        for (Object[] h : deCompromissos) {
            faixas.add(new Instant[]{(Instant) h[0], (Instant) h[1]});
        }
        incompleto = incompleto || existentes.size() + deCompromissos.size() > CRUZAMENTOS_EXISTENTES_MAXIMO;
        List<LocalDate> cruzam = new ArrayList<>();
        for (LocalDate dia : dias) {
            Instant inicio = AgendaService.inicioEmBrasilia(dia, r.hora());
            Instant fim = inicio.plus(r.duracaoMinutos(), ChronoUnit.MINUTES);
            for (Instant[] outra : faixas) {
                if (outra[0].isBefore(fim) && outra[1].isAfter(inicio)) {
                    cruzam.add(dia);
                    break;
                }
            }
        }
        return new CruzamentoResponse(cruzam.size(), cruzam.stream().limit(CRUZAMENTOS_DATAS).toList(), incompleto);
    }

    /** O evento (a regra) e a ocorrência pedida em {@code ocorrencia} (404 se não existe) ou, sem ela, a primeira. */
    @Transactional(readOnly = true)
    public EventoResponse detalhe(UUID dono, UUID id, LocalDate ocorrencia) {
        EventoAgenda e = buscar(dono, id);
        if (ocorrencia != null) {
            Efetiva f = ocorrenciaDe(e, ocorrencia).orElseThrow(EventoAgendaService::ocorrenciaNaoEncontrada);
            return resposta(e, f);
        }
        return resposta(e, ocorrenciaDe(e, e.getDataInicio()).orElse(null));
    }

    // ---- Escrita ----

    @Transactional
    public EventoResponse criar(UUID dono, EventoRequest r) {
        Conteudo c = conteudo(r);
        agendas.buscar(dono, r.agendaId());
        Regra regra = regraDe(r.repeticao());
        RecorrenciaDeEvento.validar(c.data(), regra);
        exigirEspaco(dono);
        EventoAgenda e = new EventoAgenda(dono);
        e.definirConteudo(r.agendaId(), c.titulo(), c.descricao(), c.local(), RecorrenciaDeEvento.primeira(c.data(), regra),
                c.hora(), c.duracao());
        e.definirRegra(regra);
        e = eventos.saveAndFlush(e);
        auditoria.registrarEvento("EVENTO_CRIADO", "EVENTO_AGENDA", e.getId(), "Criou um evento na agenda pessoal.");
        return resposta(e, ocorrenciaDe(e, e.getDataInicio()).orElse(null));
    }

    /**
     * Edita o evento no {@code escopo} dado (ver a descrição da classe). {@code ocorrencia}: o dia da regra da ocorrência
     * escolhida, obrigatório em {@code ESTA} e {@code SEGUINTES} de uma série. Responde com o evento resultante (em
     * {@code SEGUINTES}, o da série nova).
     */
    @Transactional
    public EventoResponse alterar(UUID dono, UUID id, EventoRequest r, EscopoDaSerie escopo, LocalDate ocorrencia) {
        EventoAgenda e = buscar(dono, id);
        exigirVersao(e, r.versao());
        Conteudo c = conteudo(r);
        EventoAgenda resultado = e;
        LocalDate foco = ocorrencia;
        if (!e.repete()) {
            exigirEstaOcorrencia(escopo);
            agendas.buscar(dono, r.agendaId());
            aplicarATodas(e, r, c);
            foco = e.getDataInicio();
        } else {
            switch (escopo) {
                case ESTA -> {
                    exigirOcorrencia(e, ocorrencia);
                    if (!r.agendaId().equals(e.getAgendaId())) {
                        throw new BadRequestException("A agenda só muda para a série toda.", "AGENDA_SO_NA_SERIE_TODA");
                    }
                    RecorrenciaDeEvento.validar(c.data(), Regra.NENHUMA);
                    gravarExcecao(e, ocorrencia, c);
                }
                case TODAS -> {
                    LocalDate esperado = ocorrencia != null ? ocorrencia : e.getDataInicio();
                    exigirDataDaOcorrencia(c.data(), esperado);
                    if (ocorrencia != null) {
                        exigirOcorrencia(e, ocorrencia);
                    }
                    agendas.buscar(dono, r.agendaId());
                    aplicarATodas(e, r, c);
                }
                case SEGUINTES -> {
                    exigirOcorrencia(e, ocorrencia);
                    exigirDataDaOcorrencia(c.data(), ocorrencia);
                    agendas.buscar(dono, r.agendaId());
                    if (ocorrencia.equals(e.getDataInicio())) {
                        aplicarATodas(e, r, c);
                    } else {
                        resultado = dividirASerie(dono, e, r, c, ocorrencia);
                        foco = ocorrencia;
                    }
                }
            }
        }
        eventos.saveAndFlush(e);
        auditoria.registrarEvento("EVENTO_ALTERADO", "EVENTO_AGENDA", e.getId(), "Alterou um evento da agenda pessoal.");
        return resposta(resultado, preferida(resultado, foco));
    }

    /** Exclui o evento no {@code escopo} dado (a mesma regra de {@link #alterar}); {@code versao} é a lida. */
    @Transactional
    public void excluir(UUID dono, UUID id, Long versao, EscopoDaSerie escopo, LocalDate ocorrencia) {
        EventoAgenda e = buscar(dono, id);
        exigirVersao(e, versao);
        if (!e.repete()) {
            exigirEstaOcorrencia(escopo);
            eventos.delete(e);
        } else {
            switch (escopo) {
                case ESTA -> {
                    exigirOcorrencia(e, ocorrencia);
                    ExcecaoDeEvento x = excecoes.findByEventoIdAndDataOriginal(e.getId(), ocorrencia)
                            .orElseGet(() -> new ExcecaoDeEvento(e.getId(), ocorrencia));
                    x.cancelar();
                    excecoes.save(x);
                    e.tocar();
                    eventos.saveAndFlush(e);
                }
                case TODAS -> eventos.delete(e);
                case SEGUINTES -> {
                    exigirOcorrencia(e, ocorrencia);
                    if (ocorrencia.equals(e.getDataInicio())) {
                        eventos.delete(e);
                    } else {
                        cortar(e, ocorrencia);
                        eventos.saveAndFlush(e);
                    }
                }
            }
        }
        auditoria.registrarEvento("EVENTO_EXCLUIDO", "EVENTO_AGENDA", id, "Excluiu um evento da agenda pessoal.");
    }

    // ---- Aplicação dos escopos ----

    /** {@code TODAS} (e o avulso): conteúdo e regra novos; o primeiro dia só muda no avulso; exceções órfãs saem. */
    private void aplicarATodas(EventoAgenda e, EventoRequest r, Conteudo c) {
        Regra regra = regraDe(r.repeticao());
        LocalDate dataBase = e.repete() ? e.getDataInicio() : c.data();
        RecorrenciaDeEvento.validar(dataBase, regra);
        LocalDate inicio = RecorrenciaDeEvento.primeira(dataBase, regra);
        e.definirConteudo(r.agendaId(), c.titulo(), c.descricao(), c.local(), inicio, c.hora(), c.duracao());
        e.definirRegra(regra);
        for (ExcecaoDeEvento x : excecoes.findByEventoId(e.getId())) {
            if (!regra.repete() || !RecorrenciaDeEvento.ocorre(inicio, regra, x.getDataOriginal())) {
                excecoes.delete(x);
            }
        }
    }

    /**
     * {@code SEGUINTES} fora da primeira ocorrência: a série atual termina no dia anterior e nasce outra, a partir de
     * {@code corte}, com o conteúdo e a regra do pedido. Devolve a série nova.
     */
    private EventoAgenda dividirASerie(UUID dono, EventoAgenda antigo, EventoRequest r, Conteudo c, LocalDate corte) {
        exigirEspaco(dono);
        Regra atual = antigo.regra();
        Regra pedida = regraDe(r.repeticao());
        // Mesma regra e mesmo "vezes" do que a série já tinha: o pedido não mudou a repetição, então a nova leva o resto.
        if (atual.vezes() != null && pedida.vezes() != null && pedida.tipo() == atual.tipo()
                && pedida.dias().equals(atual.dias()) && pedida.vezes().equals(atual.vezes())) {
            int restante = atual.vezes() - RecorrenciaDeEvento.contarAntes(antigo.getDataInicio(), atual, corte);
            pedida = restante >= RecorrenciaDeEvento.VEZES_MINIMO ? new Regra(pedida.tipo(), pedida.dias(), null, restante)
                    : Regra.NENHUMA;
        }
        RecorrenciaDeEvento.validar(corte, pedida);
        LocalDate inicio = RecorrenciaDeEvento.primeira(corte, pedida);
        List<ExcecaoDeEvento> daqui = new ArrayList<>();
        for (ExcecaoDeEvento x : excecoes.findByEventoId(antigo.getId())) {
            if (!x.getDataOriginal().isBefore(corte)) {
                daqui.add(x);
            }
        }
        cortar(antigo, corte);
        EventoAgenda novo = new EventoAgenda(dono);
        novo.definirConteudo(r.agendaId(), c.titulo(), c.descricao(), c.local(), inicio, c.hora(), c.duracao());
        novo.definirRegra(pedida);
        novo = eventos.saveAndFlush(novo);
        for (ExcecaoDeEvento x : daqui) {
            if (x.isCancelada() && pedida.repete() && RecorrenciaDeEvento.ocorre(inicio, pedida, x.getDataOriginal())) {
                ExcecaoDeEvento copia = new ExcecaoDeEvento(novo.getId(), x.getDataOriginal());
                copia.cancelar();
                excecoes.save(copia);
            }
        }
        return novo;
    }

    /** A série termina no dia anterior a {@code corte}; as exceções de {@code corte} em diante saem. */
    private void cortar(EventoAgenda e, LocalDate corte) {
        Regra atual = e.regra();
        e.definirRegra(new Regra(atual.tipo(), atual.dias(), corte.minusDays(1), null));
        for (ExcecaoDeEvento x : excecoes.findByEventoId(e.getId())) {
            if (!x.getDataOriginal().isBefore(corte)) {
                excecoes.delete(x);
            }
        }
    }

    /** {@code ESTA} numa série: guarda só o que difere do evento; sem diferença nenhuma, a exceção deixa de existir. */
    private void gravarExcecao(EventoAgenda e, LocalDate original, Conteudo c) {
        ExcecaoDeEvento x = excecoes.findByEventoIdAndDataOriginal(e.getId(), original)
                .orElseGet(() -> new ExcecaoDeEvento(e.getId(), original));
        boolean diaInteiro = c.hora() == null;
        LocalTime hora = null;
        Integer duracao = null;
        if (!diaInteiro) {
            hora = c.hora().equals(e.getHoraInicio()) ? null : c.hora();
            duracao = c.duracao().equals(e.getDuracaoMinutos()) ? null : c.duracao();
        }
        x.alterar(c.titulo().equals(e.getTitulo()) ? null : c.titulo(), diferenca(c.descricao(), e.getDescricao()),
                diferenca(c.local(), e.getLocal()), diaInteiro == e.isDiaInteiro() ? null : Boolean.valueOf(diaInteiro), hora,
                duracao, c.data().equals(original) ? null : c.data());
        if (x.vazia()) {
            if (x.getId() != null) {
                excecoes.delete(x);
            }
        } else {
            excecoes.save(x);
        }
        e.tocar();
    }

    /** Nulo herda; texto vazio apaga só nesta ocorrência. */
    private static String diferenca(String novo, String base) {
        if (Objects.equals(novo, base)) {
            return null;
        }
        return novo == null ? "" : novo;
    }

    // ---- Expansão ----

    /** Uma ocorrência com a exceção aplicada. */
    private record Efetiva(EventoAgenda evento, LocalDate dataOriginal, LocalDate data, LocalTime hora, Integer duracao,
                           String titulo, String descricao, String local) {

        @Override
        public String toString() {
            return "Efetiva[eventoId=" + (evento == null ? null : evento.getId()) + ", dataOriginal=" + dataOriginal
                    + ", data=" + data + "]";
        }

        boolean diaInteiro() {
            return hora == null;
        }

        Instant inicio() {
            return diaInteiro() ? data.atStartOfDay(Fuso.BRASILIA).toInstant() : AgendaService.inicioEmBrasilia(data, hora);
        }

        Instant fim() {
            return diaInteiro() ? data.plusDays(1).atStartOfDay(Fuso.BRASILIA).toInstant()
                    : inicio().plus(duracao, ChronoUnit.MINUTES);
        }
    }

    private static final Comparator<Efetiva> PELO_HORARIO = Comparator.comparing(Efetiva::inicio)
            .thenComparing(Efetiva::fim).thenComparing(Efetiva::titulo, String.CASE_INSENSITIVE_ORDER)
            .thenComparing(f -> f.evento().getId());

    /** As ocorrências que tocam os dias [{@code de}, {@code ate}] (já com o dia anterior, por causa da meia-noite). */
    private List<Efetiva> efetivas(UUID dono, LocalDate de, LocalDate ate, Collection<UUID> agendasPedidas) {
        return efetivas(dono, de, ate, agendasPedidas, Integer.MAX_VALUE);
    }

    /** Para de expandir quando passa de {@code teto} ocorrências (a lista sai com mais que {@code teto}: sinal de corte). */
    private List<Efetiva> efetivas(UUID dono, LocalDate de, LocalDate ate, Collection<UUID> agendasPedidas, int teto) {
        boolean todas = agendasPedidas == null || agendasPedidas.isEmpty();
        LocalDate deComFolga = de.minusDays(1);
        List<EventoAgenda> candidatos = eventos.candidatosDoPeriodo(dono, todas,
                todas ? List.of(NINGUEM) : List.copyOf(agendasPedidas), deComFolga, ate);
        Map<UUID, Map<LocalDate, ExcecaoDeEvento>> excecoesDe = excecoesPorEvento(candidatos);
        Instant limiteInferior = de.atStartOfDay(Fuso.BRASILIA).toInstant();
        Instant limiteSuperior = ate.plusDays(1).atStartOfDay(Fuso.BRASILIA).toInstant();
        List<Efetiva> lista = new ArrayList<>();
        for (EventoAgenda e : candidatos) {
            for (Efetiva f : expandir(e, excecoesDe.getOrDefault(e.getId(), Map.of()), deComFolga, ate)) {
                if (f.inicio().isBefore(limiteSuperior) && f.fim().isAfter(limiteInferior)) {
                    lista.add(f);
                }
            }
            if (lista.size() > teto) {
                break;
            }
        }
        return lista;
    }

    private Map<UUID, Map<LocalDate, ExcecaoDeEvento>> excecoesPorEvento(Collection<EventoAgenda> lista) {
        Map<UUID, Map<LocalDate, ExcecaoDeEvento>> mapa = new HashMap<>();
        List<UUID> ids = lista.stream().filter(EventoAgenda::repete).map(EventoAgenda::getId).toList();
        if (!ids.isEmpty()) {
            excecoes.findByEventoIdIn(ids).forEach(x ->
                    mapa.computeIfAbsent(x.getEventoId(), k -> new HashMap<>()).put(x.getDataOriginal(), x));
        }
        return mapa;
    }

    /**
     * As ocorrências do evento cujo dia (já com a exceção aplicada) cai em [{@code de}, {@code ate}]: os dias da regra
     * dentro do período, menos os cancelados e os movidos para fora, mais os movidos de fora para dentro.
     */
    private static List<Efetiva> expandir(EventoAgenda e, Map<LocalDate, ExcecaoDeEvento> excecoes, LocalDate de,
                                          LocalDate ate) {
        List<Efetiva> lista = new ArrayList<>();
        Regra regra = e.regra();
        for (LocalDate original : RecorrenciaDeEvento.expandir(e.getDataInicio(), regra, de, ate)) {
            ExcecaoDeEvento x = excecoes.get(original);
            if (x != null && x.isCancelada()) {
                continue;
            }
            Efetiva f = efetiva(e, x, original);
            if (!f.data().isBefore(de) && !f.data().isAfter(ate)) {
                lista.add(f);
            }
        }
        for (ExcecaoDeEvento x : excecoes.values()) {
            LocalDate nova = x.getDataNova();
            boolean originalDentro = !x.getDataOriginal().isBefore(de) && !x.getDataOriginal().isAfter(ate);
            if (!x.isCancelada() && nova != null && !nova.isBefore(de) && !nova.isAfter(ate) && !originalDentro
                    && RecorrenciaDeEvento.ocorre(e.getDataInicio(), regra, x.getDataOriginal())) {
                lista.add(efetiva(e, x, x.getDataOriginal()));
            }
        }
        return lista;
    }

    private static Efetiva efetiva(EventoAgenda e, ExcecaoDeEvento x, LocalDate original) {
        String titulo = (x != null && x.getTitulo() != null) ? x.getTitulo() : e.getTitulo();
        String descricao = texto(x == null ? null : x.getDescricao(), e.getDescricao());
        String local = texto(x == null ? null : x.getLocal(), e.getLocal());
        boolean diaInteiro = (x != null && x.getDiaInteiro() != null) ? x.getDiaInteiro() : e.isDiaInteiro();
        LocalTime hora = null;
        Integer duracao = null;
        if (!diaInteiro) {
            hora = (x != null && x.getHoraInicio() != null) ? x.getHoraInicio() : e.getHoraInicio();
            duracao = (x != null && x.getDuracaoMinutos() != null) ? x.getDuracaoMinutos() : e.getDuracaoMinutos();
            if (hora == null || duracao == null) {
                // Exceção inconsistente (dia inteiro virou com hora sem hora): volta ao dia inteiro, nunca quebra a leitura.
                hora = null;
                duracao = null;
            }
        }
        LocalDate data = (x != null && x.getDataNova() != null) ? x.getDataNova() : original;
        return new Efetiva(e, original, data, hora, duracao, titulo, descricao, local);
    }

    /** Exceção nula herda; vazia apaga só nesta ocorrência. */
    private static String texto(String excecao, String base) {
        if (excecao == null) {
            return base;
        }
        return excecao.isEmpty() ? null : excecao;
    }

    /** A ocorrência cujo dia da regra é {@code original}, se existe e não foi cancelada. */
    private Optional<Efetiva> ocorrenciaDe(EventoAgenda e, LocalDate original) {
        if (!e.repete()) {
            return original.equals(e.getDataInicio()) ? Optional.of(efetiva(e, null, original)) : Optional.empty();
        }
        if (!RecorrenciaDeEvento.ocorre(e.getDataInicio(), e.regra(), original)) {
            return Optional.empty();
        }
        ExcecaoDeEvento x = excecoes.findByEventoIdAndDataOriginal(e.getId(), original).orElse(null);
        if (x != null && x.isCancelada()) {
            return Optional.empty();
        }
        return Optional.of(efetiva(e, x, original));
    }

    private Efetiva preferida(EventoAgenda e, LocalDate original) {
        if (original != null) {
            Optional<Efetiva> pedida = ocorrenciaDe(e, original);
            if (pedida.isPresent()) {
                return pedida.get();
            }
        }
        return ocorrenciaDe(e, e.getDataInicio()).orElse(null);
    }

    // ---- Respostas ----

    private static OcorrenciaDeEvento ocorrencia(Efetiva f) {
        Instant inicio = f.inicio();
        Instant fim = f.fim();
        return new OcorrenciaDeEvento(f.evento().getId(), f.evento().getAgendaId(), f.dataOriginal(), f.data(),
                f.diaInteiro() ? null : AgendaService.hora(inicio), f.diaInteiro() ? null : AgendaService.hora(fim), inicio,
                fim, f.diaInteiro(), f.titulo(), f.local(), f.descricao(), f.evento().repete());
    }

    private static EventoResponse resposta(EventoAgenda e, Efetiva ocorrencia) {
        RepeticaoDeEvento repeticao = null;
        if (e.repete()) {
            Regra regra = e.regra();
            Set<String> dias = new TreeSet<>(Comparator.comparingInt((String nome) -> DayOfWeek.valueOf(nome).getValue()));
            regra.dias().forEach(d -> dias.add(d.name()));
            repeticao = new RepeticaoDeEvento(regra.tipo(), dias, regra.ate(), regra.vezes());
        }
        return new EventoResponse(e.getId(), e.getAgendaId(), e.getTitulo(), e.getLocal(), e.getDescricao(), e.getDataInicio(),
                e.isDiaInteiro(), e.isDiaInteiro() ? null : e.getHoraInicio().toString(), e.getDuracaoMinutos(), repeticao,
                e.getVersao() == null ? 0 : e.getVersao(), ocorrencia == null ? null : ocorrencia(ocorrencia));
    }

    // ---- Validação ----

    private record Conteudo(String titulo, String descricao, String local, LocalDate data, LocalTime hora, Integer duracao) {
        @Override
        public String toString() {
            return "Conteudo[data=" + data + ", hora=" + hora + ", duracao=" + duracao + "]";
        }
    }

    private static Conteudo conteudo(EventoRequest r) {
        String titulo = r.titulo() == null ? "" : r.titulo().trim();
        if (titulo.isEmpty() || titulo.length() > AgendaCalendarioDtos.TITULO_MAXIMO) {
            throw invalido("O título precisa ter de 1 a " + AgendaCalendarioDtos.TITULO_MAXIMO + " caracteres.");
        }
        LocalTime hora = null;
        Integer duracao = null;
        if (!r.diaInteiro()) {
            if (r.hora() == null || r.duracaoMinutos() == null) {
                throw invalido("Informe a hora e a duração, ou marque o dia inteiro.");
            }
            hora = r.hora().truncatedTo(ChronoUnit.MINUTES);
            duracao = r.duracaoMinutos();
        }
        return new Conteudo(titulo, Buscas.opcional(r.descricao()), Buscas.opcional(r.local()), r.data(), hora, duracao);
    }

    /** A repetição do pedido como regra (os nomes dos dias são {@link DayOfWeek}, texto; outro valor é 400). */
    private static Regra regraDe(RepeticaoDeEvento r) {
        if (r == null) {
            return Regra.NENHUMA;
        }
        Set<DayOfWeek> dias = EnumSet.noneOf(DayOfWeek.class);
        if (r.diasDaSemana() != null) {
            for (String nome : r.diasDaSemana()) {
                try {
                    dias.add(DayOfWeek.valueOf(nome == null ? "" : nome.trim().toUpperCase(Locale.ROOT)));
                } catch (IllegalArgumentException invalido) {
                    throw new BadRequestException(
                            "Dia da semana inválido. Use MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY ou SUNDAY.",
                            "REPETICAO_INVALIDA");
                }
            }
        }
        return new Regra(r.tipo(), dias, r.ate(), r.vezes());
    }

    private static void exigirPeriodo(LocalDate inicio, LocalDate fim, int maximoDeDias) {
        if (fim.isBefore(inicio)) {
            throw new BadRequestException("A data final vem antes da inicial.", "PERIODO_INVALIDO");
        }
        if (ChronoUnit.DAYS.between(inicio, fim) + 1 > maximoDeDias) {
            throw new BadRequestException("Escolha um período de até " + maximoDeDias + " dias.", "PERIODO_INVALIDO");
        }
    }

    /** Evento avulso não tem série: só o escopo {@code ESTA} (o evento todo) faz sentido. */
    private static void exigirEstaOcorrencia(EscopoDaSerie escopo) {
        if (escopo != EscopoDaSerie.ESTA) {
            throw new BadRequestException("Este evento não se repete. Use o escopo ESTA.", "EVENTO_SEM_SERIE");
        }
    }

    /** Numa série, {@code ocorrencia} tem de ser um dia da regra que não foi cancelado (senão 404). */
    private void exigirOcorrencia(EventoAgenda e, LocalDate ocorrencia) {
        if (ocorrencia == null) {
            throw new BadRequestException("Informe a ocorrência (AAAA-MM-DD).", "OCORRENCIA_OBRIGATORIA");
        }
        if (ocorrenciaDe(e, ocorrencia).isEmpty()) {
            throw ocorrenciaNaoEncontrada();
        }
    }

    private static void exigirDataDaOcorrencia(LocalDate data, LocalDate ocorrencia) {
        if (!data.equals(ocorrencia)) {
            throw new BadRequestException("A data só muda em \"somente esta ocorrência\".", "DATA_SO_NESTA_OCORRENCIA");
        }
    }

    private void exigirEspaco(UUID dono) {
        if (eventos.countByDonoId(dono) >= EVENTOS_MAXIMO) {
            throw new ConflictException("Você já tem " + EVENTOS_MAXIMO + " eventos. Exclua algum para criar outro.",
                    "LIMITE_DE_EVENTOS");
        }
    }

    private EventoAgenda buscar(UUID dono, UUID id) {
        return eventos.findByIdAndDonoId(id, dono).orElseThrow(() -> new NaoEncontradoException("Evento não encontrado."));
    }

    private static void exigirVersao(EventoAgenda e, Long versao) {
        if (versao == null || !versao.equals(e.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou este evento. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    private static NaoEncontradoException ocorrenciaNaoEncontrada() {
        return new NaoEncontradoException("Ocorrência não encontrada.");
    }

    private static BadRequestException invalido(String mensagem) {
        return new BadRequestException(mensagem, "EVENTO_INVALIDO");
    }
}
