package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoResumo;
import br.com.treinos.api.alunos.dto.AlunoDtos.PaginaAlunos;
import br.com.treinos.api.alunos.dto.AlunoDtos.PlanoAtivoResumo;
import br.com.treinos.api.alunos.dto.AlunoDtos.SituacaoAtualizacao;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.atualizacoes.RegrasAtualizacao;
import br.com.plataforma.comum.auth.Autenticador;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Buscas;
import br.com.plataforma.comum.web.ConflictException;
import br.com.plataforma.comum.web.ForbiddenException;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.ValidacaoException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;

/** Alunos da consultoria do treinador. Aluno de outra consultoria não é encontrado (404). */
@Service
public class AlunoService {

    private static final Set<String> SITUACOES = Set.of("ATIVO", "INATIVO", "TODOS");
    private static final int LOTE_DE_IDS = 1000;

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final Autenticador autenticador;
    private final PlanoTreinoRepository planos;
    private final ExecucaoSerieRepository execucoes;
    private final br.com.treinos.api.auditoria.Auditoria auditoria;
    private final AtualizacaoRepository atualizacoes;
    private final br.com.treinos.api.conta.PlanoDaConsultoria plano;
    private final br.com.treinos.api.pagamentos.PagamentosDoAluno pagamentos;
    private final br.com.treinos.api.ciclo.CicloMenstrualService ciclo;
    private final br.com.treinos.api.agenda.AgendaService agenda;
    private final ConsultoriaRepository consultorias;
    private final br.com.treinos.api.pastas.PastaRepository pastas;

    public AlunoService(AlunoRepository alunos, UsuarioRepository usuarios, Autenticador autenticador,
                        PlanoTreinoRepository planos, ExecucaoSerieRepository execucoes,br.com.treinos.api.auditoria.Auditoria auditoria,
                        AtualizacaoRepository atualizacoes, br.com.treinos.api.conta.PlanoDaConsultoria plano,
                        br.com.treinos.api.pagamentos.PagamentosDoAluno pagamentos,
                        br.com.treinos.api.ciclo.CicloMenstrualService ciclo,
                        br.com.treinos.api.agenda.AgendaService agenda, ConsultoriaRepository consultorias,
                        br.com.treinos.api.pastas.PastaRepository pastas) {
        this.pastas = pastas;
        this.agenda = agenda;
        this.consultorias = consultorias;
        this.plano = plano;
        this.pagamentos = pagamentos;
        this.ciclo = ciclo;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.autenticador = autenticador;
        this.planos = planos;
        this.execucoes = execucoes;
        this.auditoria = auditoria;
        this.atualizacoes = atualizacoes;
    }

    @Transactional(readOnly = true)
    public PaginaAlunos listar(String busca, String situacao, int pagina, int tamanho) {
        return listar(busca,situacao,pagina,tamanho,false);
    }

    @Transactional(readOnly = true)
    public PaginaAlunos listar(String busca, String situacao, int pagina, int tamanho, boolean meus) {
        return listar(busca, situacao, pagina, tamanho, meus, FiltrosDaListaDeAlunos.Pedido.vazio());
    }

