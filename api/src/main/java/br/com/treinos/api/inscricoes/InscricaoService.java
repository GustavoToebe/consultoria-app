package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.ConviteService;
import br.com.treinos.api.alunos.Sexo;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConviteResponse;
import br.com.treinos.api.anamneses.AnamneseService;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.inscricoes.Crm.Origem;
import br.com.treinos.api.inscricoes.Crm.TipoEvento;
import br.com.treinos.api.inscricoes.InscricaoDtos.AceitarRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.AceiteResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.AlterarInscricaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.Contagens;
import br.com.treinos.api.inscricoes.InscricaoDtos.EncerrarRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.EtapaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoDetalhe;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoPublicaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.NotaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.PaginaInscricoes;
import br.com.treinos.api.inscricoes.InscricaoDtos.ReabrirRequest;
import br.com.treinos.api.atualizacoes.ValidadorAtualizacao;
import br.com.treinos.api.questionarios.ConteudoQuestionario;
import br.com.treinos.api.questionarios.QuestionarioResolver;
import br.com.treinos.api.questionarios.QuestionarioService;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.ConflitoComRecursoException;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.MuitasRequisicoesException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Fila de interessados (o CRM da consultoria) da consultoria da sessão (inscrição de outra consultoria = 404) e a
 * gravação da inscrição pública, que roda com a consultoria do link já no {@code TenantContext}
 * ({@link InscricaoPublicaService}).
 *
 * <p>Nada daqui vai a log; a auditoria só grava resumos fixos (sem nome nem contato). Cada mudança também vira um evento
 * do histórico da inscrição ({@link HistoricoDaInscricao}). O ciclo de vida: etapas abertas (nova, em contato, em
 * negociação) entre si pelo andamento ou pelo Kanban; encerrar (recusada ou desistiu) sempre com motivo; reabrir um
 * encerramento começa um ciclo novo; aceitar é um clique explícito, cria o aluno pelo {@link AlunoService} e não depende
 * do pagamento (registro manual).
 */
@Service
public class InscricaoService {

    /** O {@code objetivo} do aluno tem até 200 caracteres; maior que isso fica só na inscrição. */
    static final int OBJETIVO_DO_ALUNO = 200;
    /** Janela do teto de inscrições por consultoria ({@code treinos.limites.inscricao-consultoria-dia}). */
    static final Duration JANELA_DO_TETO = Duration.ofHours(24);

    private final InscricaoRepository inscricoes;
    private final InscricaoNotaRepository notas;
    private final InscricaoConfiguracaoRepository configuracoes;
    private final InscricaoRetornoRepository retornos;
    private final ResponsaveisDaInscricao responsaveis;
    private final HistoricoDaInscricao historico;
    private final DetalheDaInscricao detalhes;
    private final AlunoService alunos;
    private final ConviteService convites;
    private final AnamneseService anamneses;
    private final QuestionarioService questionarios;
    private final Auditoria auditoria;
    private final ConsultoriaRepository consultorias;
    private final QuestionarioResolver resolver;
    private final ValidadorAtualizacao validadorDeRespostas;
    private final JsonMapper json;
    private final int limiteDiario;

    public InscricaoService(InscricaoRepository inscricoes, InscricaoNotaRepository notas,
                            InscricaoConfiguracaoRepository configuracoes, InscricaoRetornoRepository retornos,
                            ResponsaveisDaInscricao responsaveis, HistoricoDaInscricao historico,
                            DetalheDaInscricao detalhes, AlunoService alunos, ConviteService convites,
                            AnamneseService anamneses, QuestionarioService questionarios, Auditoria auditoria,
                            ConsultoriaRepository consultorias, QuestionarioResolver resolver,
                            ValidadorAtualizacao validadorDeRespostas, JsonMapper json,
                            @Value("${treinos.limites.inscricao-consultoria-dia:200}") int limiteDiario) {
        if (limiteDiario < 1) {
            throw new IllegalArgumentException("Limite diário de inscrições inválido.");
        }
        this.limiteDiario = limiteDiario;
        this.inscricoes = inscricoes;
        this.notas = notas;
        this.configuracoes = configuracoes;
        this.retornos = retornos;
        this.responsaveis = responsaveis;
        this.historico = historico;
        this.detalhes = detalhes;
        this.alunos = alunos;
        this.convites = convites;
        this.anamneses = anamneses;
        this.questionarios = questionarios;
        this.auditoria = auditoria;
        this.consultorias = consultorias;
        this.resolver = resolver;
        this.validadorDeRespostas = validadorDeRespostas;
        this.json = json;
    }

