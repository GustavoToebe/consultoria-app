package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.ConviteService;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.ConviteResponse;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.inscricoes.InscricaoDtos.AceitarRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.AceiteResponse;
import br.com.treinos.api.inscricoes.InscricaoDtos.AlterarInscricaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.Duplicidade;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoDetalhe;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoPublicaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoResumo;
import br.com.treinos.api.inscricoes.InscricaoDtos.Nota;
import br.com.treinos.api.inscricoes.InscricaoDtos.NotaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.PaginaInscricoes;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.ConflitoComRecursoException;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.MuitasRequisicoesException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fila de interessados da consultoria da sessão (inscrição de outra consultoria = 404) e a gravação da inscrição
 * pública, que roda com a consultoria do link já no {@code TenantContext} ({@link InscricaoPublicaService}).
 *
 * <p>Nada daqui vai a log; a auditoria só grava resumos fixos (sem nome nem contato). O aceite é sempre um clique
 * explícito e não depende do pagamento (registro manual). Aceitar cria o aluno pelo {@link AlunoService} (mesmas regras
 * do cadastro, inclusive a vaga do plano) e, se pedido, gera o convite de acesso que já existe; aceitar de novo é 409 e
 * não cria outro aluno (a inscrição fica travada durante o aceite).
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
    private final ResponsaveisDaInscricao responsaveis;
    private final AlunoService alunos;
    private final ConviteService convites;
    private final Auditoria auditoria;
    private final int limiteDiario;

    public InscricaoService(InscricaoRepository inscricoes, InscricaoNotaRepository notas,
                            InscricaoConfiguracaoRepository configuracoes, ResponsaveisDaInscricao responsaveis,
                            AlunoService alunos, ConviteService convites, Auditoria auditoria,
                            @Value("${treinos.limites.inscricao-consultoria-dia:200}") int limiteDiario) {
        if (limiteDiario < 1) {
            throw new IllegalArgumentException("Limite diário de inscrições inválido.");
        }
        this.limiteDiario = limiteDiario;
        this.inscricoes = inscricoes;
        this.notas = notas;
        this.configuracoes = configuracoes;
        this.responsaveis = responsaveis;
        this.alunos = alunos;
        this.convites = convites;
        this.auditoria = auditoria;
    }

    // ---- Público (com a consultoria do link no TenantContext) ----

    /** Texto do link aberto; o código é conferido de novo aqui (pode ter mudado depois da busca). */
    @Transactional(readOnly = true)
    public String textoDoLink(String codigo) {
        return linkAberto(codigo).getTexto();
    }

    /**
     * Grava a inscrição com o responsável padrão do link (se ainda for membro ativo). Com texto da consultoria, a ciência
     * é obrigatória e a inscrição guarda o texto que a pessoa viu e a hora.
     *
     * <p>Teto por consultoria em 24 h (revisão de segurança de 19/10): o limite por IP do controller não segura quem troca
     * de endereço (um bloco IPv6 tem endereços sem fim) e a verificação humana nasce desligada; sem o teto, o link
     * público enchia a fila e o banco sem limite. Passou do teto: 429, a mesma resposta de quem tentou demais.
     */
    @Transactional
    public void registrarPublica(String codigo, InscricaoPublicaRequest r) {
        InscricaoConfiguracao link = linkAberto(codigo);
        if (inscricoes.countByCriadaEmAfter(Instant.now().minus(JANELA_DO_TETO)) >= limiteDiario) {
            throw new MuitasRequisicoesException(JANELA_DO_TETO.toSeconds());
        }
        String texto = link.getTexto();
        if (texto != null && !Boolean.TRUE.equals(r.cienciaPrivacidade())) {
            throw new BadRequestException("Confirme que leu o texto da consultoria para enviar.", "CIENCIA_OBRIGATORIA");
        }
        String whatsapp = Formatos.telefone(r.whatsapp());
        UUID responsavel = responsaveis.ativo(link.getResponsavelId()) ? link.getResponsavelId() : null;
        inscricoes.save(new Inscricao(r.nome().trim(), whatsapp, Buscas.opcional(r.email()), Buscas.opcional(r.objetivo()),
                Buscas.opcional(r.observacao()), texto, responsavel));
    }

    private InscricaoConfiguracao linkAberto(String codigo) {
        return configuracoes.atual().filter(c -> c.isAberta() && c.getCodigo().equals(codigo))
                .orElseThrow(InscricaoPublicaService::linkInvalido);
    }

    // ---- Fila da equipe ----

    /**
     * {@code situacao}: {@code ABERTAS} (padrão: nova, em contato, em negociação), {@code TODAS} ou uma situação.
     * {@code responsavelId} preenchido = "Meus". Mais novas primeiro.
     */
    @Transactional(readOnly = true)
    public PaginaInscricoes listar(String situacao, UUID responsavelId, int pagina, int tamanho) {
        Set<SituacaoInscricao> filtro = filtro(situacao);
        Page<Inscricao> page = inscricoes.buscar(filtro, responsavelId,
                PageRequest.of(Math.max(0, pagina), Math.clamp(tamanho, 1, 100)));
        List<Inscricao> lista = page.getContent();
        Map<UUID, Duplicidade> duplicidades = duplicidades(lista);
        Map<UUID, String> nomes = responsaveis.nomes(lista.stream().map(Inscricao::getResponsavelId).toList());
        List<InscricaoResumo> itens = lista.stream().map(i -> new InscricaoResumo(i.getId(), i.getNome(), textoLivre(i, i.getObjetivo()),
                i.getWhatsapp(), i.getEmail(), i.getSituacao(), i.getPagamento(), i.getResponsavelId(),
                nomes.get(i.getResponsavelId()), alunoVisivel(i.getAlunoId()), i.getCriadaEm(),
                duplicidades.getOrDefault(i.getId(), Duplicidade.NENHUMA))).toList();
        return new PaginaInscricoes(itens, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public InscricaoDetalhe detalhe(UUID id) {
        return detalhe(buscar(id));
    }

    /** Situação (menos aceitar e recusar, que têm rota própria), pagamento manual e responsável, com a versão lida. */
    @Transactional
    @Auditar(acao = "INSCRICAO_ALTERADA", entidade = "INSCRICAO", resumo = "Alterou o andamento de uma inscrição.")
    public InscricaoDetalhe alterar(UUID id, AlterarInscricaoRequest r, UUID quem) {
        Inscricao i = inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
        exigirVersao(i, r.versao());
        SituacaoInscricao nova = r.situacao();
        if (i.getSituacao() == SituacaoInscricao.ACEITA) {
            if (nova != SituacaoInscricao.ACEITA) {
                throw new ConflictException("A inscrição já foi aceita e virou aluno; a situação não muda mais.",
                        "INSCRICAO_JA_ACEITA");
            }
        } else if (nova == SituacaoInscricao.ACEITA) {
            throw new BadRequestException("Para aceitar, use Aceitar: ele cadastra o aluno.");
        } else if (nova == SituacaoInscricao.RECUSADA && i.getSituacao() != SituacaoInscricao.RECUSADA) {
            throw new BadRequestException("Para recusar, use Recusar.");
        }
        if (nova != i.getSituacao()) i.alterarSituacao(nova);
        if (!java.util.Objects.equals(r.responsavelId(), i.getResponsavelId())) {
            i.alterarResponsavel(responsaveis.exigirValido(r.responsavelId()));
        }
        boolean confirmou = r.pagamento() == PagamentoInscricao.CONFIRMADO_MANUAL
                && i.getPagamento() != PagamentoInscricao.CONFIRMADO_MANUAL;
        i.alterarPagamento(r.pagamento(), quem);
        if (confirmou) {
            auditoria.registrarEvento("INSCRICAO_PAGAMENTO_CONFIRMADO", "INSCRICAO", i.getId(),
                    "Registrou o pagamento de uma inscrição como confirmado manualmente.");
        }
        return detalhe(inscricoes.saveAndFlush(i));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_NOTA_ADICIONADA", entidade = "INSCRICAO", resumo = "Acrescentou uma nota a uma inscrição.")
    public InscricaoDetalhe acrescentarNota(UUID id, NotaRequest r, UUID autor) {
        Inscricao i = buscar(id);
        notas.saveAndFlush(new InscricaoNota(i.getId(), autor, r.texto().trim()));
        return detalhe(i);
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_RECUSADA", entidade = "INSCRICAO", resumo = "Recusou uma inscrição.")
    public InscricaoDetalhe recusar(UUID id, long versao) {
        Inscricao i = inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
        exigirNaoAceita(i);
        exigirVersao(i, versao);
        i.alterarSituacao(SituacaoInscricao.RECUSADA);
        return detalhe(inscricoes.saveAndFlush(i));
    }

    /**
     * Cria o aluno com nome, e-mail e o responsável da inscrição (sem responsável ativo, quem aceitou), marca a inscrição
     * como aceita e, com {@code convidar}, gera o convite de acesso (o link sai só nesta resposta). O objetivo vai para o
     * cadastro só para quem pode escrever dados sensíveis e se couber no campo do aluno. Tudo numa transação: limite do
     * plano, e-mail de aluno já existente ({@code ALUNO_JA_EXISTE}, com o id) ou aceite repetido ({@code INSCRICAO_JA_ACEITA})
     * não deixam nada pela metade.
     */
    @Transactional
    @Auditar(acao = "INSCRICAO_ACEITA", entidade = "INSCRICAO", resumo = "Aceitou uma inscrição e cadastrou o aluno.")
    public AceiteResponse aceitar(UUID id, AceitarRequest r) {
        boolean convidar = Boolean.TRUE.equals(r.convidar());
        if (convidar) AcessoAtual.exigir("ALUNO_CONVITE");
        Inscricao i = inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
        exigirNaoAceita(i);
        exigirVersao(i, r.versao());
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
        i.aceitar(aluno.id());
        inscricoes.saveAndFlush(i);
        ConviteResponse convite = convidar ? convites.gerar(aluno.id()) : null;
        return new AceiteResponse(i.getId(), aluno.id(), convite);
    }

    // ---- Auxiliares ----

    private Inscricao buscar(UUID id) {
        return inscricoes.findById(id).orElseThrow(InscricaoService::naoEncontrada);
    }

    private InscricaoDetalhe detalhe(Inscricao i) {
        List<InscricaoNota> lista = notas.findByInscricaoIdOrderByCriadaEmAsc(i.getId());
        List<UUID> pessoas = new ArrayList<>();
        pessoas.add(i.getResponsavelId());
        pessoas.add(i.getPagamentoConfirmadoPor());
        lista.forEach(n -> pessoas.add(n.getAutorId()));
        Map<UUID, String> nomes = responsaveis.nomes(pessoas);
        return new InscricaoDetalhe(i.getId(), i.getNome(), i.getWhatsapp(), i.getEmail(), textoLivre(i, i.getObjetivo()),
                textoLivre(i, i.getObservacao()), i.getCienciaEm(), i.getCienciaTexto(), i.getSituacao(), i.getPagamento(),
                nomes.get(i.getPagamentoConfirmadoPor()), i.getPagamentoConfirmadoEm(), i.getResponsavelId(),
                nomes.get(i.getResponsavelId()), alunoVisivel(i.getAlunoId()), i.getCriadaEm(), i.getAtualizadaEm(),
                i.getVersao(), duplicidades(List.of(i)).getOrDefault(i.getId(), Duplicidade.NENHUMA),
                lista.stream().map(n -> new Nota(n.getId(), n.getTexto(), n.getAutorId(), nomes.get(n.getAutorId()),
                        n.getCriadaEm())).toList());
    }

    /**
     * Aviso de duplicidade das inscrições não aceitas: aluno com o mesmo e-mail e outras inscrições abertas com o mesmo
     * e-mail ou WhatsApp. Três consultas por página, nunca uma por linha.
     */
    private Map<UUID, Duplicidade> duplicidades(List<Inscricao> lista) {
        List<Inscricao> conferir = lista.stream().filter(i -> i.getSituacao() != SituacaoInscricao.ACEITA).toList();
        if (conferir.isEmpty()) return Map.of();
        Set<String> emails = conferir.stream().map(Inscricao::getEmail).filter(java.util.Objects::nonNull)
                .map(e -> e.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        Set<String> whatsapps = conferir.stream().map(Inscricao::getWhatsapp).collect(Collectors.toSet());
        Collection<String> emailsDaConsulta = emails.isEmpty() ? List.of("") : emails;
        var abertas = inscricoes.abertasComContato(SituacaoInscricao.ABERTAS, emailsDaConsulta, whatsapps);
        Map<String, UUID> alunoPorEmail = new HashMap<>();
        if (!emails.isEmpty()) {
            inscricoes.alunosComEmail(emails).forEach(a -> alunoPorEmail.putIfAbsent(a.email(), a.id()));
        }
        boolean podeVerAlunos = AcessoAtual.pode("ALUNO_LER");
        Map<UUID, Duplicidade> resultado = new HashMap<>();
        for (Inscricao i : conferir) {
            String email = i.getEmail() == null ? null : i.getEmail().toLowerCase(Locale.ROOT);
            int outras = (int) abertas.stream().filter(c -> !c.id().equals(i.getId()))
                    .filter(c -> i.getWhatsapp().equals(c.whatsapp()) || (email != null && email.equals(c.email())))
                    .count();
            UUID aluno = email == null ? null : alunoPorEmail.get(email);
            if (aluno != null || outras > 0) {
                resultado.put(i.getId(), new Duplicidade(aluno != null, podeVerAlunos ? aluno : null, outras));
            }
        }
        return resultado;
    }

    /**
     * Objetivo e observação da inscrição aceita: ela virou aluno e segue as regras do aluno, cuja ficha só mostra o
     * objetivo e as observações a quem tem {@code ALUNO_SENSIVEL_LER} (revisão de segurança de 19/10: o Assistente,
     * que atende interessados sem essa permissão, lia pela inscrição o objetivo que a ficha esconde dele). Antes do
     * aceite o texto é de quem atende a fila.
     */
    private static String textoLivre(Inscricao i, String texto) {
        return i.getSituacao() == SituacaoInscricao.ACEITA && !AcessoAtual.pode("ALUNO_SENSIVEL_LER") ? null : texto;
    }

    /** O id do aluno só sai para quem pode abrir a ficha. */
    private static UUID alunoVisivel(UUID alunoId) {
        return alunoId != null && AcessoAtual.pode("ALUNO_LER") ? alunoId : null;
    }

    private static Set<SituacaoInscricao> filtro(String situacao) {
        String valor = situacao == null || situacao.isBlank() ? "ABERTAS" : situacao.trim().toUpperCase(Locale.ROOT);
        if (valor.equals("ABERTAS")) return SituacaoInscricao.ABERTAS;
        if (valor.equals("TODAS")) return EnumSet.allOf(SituacaoInscricao.class);
        try {
            return EnumSet.of(SituacaoInscricao.valueOf(valor));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Situação precisa ser ABERTAS, TODAS ou uma situação da inscrição.");
        }
    }

    private static void exigirVersao(Inscricao i, Long versao) {
        if (versao == null || !versao.equals(i.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou esta inscrição. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    /** Aceite repetido (ou recusa depois do aceite): 409 com o aluno criado, sem criar outro. */
    private static void exigirNaoAceita(Inscricao i) {
        if (i.getSituacao() != SituacaoInscricao.ACEITA) return;
        String mensagem = "Esta inscrição já foi aceita e virou aluno.";
        UUID aluno = alunoVisivel(i.getAlunoId());
        if (aluno != null) throw new ConflitoComRecursoException(mensagem, "INSCRICAO_JA_ACEITA", "alunoId", aluno);
        throw new ConflictException(mensagem, "INSCRICAO_JA_ACEITA");
    }

    private static NaoEncontradoException naoEncontrada() {
        return new NaoEncontradoException("Inscrição não encontrada.");
    }
}