    /**
     * Lista paginada com os filtros avançados ({@link FiltrosDaListaDeAlunos}). Sem filtro calculado, a página sai do
     * banco como sempre; com algum (atualização, pasta a renovar, último registro), lê os candidatos do escopo (já
     * filtrados no banco pelo resto), aplica os calculados em memória e só então corta a página: o {@code total} é quantos
     * passaram em todos os filtros. Ordem por nome. A resposta não muda.
     */
    @Transactional(readOnly = true)
    public PaginaAlunos listar(String busca, String situacao, int pagina, int tamanho, boolean meus,
                               FiltrosDaListaDeAlunos.Pedido pedido) {
        String filtro = situacao == null ? "ATIVO" : situacao.toUpperCase(Locale.ROOT);
        if (!SITUACOES.contains(filtro)) {
            throw new BadRequestException("Situação precisa ser ATIVO, INATIVO ou TODOS.", FiltrosDaListaDeAlunos.CODIGO);
        }
        FiltrosDaListaDeAlunos filtros = FiltrosDaListaDeAlunos.ler(pedido, meus);
        exigirPermissoesDosFiltros(filtros);
        Set<UUID> responsaveis = meus ? Set.of(((br.com.treinos.api.security.UsuarioAutenticado)
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal()).usuarioId())
                : filtros.responsaveis();
        if (!meus) responsaveis.forEach(this::exigirResponsavel);
        Specification<Aluno> consulta = filtros.especificacao(Buscas.padrao(busca), filtro, responsaveis);
        int numero = Math.max(0, pagina);
        int porPagina = Math.clamp(tamanho, 1, 100);
        List<Aluno> daPagina;
        long total;
        if (filtros.temCalculado()) {
            List<Aluno> passaram = aplicarCalculados(alunos.findAll(consulta), filtros);
            total = passaram.size();
            long inicio = (long) numero * porPagina;
            daPagina = inicio >= total ? List.of()
                    : passaram.subList((int) inicio, (int) Math.min(total, inicio + porPagina));
        } else {
            Page<Aluno> page = alunos.findAll(consulta, PageRequest.of(numero, porPagina));
            daPagina = page.getContent();
            total = page.getTotalElements();
        }
        List<UUID> ids = daPagina.stream().map(Aluno::getId).toList();
        Map<UUID, PlanoTreino> planoAtivo = ids.isEmpty() ? Map.of() : planos.findByAlunoIdInAndAtivoTrue(ids).stream()
                .collect(Collectors.toMap(PlanoTreino::getAlunoId, p -> p));
        Map<UUID, LocalDate> ultimo = ultimosRegistros(ids);
        Map<UUID, SituacaoAtualizacao> situacoes = situacoesDasAtualizacoes(ids);
        List<AlunoResumo> itens = daPagina.stream().map(a -> {
            PlanoTreino p = planoAtivo.get(a.getId());
            return new AlunoResumo(a.getId(), a.getNome(), a.isAtivo(), a.getUsuarioId() != null,
                    (p == null || !br.com.treinos.api.equipe.AcessoAtual.pode("TREINO_LER")) ? null : new PlanoAtivoResumo(p.getId(), p.getTitulo()), br.com.treinos.api.equipe.AcessoAtual.pode("REGISTRO_LER") ? ultimo.get(a.getId()) : null,a.getResponsavelId(),
                    situacoes.get(a.getId()));
        }).toList();
        return new PaginaAlunos(itens, total);
    }