    // ---- Público (com a consultoria do link no TenantContext) ----

    /**
     * O que a página pública do link aberto mostra: o texto, os campos fixos visíveis e as perguntas do padrão de
     * inscrição publicado (só o necessário para responder; nulo sem padrão). O código é conferido de novo aqui (pode ter
     * mudado depois da busca).
     */
    public record PaginaDoLink(String texto, List<CampoDaInscricao> campos, InscricaoDtos.PerguntasDaInscricao perguntas) {
    }

    @Transactional(readOnly = true)
    public PaginaDoLink paginaDoLink(String codigo) {
        InscricaoConfiguracao link = linkAberto(codigo);
        InscricaoDtos.PerguntasDaInscricao perguntas = resolver.padraoDaInscricao()
                .map(v -> new InscricaoDtos.PerguntasDaInscricao(v.versaoId(),
                        PerguntasPublicas.de(json.readValue(v.conteudo(), ConteudoQuestionario.class))))
                .orElse(null);
        return new PaginaDoLink(link.getTexto(), List.copyOf(CampoDaInscricao.visiveis(link.getCamposOcultos())), perguntas);
    }

    /**
     * Grava a inscrição com o responsável padrão do link (se ainda for membro ativo). Com texto da consultoria, a ciência
     * é obrigatória e a inscrição guarda o texto que a pessoa viu e a hora. A qualificação e o "como conheceu" são
     * opcionais; o parâmetro {@code ?origem=} do link só vale com até 40 de {@code [a-z0-9_-]} (outro valor é
     * ignorado, sem recusar a inscrição).
     *
     * <p>Teto por consultoria em 24 h (revisão de segurança de 19/10): o limite por IP do controller não segura quem troca
     * de endereço (um bloco IPv6 tem endereços sem fim) e a verificação humana nasce desligada; sem o teto, o link
     * público enchia a fila e o banco sem limite. Passou do teto: 429, a mesma resposta de quem tentou demais. O envio
     * trava a linha do link antes de contar (achado B4): dois envios simultâneos no último lugar ficam em série e só um
     * entra, mesmo com várias instâncias da API. A trava é do link, não da consultoria (não segura o resto do app).
     *
     * <p>Com texto, a ciência vale só para o texto que a pessoa viu (achado B2): o envio traz a {@code textoVersao} da
     * página e, se a equipe trocou o texto nesse meio-tempo, é 409 {@code TEXTO_ALTERADO} e a página mostra o texto novo.
     *
     * <p>Campos fixos que o treinador escondeu (D4) são ignorados se chegarem (a página pode ser de antes da mudança).
     * As respostas às perguntas do treinador (D9) são validadas pela versão publicada do padrão de inscrição, com as regras
     * da atualização e da anamnese (422 {@code INSCRICAO_INVALIDA}, por id da pergunta, sem repetir o valor), e gravadas com
     * a versão fixada. A página manda a versão que mostrou: outra versão (ou respostas sem versão, ou versão sem padrão)
     * é 409 {@code PERGUNTAS_ALTERADAS} e a página recarrega as perguntas. Sem versão e sem respostas vale como "não
     * respondeu" (a pergunta obrigatória ainda recusa). Nada disso vai a log nem à auditoria; o aceite não copia as
     * respostas para o cadastro.
     */
    @Transactional
    public void registrarPublica(String codigo, InscricaoPublicaRequest r) {
        InscricaoConfiguracao link = configuracoes.atualParaAlterar().filter(c -> c.isAberta() && c.getCodigo().equals(codigo))
                .orElseThrow(InscricaoPublicaService::linkInvalido);
        if (inscricoes.countByCriadaEmAfter(Instant.now().minus(JANELA_DO_TETO)) >= limiteDiario) {
            throw new MuitasRequisicoesException(JANELA_DO_TETO.toSeconds());
        }
        String texto = link.getTexto();
        if (!TextoDaInscricao.confere(texto, r.textoVersao())) {
            throw new ConflictException("O texto da consultoria mudou enquanto você preenchia. Leia o texto novo e confirme.",
                    "TEXTO_ALTERADO");
        }
        if (texto != null && !Boolean.TRUE.equals(r.cienciaPrivacidade())) {
            throw new BadRequestException("Confirme que leu o texto da consultoria para enviar.", "CIENCIA_OBRIGATORIA");
        }
        String whatsapp = Formatos.telefone(r.whatsapp());
        UUID responsavel = responsaveis.ativo(link.getResponsavelId()) ? link.getResponsavelId() : null;
        Set<CampoDaInscricao> ocultos = link.getCamposOcultos();
        String sexo = ocultos.contains(CampoDaInscricao.SEXO) ? null : r.sexo();
        if (sexo != null && !sexo.isBlank() && Sexo.ler(sexo) == null) {
            throw new br.com.treinos.api.web.ValidacaoException("Confira os campos.", "INSCRICAO_INVALIDA",
                    List.of(new br.com.plataforma.comum.web.ApiError.FieldError("sexo", "Escolha Masculino, Feminino ou Outro.")));
        }
        Inscricao nova = new Inscricao(r.nome().trim(), whatsapp,
                ocultos.contains(CampoDaInscricao.EMAIL) ? null : Buscas.opcional(r.email()),
                ocultos.contains(CampoDaInscricao.OBJETIVO) ? null : Buscas.opcional(r.objetivo()),
                null, texto, responsavel, Sexo.ler(sexo));
        nova.qualificar(ocultos.contains(CampoDaInscricao.INTERESSE) ? null : r.interesse(),
                ocultos.contains(CampoDaInscricao.MODALIDADE) ? null : r.modalidade(),
                ocultos.contains(CampoDaInscricao.PREVISAO_INICIO) ? null : r.previsaoInicio(),
                ocultos.contains(CampoDaInscricao.ORIGEM) ? null : r.origem(), Crm.origemLinkValida(r.origemLink()));
        responderPerguntas(nova, r.questionarioVersaoId(), r.respostas());
        Inscricao gravada = inscricoes.saveAndFlush(nova);
        historico.registrar(gravada, TipoEvento.CRIADA, null, null, null, null);
    }

    /** Confere a versão das perguntas e valida as respostas por ela (regras no javadoc de {@link #registrarPublica}). */
    private void responderPerguntas(Inscricao nova, UUID versaoEnviada, JsonNode enviadas) {
        boolean temRespostas = enviadas != null && !enviadas.isNull() && !enviadas.isMissingNode()
                && !(enviadas.isObject() && enviadas.isEmpty());
        var padrao = resolver.padraoDaInscricao();
        if (padrao.isEmpty()) {
            if (versaoEnviada != null || temRespostas) throw perguntasAlteradas();
            return;
        }
        UUID versao = padrao.get().versaoId();
        if (versaoEnviada != null ? !versaoEnviada.equals(versao) : temRespostas) throw perguntasAlteradas();
        JsonNode limpas = validadorDeRespostas.validar(json.readTree(padrao.get().conteudo()),
                temRespostas ? enviadas : json.createObjectNode(), false, "INSCRICAO_INVALIDA", LocalDate.now(Fuso.BRASILIA));
        nova.responder(versao, json.writeValueAsString(limpas));
    }

    private static ConflictException perguntasAlteradas() {
        return new ConflictException("A consultoria mudou as perguntas enquanto você preenchia. Confira as perguntas e envie de novo.",
                "PERGUNTAS_ALTERADAS");
    }