    /** Cada filtro pede a permissão de quem já vê aquele dado na lista; sem ela, 403 (o app nem mostra o filtro). */
    private static void exigirPermissoesDosFiltros(FiltrosDaListaDeAlunos f) {
        boolean semPermissao = (!f.atualizacao().isEmpty() && !(br.com.treinos.api.equipe.AcessoAtual.pode("ATUALIZACAO_LER")
                        && br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_LER")))
                || ((f.plano() != null || f.pastaARenovar()) && !br.com.treinos.api.equipe.AcessoAtual.pode("TREINO_LER"))
                || (f.registro() != null && !br.com.treinos.api.equipe.AcessoAtual.pode("REGISTRO_LER"));
        if (semPermissao) {
            throw new ForbiddenException("Seu perfil não permite este filtro.", "PERMISSAO_NEGADA");
        }
    }

    /** O responsável escolhido no filtro precisa ser membro da equipe desta consultoria (senão 404), como em {@code GET /atualizacoes}. */
    private void exigirResponsavel(UUID id) {
        boolean daEquipe = usuarios.findById(id)
                .filter(u -> u.getConsultoriaId() != null && u.getConsultoriaId().equals(br.com.treinos.api.tenant.TenantContext.get())
                        && u.getPapel() == br.com.treinos.api.auth.Papel.TREINADOR)
                .isPresent();
        if (!daEquipe) throw new NaoEncontradoException("Responsável não encontrado.");
    }

    /** Atualização, pasta a renovar e último registro, nessa ordem, sobre os candidatos (que já vêm em ordem de nome). */
    private List<Aluno> aplicarCalculados(List<Aluno> candidatos, FiltrosDaListaDeAlunos f) {
        List<Aluno> resto = candidatos;
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        if (!f.atualizacao().isEmpty() && !resto.isEmpty()) {
            Map<UUID, String> fases = new HashMap<>();
            for (List<UUID> lote : lotes(resto)) {
                atualizacoes.linhasDosAlunos(lote).forEach(l -> fases.put(l.alunoId(),
                        RegrasAtualizacao.calcular(hoje, l.data(), l.atrasoAte(), l.estado()).fase()));
            }
            resto = resto.stream().filter(a -> f.atualizacao().contains(fases.getOrDefault(a.getId(), FiltrosDaListaDeAlunos.SEM_PASTA))).toList();
        }
        if (f.pastaARenovar() && !resto.isEmpty()) {
            // A mesma consulta do painel (PastaRepository.aRenovar): só alunos ativos, fim até hoje + 7.
            Set<UUID> aRenovar = pastas.aRenovar(null, hoje.plusDays(br.com.treinos.api.painel.PainelService.DIAS_PARA_RENOVAR)).stream()
                    .map(br.com.treinos.api.pastas.PastaPlano::getAlunoId).collect(Collectors.toSet());
            resto = resto.stream().filter(a -> aRenovar.contains(a.getId())).toList();
        }
        if (f.registro() != null && !resto.isEmpty()) {
            Map<UUID, LocalDate> ultimo = ultimosRegistros(resto.stream().map(Aluno::getId).toList());
            FiltrosDaListaDeAlunos.Registro r = f.registro();
            resto = resto.stream().filter(a -> {
                LocalDate data = ultimo.get(a.getId());
                return r == FiltrosDaListaDeAlunos.Registro.NUNCA ? data == null
                        : data != null && data.isBefore(hoje.minusDays(r.dias()));
            }).toList();
        }
        return resto;
    }

    private Map<UUID, LocalDate> ultimosRegistros(List<UUID> ids) {
        Map<UUID, LocalDate> ultimo = new HashMap<>();
        for (List<UUID> lote : lotesDeIds(ids)) {
            execucoes.ultimoRegistro(lote).forEach(u -> ultimo.put(u.alunoId(), u.data()));
        }
        return ultimo;
    }

    /** Lotes de até {@value #LOTE_DE_IDS} ids, para o {@code in} das consultas não crescer sem limite. */
    private static List<List<UUID>> lotes(List<Aluno> alunosDoLote) {
        return lotesDeIds(alunosDoLote.stream().map(Aluno::getId).toList());
    }

    private static List<List<UUID>> lotesDeIds(List<UUID> ids) {
        List<List<UUID>> lotes = new ArrayList<>();
        for (int i = 0; i < ids.size(); i += LOTE_DE_IDS) {
            lotes.add(ids.subList(i, Math.min(ids.size(), i + LOTE_DE_IDS)));
        }
        return lotes;
    }

    /** Mesma exigência dos painéis de atualização: ler atualizações e dados sensíveis (as respostas são de saúde). */
    private Map<UUID, SituacaoAtualizacao> situacoesDasAtualizacoes(List<UUID> ids) {
        if (ids.isEmpty() || !br.com.treinos.api.equipe.AcessoAtual.pode("ATUALIZACAO_LER")
                || !br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_LER")) {
            return Map.of();
        }
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        Map<UUID, SituacaoAtualizacao> situacoes = new HashMap<>();
        atualizacoes.linhasDosAlunos(ids).forEach(l -> {
            var r = RegrasAtualizacao.calcular(hoje, l.data(), l.atrasoAte(), l.estado());
            situacoes.put(l.alunoId(), new SituacaoAtualizacao(l.atualizacaoId(), r.fase(), l.data(), r.diasParaData(),
                    r.diasDeAtraso(), l.atrasoAte()));
        });
        return situacoes;
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ALUNO_CRIADO",entidade="ALUNO",resumo="Cadastrou um aluno.")
    public AlunoDetalhe criar(AlunoRequest r) {
        exigirEscritaSensivel(r);
        plano.exigirVagaDeAluno();
        boolean sensivel = br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR");
        Dados dados = Dados.de(r, sensivel);
        Aluno aluno = new Aluno(r.nome().trim(), email(r.email()), Buscas.opcional(r.objetivo()),
                Buscas.opcional(r.observacoes()), r.diasAtualizacao());
        // Aluno novo nunca tem acesso: o telefone fica no cadastro até o acesso existir (V048).
        aluno.guardarTelefoneSemAcesso(dados.telefone());
        if (sensivel) {
            exigirCpfLivre(dados.cpf(), null);
            aluno.alterarCpf(dados.cpf());
            aluno.alterarEndereco(dados.endereco());
        }
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null && auth.getPrincipal() instanceof br.com.treinos.api.security.UsuarioAutenticado eu) aluno.alterarResponsavel(eu.usuarioId());
        else usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(br.com.treinos.api.tenant.TenantContext.get(),br.com.treinos.api.auth.Papel.TREINADOR).stream().findFirst().ifPresent(u -> aluno.alterarResponsavel(u.getId()));
        definirResponsavel(aluno,r.responsavelId());
        aplicarSexo(aluno, r.sexo());
        return detalheDe(gravar(aluno));
    }

    @Transactional(readOnly = true)
    public AlunoDetalhe detalhe(UUID id) {
        return detalheDe(buscar(id));
    }

    /**
     * A ficha com o telefone e o e-mail de login do usuário do aluno (nulos se ele ainda não tem acesso). Toda resposta que devolve o aluno
     * passa por aqui, para o telefone nunca sumir de uma tela que o mostra.
     */
    public AlunoDetalhe detalheDe(Aluno aluno) {
        Usuario usuario = aluno.getUsuarioId() == null ? null : usuarios.findById(aluno.getUsuarioId()).orElse(null);
        return AlunoDetalhe.de(aluno, usuario);
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ALUNO_ALTERADO",entidade="ALUNO",resumo="Editou o cadastro do aluno.")
    public AlunoDetalhe alterar(UUID id, AlunoRequest r) {
        Aluno aluno = buscar(id);
        exigirNaoAnonimizado(aluno);
        if (r.versao() == null || !r.versao().equals(aluno.getVersao())) {
            throw conflitoDeEdicao();
        }
        exigirEscritaSensivel(r);
        boolean sensivel = br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR");
        Dados dados = Dados.de(r, sensivel);
        aluno.alterarDados(r.nome().trim(), email(r.email()), sensivel ? Buscas.opcional(r.objetivo()) : aluno.getObjetivo(),
                sensivel ? Buscas.opcional(r.observacoes()) : aluno.getObservacoes(), r.diasAtualizacao());
        if (sensivel) { // sem a permissão, CPF e endereço do corpo são ignorados e o que está gravado fica
            if (dados.cpf() != null && !dados.cpf().equals(aluno.getCpf())) exigirCpfLivre(dados.cpf(), aluno.getId());
            aluno.alterarCpf(dados.cpf());
            aluno.alterarEndereco(dados.endereco());
        }
        // O JSON sem "sexo" chega aqui como nulo (o DTO não distingue ausente de nulo): nulo não altera o sexo nem desliga o ciclo.
        // Quem apaga o sexo é a própria aluna (PUT /aluno/meus-dados); texto em branco ainda limpa, como em aplicarSexo.
        if (r.sexo() != null) {
            aplicarSexo(aluno, r.sexo());
        }
        trocarTelefone(aluno, r.telefone(), dados.telefone());
        UUID anterior=aluno.getResponsavelId();
        definirResponsavel(aluno,r.responsavelId());
        if(!java.util.Objects.equals(anterior,aluno.getResponsavelId()))
            auditoria.registrarEvento("ALUNO_RESPONSAVEL_ALTERADO","ALUNO",aluno.getId(),"Alterou o responsável do aluno.");
        return detalheDe(gravar(aluno));
    }

    /**
     * Ativar/inativar (decisão do treinador; "sem registro" nunca inativa ninguém). Inativar derruba as sessões do
     * aluno na hora (versão das credenciais nova, refresh apagados) e bloqueia o login até reativar.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="ALUNO_SITUACAO",entidade="ALUNO",resumo="Alterou a situação do aluno.")
    public AlunoDetalhe alterarSituacao(UUID id, boolean ativo) {
        travarConsultoria(); // antes de travar o aluno: a ordem da agenda (D18) e a da vaga do plano
        Aluno aluno = alunos.buscarParaAlterar(id).orElseThrow(AlunoService::naoEncontrado);
        if (ativo) {
            exigirNaoAnonimizado(aluno);
            if (!aluno.isAtivo()) plano.exigirVagaDeAluno(); // reativar ocupa uma vaga; PATCH em quem já está ativo não
        }
        aplicarSituacao(aluno, ativo);
        return detalheDe(alunos.saveAndFlush(aluno));
    }

    /**
     * Trava a linha da consultoria. Quem muda a situação do aluno chama isto ANTES de travar o aluno
     * ({@code buscarParaAlterar}): a agenda trava a consultoria e depois insere participantes (FK para o aluno), e o
     * cancelamento dos compromissos futuros (D18) escreve na agenda; consultoria e depois aluno é a única ordem sem
     * travar em círculo. Reativar também entra aqui, onde a vaga do plano já trava a consultoria depois do aluno.
     */
    void travarConsultoria() {
        if (consultorias.travar(br.com.treinos.api.tenant.TenantContext.get()).isEmpty()) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
    }

    /**
     * Muda a situação do aluno e do acesso dele; inativar encerra as sessões e cancela os compromissos futuros (D18, na
     * mesma transação; reativar não devolve nada). A consultoria já deve estar travada por quem chama ({@link #travarConsultoria}).
     * Usado também pelo lote.
     */
    void aplicarSituacao(Aluno aluno, boolean ativo) {
        aluno.alterarSituacao(ativo, Instant.now());
        if (!ativo) {
            agenda.cancelarFuturosDoAluno(aluno.getId()); // antes de encerrarSessoes, que não se desfaz
        }
        if (aluno.getUsuarioId() != null) {
            usuarios.buscarParaAlterar(aluno.getUsuarioId()).ifPresent(u -> u.alterarAtivo(ativo));
            if (!ativo) {
                autenticador.encerrarSessoes(aluno.getUsuarioId().toString());
            }
        }
        if (!ativo) {
            pagamentos.encerrarPorSaida(aluno.getId()); // quem saiu não fica na receita recorrente nem na inadimplência
        }
    }

    /**
     * A situação pela Importação: as mesmas consequências da rota ({@link #alterarSituacao}) e o mesmo evento
     * {@code ALUNO_SITUACAO}, só que sem {@code @Auditar}, porque a confirmação já é uma transação que grava um único
     * {@code IMPORTACAO_CONCLUIDA}. A vaga do plano NÃO é conferida aqui: o gravador já a reservou antes (conferir de novo
     * contaria duas vezes). Só para aluno que já existe e cuja situação de fato muda.
     */
    public void aplicarSituacaoDaImportacao(Aluno aluno, boolean ativo) {
        if (ativo) {
            exigirNaoAnonimizado(aluno);
        }
        aplicarSituacao(aluno, ativo);
        auditoria.registrarEvento("ALUNO_SITUACAO", "ALUNO", aluno.getId(), "Alterou a situação do aluno.");
    }

    /** Nulo apaga. Valor fora do enum é 422 no campo, sem repetir o valor. */
    public void definirSexo(Aluno aluno, String informado) {
        exigirNaoAnonimizado(aluno);
        aplicarSexo(aluno, informado);
    }

    @Transactional // buscarParaAlterar trava a linha e exige transação
    public void definirSexo(UUID id, String informado) {
        definirSexo(alunos.buscarParaAlterar(id).orElseThrow(AlunoService::naoEncontrado), informado);
    }

    /** Mensagem fixa do sexo fora do enum (campo {@code sexo}); nunca repete o valor enviado. */
    static final String SEXO_INVALIDO = "Escolha Masculino, Feminino ou Outro.";

    /** O 409 do lock otimista do cadastro; o mesmo na ficha do treinador e em "Meus dados" do aluno. */
    static ConflictException conflitoDeEdicao() {
        return new ConflictException("Outra pessoa ou aba alterou este aluno. Recarregue para ver a versão atual.",
                "CONFLITO_EDICAO");
    }

    void aplicarSexo(Aluno aluno, String informado) {
        if (informado != null && !informado.isBlank() && Sexo.ler(informado) == null) {
            throw new ValidacaoException("Confira os campos.", "ALUNO_INVALIDO",
                    List.of(new ApiError.FieldError("sexo", SEXO_INVALIDO)));
        }
        aluno.alterarSexo(Sexo.ler(informado));
        ciclo.desligarSeDeixouDeSerFeminino(aluno);
    }

    public static void exigirNaoAnonimizado(Aluno aluno) {
        if (aluno.isAnonimizado())
            throw new ConflictException("Este aluno foi anonimizado e não pode mais ser alterado.", "ALUNO_ANONIMIZADO");
    }

    /** Responsável tem de ser treinador ativo da mesma consultoria; sem id, não muda nada. Usado também pelo lote. */
    void definirResponsavel(Aluno aluno,UUID id) {
        if(id==null) return;
        var u=usuarios.findById(id).filter(v -> v.getConsultoriaId().equals(br.com.treinos.api.tenant.TenantContext.get())
                && v.isAtivo() && v.getPapel()==br.com.treinos.api.auth.Papel.TREINADOR)
                .orElseThrow(() -> new NaoEncontradoException("Responsável não encontrado."));
        aluno.alterarResponsavel(u.getId());
    }

    /** Objetivo e observações sem a permissão são recusados (403). CPF e endereço, ao contrário, são ignorados (ver {@link AlunoRequest}). */
    private static void exigirEscritaSensivel(AlunoRequest r) {
        if (r.objetivo() != null || r.observacoes() != null)
            br.com.treinos.api.equipe.AcessoAtual.exigir("ALUNO_SENSIVEL_ALTERAR");
    }

    /**
     * Telefone, CPF e endereço do corpo já conferidos e normalizados ({@code Formatos}). Falha de formato vira 422
     * {@code ALUNO_INVALIDO} com o campo em {@code fieldErrors} ({@code telefone}, {@code cpf}, {@code endereco.cep},
     * {@code endereco.uf}, {@code endereco.logradouro}...) e uma mensagem fixa do {@code Formatos} ou da {@code RegrasDoEndereco}, nunca o valor enviado. CPF e endereço só são lidos
     * (e conferidos) com {@code ALUNO_SENSIVEL_ALTERAR}.
     */
    record Dados(String telefone, String cpf, Endereco endereco) {
        static Dados de(AlunoRequest r, boolean sensivel) {
            var erros = new ArrayList<ApiError.FieldError>();
            String telefone = formato(erros, "telefone", Formatos::telefone, r.telefone());
            String cpf = sensivel ? formato(erros, "cpf", Formatos::cpf, r.cpf()) : null;
            Endereco endereco = sensivel ? endereco(erros, r.endereco()) : null;
            if (!erros.isEmpty()) {
                throw new ValidacaoException("Confira os dados do aluno.", "ALUNO_INVALIDO", erros);
            }
            return new Dados(telefone, cpf, endereco);
        }

        /** A regra única do endereço ({@link RegrasDoEndereco}); cada erro vira um campo {@code endereco.*}. */
        static Endereco endereco(List<ApiError.FieldError> erros, Endereco e) {
            RegrasDoEndereco.Resultado r = RegrasDoEndereco.normalizar(e);
            r.erros().forEach(x -> erros.add(new ApiError.FieldError("endereco." + x.campo(), x.mensagem())));
            return r.endereco();
        }

        static String formato(List<ApiError.FieldError> erros, String campo, UnaryOperator<String> formatar, String valor) {
            try {
                return formatar.apply(valor);
            } catch (BadRequestException recusado) {
                erros.add(new ApiError.FieldError(campo, recusado.getMessage()));
                return null;
            }
        }

        @Override
        public String toString() {
            return "Dados[...]";
        }
    }

    /** Antes de gravar: o CPF não pode ser de outro aluno da consultoria ({@code @TenantId} filtra). Nunca repete o valor. */
    void exigirCpfLivre(String cpf, UUID alunoId) {
        if (cpf == null) return;
        if (alunoId == null ? alunos.existsByCpf(cpf) : alunos.existsByCpfAndIdNot(cpf, alunoId)) throw cpfEmUso();
    }

    /** O mesmo 409 vale para a checagem prévia e para a corrida que só o índice {@code ux_aluno_cpf} pega. */
    public static ConflictException cpfEmUso() {
        return new ConflictException("Este CPF já está no cadastro de outro aluno.", "ALUNO_CPF_EM_USO");
    }

    /** Violação do índice único do CPF. Só olha o nome da restrição: a mensagem do banco pode trazer o valor. */
    public static boolean violouCpf(DataIntegrityViolationException e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c && "ux_aluno_cpf".equals(c.getConstraintName())) {
                return true;
            }
        }
        return false;
    }

    public static ConflictException semAcesso() {
        return new ConflictException("O telefone entra depois que o aluno criar o acesso.", "ALUNO_SEM_ACESSO");
    }

    /** Grava e traduz a corrida do CPF (a checagem prévia não pega duas gravações ao mesmo tempo) sem repetir o valor. */
    Aluno gravar(Aluno aluno) {
        try {
            return alunos.saveAndFlush(aluno);
        } catch (DataIntegrityViolationException e) {
            if (violouCpf(e)) throw cpfEmUso();
            throw e;
        }
    }

    /**
     * O telefone mora no usuário do aluno. Nulo no corpo = não mexe; em branco = apaga; preenchido = grava (já
     * normalizado). Quem ainda não tem acesso guarda o telefone no próprio cadastro (V048), que passa ao usuário quando o
     * acesso for criado.
     */
    void trocarTelefone(Aluno aluno, String bruto, String normalizado) {
        if (bruto == null) return;
        if (aluno.getUsuarioId() == null) {
            aluno.guardarTelefoneSemAcesso(normalizado);
            return;
        }
        usuarios.buscarParaAlterar(aluno.getUsuarioId()).ifPresent(u -> u.alterarTelefone(normalizado));
    }

    private Aluno buscar(UUID id) {
        return alunos.findById(id).orElseThrow(AlunoService::naoEncontrado);
    }

    private static String email(String email) {
        return email == null || email.isBlank() ? null : email.trim();
    }

    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Aluno não encontrado.");
    }
}