    private InscricaoConfiguracao linkAberto(String codigo) {
        return configuracoes.atual().filter(c -> c.isAberta() && c.getCodigo().equals(codigo))
                .orElseThrow(InscricaoPublicaService::linkInvalido);
    }

    // ---- Fila da equipe ----

    /**
     * Filtros da fila. {@code situacao}: {@code ABERTAS} (padrão: nova, em contato, em negociação), {@code TODAS} ou uma
     * situação. {@code meus} = as inscrições com quem pede; {@code responsavel} = id de um membro ou {@code nenhum}
     * (ignorado com {@code meus}); {@code origem} = uma origem ou {@code NAO_INFORMADA}; {@code busca} = nome (sem acento),
     * e-mail ou dígitos do WhatsApp (4 ou mais).
     */
    public record Filtro(String situacao, UUID meus, String responsavel, String origem, String busca) {
    }

    /** Mais novas primeiro, em páginas de até 100. */
    @Transactional(readOnly = true)
    public PaginaInscricoes listar(Filtro f, int pagina, int tamanho) {
        Consulta c = Consulta.de(f);
        Page<Inscricao> page = inscricoes.buscar(situacoes(f.situacao()), c.responsavelId, c.semResponsavel, c.origem,
                c.semOrigem, c.busca, c.nome, c.texto, c.digitos, c.digitosPadrao,
                PageRequest.of(Math.max(0, pagina), Math.clamp(tamanho, 1, 100)));
        return new PaginaInscricoes(detalhes.resumos(page.getContent()), page.getTotalElements());
    }

    /**
     * Quantas há em cada situação com os mesmos filtros (sem a situação) e os retornos pendentes das abertas: atrasados
     * (antes de hoje) e de hoje, de Brasília ({@code meus} = os retornos com quem pede).
     */
    @Transactional(readOnly = true)
    public Contagens contar(Filtro f) {
        Consulta c = Consulta.de(f);
        Map<SituacaoInscricao, Long> por = new EnumMap<>(SituacaoInscricao.class);
        for (SituacaoInscricao s : SituacaoInscricao.values()) por.put(s, 0L);
        inscricoes.contarPorSituacao(c.responsavelId, c.semResponsavel, c.origem, c.semOrigem, c.busca, c.nome, c.texto,
                c.digitos, c.digitosPadrao).forEach(p -> por.put(p.situacao(), p.quantidade()));
        long abertas = SituacaoInscricao.ABERTAS.stream().mapToLong(por::get).sum();
        long todas = por.values().stream().mapToLong(Long::longValue).sum();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        long atrasados = retornos.contarPendentes(SituacaoInscricao.ABERTAS, f.meus(), LocalDate.of(1900, 1, 1),
                hoje.minusDays(1));
        long deHoje = retornos.contarPendentes(SituacaoInscricao.ABERTAS, f.meus(), hoje, hoje);
        return new Contagens(por, abertas, todas, atrasados, deHoje);
    }

    @Transactional(readOnly = true)
    public InscricaoDetalhe detalhe(UUID id) {
        return detalhes.detalhe(buscar(id));
    }

    /**
     * Andamento: situação, pagamento manual e responsável, com a versão lida. Em atendimento, a situação só vai para
     * outra etapa aberta; encerrada ou aceita, ela não muda aqui (encerrar, reabrir e aceitar têm rota própria), mas
     * pagamento e responsável continuam editáveis. Cada mudança vira um evento.
     */
    @Transactional
    @Auditar(acao = "INSCRICAO_ALTERADA", entidade = "INSCRICAO", resumo = "Alterou o andamento de uma inscrição.")
    public InscricaoDetalhe alterar(UUID id, AlterarInscricaoRequest r, UUID quem) {
        Inscricao i = inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
        exigirVersao(i, r.versao());
        SituacaoInscricao nova = r.situacao();
        if (nova != i.getSituacao()) {
            if (i.getSituacao() == SituacaoInscricao.ACEITA) {
                throw new ConflictException("A inscrição já foi aceita e virou aluno; a situação não muda mais.",
                        "INSCRICAO_JA_ACEITA");
            }
            exigirMudancaDeEtapa(i, nova);
            String de = i.getSituacao().name();
            i.alterarSituacao(nova);
            historico.registrar(i, TipoEvento.ETAPA, de, nova.name(), null, quem);
        }
        if (!Objects.equals(r.responsavelId(), i.getResponsavelId())) {
            UUID novo = responsaveis.exigirValido(r.responsavelId());
            i.alterarResponsavel(novo);
            String nome = novo == null ? "Sem responsável" : responsaveis.nomes(List.of(novo)).getOrDefault(novo, "Membro");
            historico.registrar(i, TipoEvento.RESPONSAVEL, null, null, nome, quem);
        }
        if (r.pagamento() != i.getPagamento()) {
            boolean confirmou = r.pagamento() == PagamentoInscricao.CONFIRMADO_MANUAL;
            String de = i.getPagamento().name();
            i.alterarPagamento(r.pagamento(), quem);
            historico.registrar(i, TipoEvento.PAGAMENTO, de, r.pagamento().name(), null, quem);
            if (confirmou) {
                auditoria.registrarEvento("INSCRICAO_PAGAMENTO_CONFIRMADO", "INSCRICAO", i.getId(),
                        "Registrou o pagamento de uma inscrição como confirmado manualmente.");
            }
        }
        return detalhes.detalhe(inscricoes.saveAndFlush(i));
    }

    /** Só entre etapas abertas (o Kanban): não mexe em pagamento nem responsável. Mesma etapa não grava nada. */
    @Transactional
    @Auditar(acao = "INSCRICAO_ALTERADA", entidade = "INSCRICAO", resumo = "Alterou o andamento de uma inscrição.")
    public InscricaoDetalhe mudarEtapa(UUID id, EtapaRequest r, UUID quem) {
        Inscricao i = inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
        exigirNaoAceita(i);
        exigirVersao(i, r.versao());
        if (r.situacao() == i.getSituacao()) return detalhes.detalhe(i);
        exigirMudancaDeEtapa(i, r.situacao());
        String de = i.getSituacao().name();
        i.alterarSituacao(r.situacao());
        historico.registrar(i, TipoEvento.ETAPA, de, r.situacao().name(), null, quem);
        return detalhes.detalhe(inscricoes.saveAndFlush(i));
    }

    /** Recusar ou "desistiu", sempre com motivo (detalhe opcional). Só de uma etapa aberta. */
    @Transactional
    @Auditar(acao = "INSCRICAO_ENCERRADA", entidade = "INSCRICAO", resumo = "Encerrou uma inscrição (recusa ou desistência).")
    public InscricaoDetalhe encerrar(UUID id, EncerrarRequest r, UUID quem) {
        Inscricao i = inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
        exigirNaoAceita(i);
        exigirVersao(i, r.versao());
        if (!SituacaoInscricao.ENCERRADAS_SEM_ALUNO.contains(r.situacao())) {
            throw new BadRequestException("Encerrar é recusar ou marcar a desistência.");
        }
        if (!i.getSituacao().aberta()) {
            throw new ConflictException("Esta inscrição já está encerrada. Para mudar, reabra o atendimento.",
                    "INSCRICAO_ENCERRADA");
        }
        String de = i.getSituacao().name();
        String detalhe = Buscas.opcional(r.detalhe());
        i.encerrar(r.situacao(), r.motivo(), detalhe, quem);
        historico.encerramento(i, de, r.motivo(), detalhe, quem);
        return detalhes.detalhe(inscricoes.saveAndFlush(i));
    }

    /**
     * Volta ao atendimento uma recusada ou desistente: ciclo novo, em contato, sem motivo (o encerramento anterior fica no
     * histórico), e com quem reabriu como responsável se não havia nenhum. O motivo da reabertura é obrigatório.
     */
    @Transactional
    @Auditar(acao = "INSCRICAO_REABERTA", entidade = "INSCRICAO", resumo = "Reabriu o atendimento de uma inscrição.")
    public InscricaoDetalhe reabrir(UUID id, ReabrirRequest r, UUID quem) {
        Inscricao i = inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
        exigirNaoAceita(i);
        exigirVersao(i, r.versao());
        if (i.getSituacao().aberta()) {
            throw new ConflictException("Esta inscrição já está em atendimento.", "INSCRICAO_ABERTA");
        }
        String de = i.getSituacao().name();
        i.reabrir(responsaveis.ativo(quem) ? quem : null);
        historico.registrar(i, TipoEvento.REABERTA, de, i.getSituacao().name(), r.motivo().trim(), quem);
        return detalhes.detalhe(inscricoes.saveAndFlush(i));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_NOTA_ADICIONADA", entidade = "INSCRICAO", resumo = "Acrescentou uma nota a uma inscrição.")
    public InscricaoDetalhe acrescentarNota(UUID id, NotaRequest r, UUID autor) {
        // A nota renova a atividade antes de existir (achado B3): a retenção não apaga uma inscrição com nota de agora.
        historico.atividade(id);
        Inscricao i = buscar(id);
        notas.saveAndFlush(new InscricaoNota(i.getId(), autor, r.texto().trim()));
        return detalhes.detalhe(i);
    }

    /**
     * Cria o aluno com nome, e-mail e o responsável da inscrição (sem responsável ativo, quem aceitou), marca a inscrição
     * como aceita, com {@code anamneseQuestionarioId} envia ao aluno a anamnese desse questionário (a versão publicada
     * daquele momento, pendente, como em {@code POST /alunos/{id}/anamneses}) e, com {@code convidar}, gera o convite de
     * acesso (o link sai só nesta resposta). O objetivo vai para o cadastro só para quem pode escrever dados sensíveis e
     * se couber no campo do aluno. A proposta negociada não vira cobrança.
     *
     * <p>Ordem das checagens, todas antes de qualquer efeito: permissão {@code ALUNO_CONVITE} (se {@code convidar});
     * com anamnese, {@code ANAMNESE_LER}, {@code ANAMNESE_ALTERAR} e {@code ALUNO_SENSIVEL_LER} (as mesmas da rota de
     * atribuir, pois o {@code AnamneseService} não confere permissão sozinho; 403). Depois a inscrição é travada e conferida
     * (aceite repetido, versão) e só então o questionário (404 se for de outra consultoria, 409
     * {@code QUESTIONARIO_INDISPONIVEL} se não for de anamnese, estiver sem versão publicada ou arquivado): o aceite repetido
     * responde {@code INSCRICAO_JA_ACEITA} com o aluno mesmo que o questionário tenha sido arquivado depois (30/10). Por
     * último, o e-mail de aluno existente.
     *
     * <p>Antes da inscrição, trava a consultoria (achado B1, a mesma trava e a mesma ordem do limite do plano): dois aceites
     * simultâneos de inscrições diferentes com o mesmo e-mail ficam em série e o segundo vê o aluno do primeiro (409
     * {@code ALUNO_JA_EXISTE}), em vez de criar dois alunos. O e-mail do aluno não tem índice único de propósito (o
     * cadastro manual aceita e-mail repetido).
     *
     * <p>Efeitos, nesta ordem: aluno, aceite, anamnese, convite. Tudo numa transação: qualquer recusa (limite do plano,
     * {@code ALUNO_JA_EXISTE} com o id, {@code INSCRICAO_JA_ACEITA}, falha ao atribuir a anamnese) desfaz também o aluno e
     * o aceite, e nada fica pela metade. Todas as auditorias que o aceite grava (entre elas {@code ALUNO_CRIADO},
     * {@code INSCRICAO_ACEITA} e, quando houver, {@code ANAMNESE_ATRIBUIDA} e {@code ALUNO_CONVIDADO}) saem nessa mesma
     * transação: ou saem todas, ou nenhuma.
     */
    @Transactional
    @Auditar(acao = "INSCRICAO_ACEITA", entidade = "INSCRICAO", resumo = "Aceitou uma inscrição e cadastrou o aluno.")
    public AceiteResponse aceitar(UUID id, AceitarRequest r, UUID usuarioId) {
        boolean convidar = Boolean.TRUE.equals(r.convidar());
        UUID questionarioId = r.anamneseQuestionarioId();
        if (convidar) AcessoAtual.exigir("ALUNO_CONVITE");
        if (questionarioId != null) {
            AcessoAtual.exigir("ANAMNESE_LER");
            AcessoAtual.exigir("ANAMNESE_ALTERAR");
            AcessoAtual.exigir("ALUNO_SENSIVEL_LER");
        }
        consultorias.travar(TenantContext.get());
        Inscricao i = inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
        exigirNaoAceita(i);
        exigirVersao(i, r.versao());
        // Depois do estado da inscrição: o aceite repetido diz "já aceita" (com o aluno), mesmo que o questionário escolhido
        // tenha sido arquivado entretanto. Ainda antes de qualquer efeito.
        if (questionarioId != null) questionarios.exigirAnamneseUsavel(questionarioId);
        if (i.getEmail() != null) {
            var mesmos = inscricoes.alunosComEmail(List.of(i.getEmail().toLowerCase(Locale.ROOT)));
            if (!mesmos.isEmpty()) {
                throw new ConflitoComRecursoException("Já existe um aluno com este e-mail. Abra a ficha dele.",
                        "ALUNO_JA_EXISTE", "alunoId", mesmos.getFirst().id());
            }
        }
        UUID responsavel = responsaveis.ativo(i.getResponsavelId()) ? i.getResponsavelId() : null;
        String objetivo = AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR") && i.getObjetivo() != null
                && i.getObjetivo().length() <= OBJETIVO_DO_ALUNO ? i.getObjetivo() : null;
        AlunoDetalhe aluno = alunos.criar(new AlunoRequest(i.getNome(), i.getEmail(), objetivo, null, null, null,
                responsavel));
        if (i.getSexo() != null) {
            alunos.definirSexo(aluno.id(), i.getSexo().name());
        }
        String de = i.getSituacao().name();
        i.aceitar(aluno.id());
        inscricoes.saveAndFlush(i);
        historico.registrar(i, TipoEvento.ACEITA, de, SituacaoInscricao.ACEITA.name(), null, usuarioId);
        UUID anamneseId = questionarioId == null ? null : anamneses.atribuir(aluno.id(), questionarioId, usuarioId).id();
        ConviteResponse convite = convidar ? convites.gerar(aluno.id()) : null;
        return new AceiteResponse(i.getId(), aluno.id(), convite, anamneseId);
    }

    // ---- Auxiliares (também usados pelos outros serviços do pacote) ----

    Inscricao buscar(UUID id) {
        return inscricoes.findById(id).orElseThrow(InscricaoService::naoEncontrada);
    }

    /** De uma etapa aberta só para outra etapa aberta; encerrar, aceitar e reabrir têm rota própria. */
    private static void exigirMudancaDeEtapa(Inscricao i, SituacaoInscricao nova) {
        if (!i.getSituacao().aberta()) {
            throw new ConflictException("Esta inscrição está encerrada. Para voltar ao atendimento, use Reabrir.",
                    "INSCRICAO_ENCERRADA");
        }
        if (nova == SituacaoInscricao.ACEITA) {
            throw new BadRequestException("Para aceitar, use Aceitar: ele cadastra o aluno.");
        }
        if (!nova.aberta()) {
            throw new BadRequestException("Para recusar ou marcar a desistência, use Encerrar (com o motivo).");
        }
    }

    private static Set<SituacaoInscricao> situacoes(String situacao) {
        String valor = situacao == null || situacao.isBlank() ? "ABERTAS" : situacao.trim().toUpperCase(Locale.ROOT);
        if (valor.equals("ABERTAS")) return SituacaoInscricao.ABERTAS;
        if (valor.equals("TODAS")) return EnumSet.allOf(SituacaoInscricao.class);
        try {
            return EnumSet.of(SituacaoInscricao.valueOf(valor));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Situação precisa ser ABERTAS, TODAS ou uma situação da inscrição.");
        }
    }

    static void exigirVersao(Inscricao i, Long versao) {
        if (versao == null || !versao.equals(i.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou esta inscrição. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    /** Aceite repetido (ou qualquer mudança comercial depois do aceite): 409 com o aluno criado, sem criar outro. */
    static void exigirNaoAceita(Inscricao i) {
        if (i.getSituacao() != SituacaoInscricao.ACEITA) return;
        String mensagem = "Esta inscrição já foi aceita e virou aluno.";
        UUID aluno = DetalheDaInscricao.alunoVisivel(i.getAlunoId());
        if (aluno != null) throw new ConflitoComRecursoException(mensagem, "INSCRICAO_JA_ACEITA", "alunoId", aluno);
        throw new ConflictException(mensagem, "INSCRICAO_JA_ACEITA");
    }

    static NaoEncontradoException naoEncontrada() {
        return new NaoEncontradoException("Inscrição não encontrada.");
    }

    /** Parâmetros já prontos para a consulta da fila (padrões do LIKE e flags). */
    private record Consulta(UUID responsavelId, boolean semResponsavel, Origem origem, boolean semOrigem, boolean busca,
                            String nome, String texto, String digitos, String digitosPadrao) {

        static Consulta de(Filtro f) {
            UUID responsavel = f.meus();
            boolean semResponsavel = false;
            if (responsavel == null && f.responsavel() != null && !f.responsavel().isBlank()) {
                if (f.responsavel().trim().equalsIgnoreCase("nenhum")) {
                    semResponsavel = true;
                } else {
                    try {
                        responsavel = UUID.fromString(f.responsavel().trim());
                    } catch (IllegalArgumentException e) {
                        throw new BadRequestException("Responsável precisa ser o id de um membro ou \"nenhum\".");
                    }
                }
            }
            Origem origem = null;
            boolean semOrigem = false;
            if (f.origem() != null && !f.origem().isBlank()) {
                String valor = f.origem().trim().toUpperCase(Locale.ROOT);
                if (valor.equals("NAO_INFORMADA")) {
                    semOrigem = true;
                } else {
                    try {
                        origem = Origem.valueOf(valor);
                    } catch (IllegalArgumentException e) {
                        throw new BadRequestException("Origem desconhecida.");
                    }
                }
            }
            String texto = f.busca() == null ? "" : f.busca().trim();
            boolean busca = !texto.isEmpty();
            String digitos = texto.replaceAll("\\D", "");
            // O WhatsApp é gravado sem o +55 (Formatos.telefone), então o número colado com o código do país também acha.
            if ((digitos.length() == 12 || digitos.length() == 13) && digitos.startsWith("55")) digitos = digitos.substring(2);
            if (digitos.length() < 4) digitos = "";
            if (digitos.length() > 20) digitos = digitos.substring(0, 20);
            return new Consulta(responsavel, semResponsavel, origem, semOrigem, busca, Buscas.padraoSemAcento(texto),
                    Buscas.padrao(texto), digitos, "%" + digitos + "%");
        }
    }
}
