package br.com.treinos.api.planos;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.dto.PlanoDtos.CriarPlanoRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoDetalhe;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoPublicado;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoResumo;
import br.com.treinos.api.planos.dto.PlanoDtos.PublicarRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.ReplicarRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.SalvarRascunhoRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.VersaoDetalhe;
import br.com.treinos.api.planos.dto.PlanoDtos.VersaoResumo;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Ciclo de vida comum aos planos de treino e de dieta: rascunho editável com lock otimista, validação,
 * publicação em versão imutável (o plano publicado vira o vigente do aluno e desliga o anterior na mesma transação),
 * replicação para o próximo ciclo e consulta das versões. Tudo isolado pela consultoria ({@code @TenantId}): plano ou
 * aluno de outra consultoria simplesmente não é encontrado (404).
 *
 * @param <P> entidade do plano
 * @param <V> entidade da versão publicada
 * @param <C> conteúdo (JSON) do plano
 */
public abstract class PlanoServiceBase<P extends PlanoBase, V extends VersaoBase, C> {

    /** Versão publicada vigente de um aluno, com o conteúdo já convertido. */
    public record VersaoAtiva<P, V, C>(P plano, V versao, C conteudo) {
    }

    private final PlanoRepositorio<P> planos;
    private final VersaoRepositorio<V> versoes;
    private final AlunoRepository alunos;
    private final PastaRepository pastas;
    protected final JsonMapper json;
    private final Class<C> classe;
    private final String nomeDoPlano;

    protected PlanoServiceBase(PlanoRepositorio<P> planos, VersaoRepositorio<V> versoes, AlunoRepository alunos,
                               PastaRepository pastas, JsonMapper json, Class<C> classe, String nomeDoPlano) {
        this.planos = planos;
        this.versoes = versoes;
        this.alunos = alunos;
        this.pastas = pastas;
        this.json = json;
        this.classe = classe;
        this.nomeDoPlano = nomeDoPlano;
    }

    protected abstract P novoPlano(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho);

    protected abstract V novaVersao(P plano, int numero, String conteudo, UUID publicadoPor, Instant quando);

    protected abstract C vazio();

    protected abstract C comUidsNovos(C conteudo);

    protected abstract C daReceita(UUID receitaId);

    protected abstract ResultadoValidacao validar(C conteudo, LocalDate inicio, LocalDate fim);

    /**
     * Conteúdo como sai nas respostas do treinador (detalhe, versão): o plano pode esconder o que o perfil não vê.
     * Nunca vale para o que vai ao aluno ({@code versaoAtiva}, {@code versaoPublicadaDaPasta}). Padrão: igual.
     */
    protected C paraLeitura(C conteudo) {
        return conteudo;
    }

    /** Conteúdo que de fato vai para o rascunho, dado o que já estava nele (ex.: parte que o perfil não pode alterar). */
    protected C paraGravarRascunho(C novo, C atual, P plano) {
        return novo;
    }

    /**
     * Conteúdo que vai para a versão publicada (imutável), já validado. O plano pode completar com o que o servidor sabe
     * e o rascunho não precisa guardar (a dieta copia os fatores dos alimentos da biblioteca). O rascunho não muda.
     * Padrão: igual.
     */
    protected C paraPublicar(C conteudo) {
        return conteudo;
    }

    /** Cópia do conteúdo de um plano de OUTRO aluno: o plano pode deixar de levar o que é pessoal. Padrão: igual. */
    protected C paraCopiaDeOutroAluno(C conteudo) {
        return conteudo;
    }

    @Transactional(readOnly = true)
    public List<PlanoResumo> listar(UUID alunoId) {
        exigirAluno(alunoId);
        return planos.findByAlunoIdOrderByCriadoEmDesc(alunoId).stream().filter(p -> !p.isArquivado()).map(PlanoResumo::de).toList();
    }

    @Transactional
    public PlanoDetalhe<C> criar(UUID alunoId, CriarPlanoRequest r) {
        exigirAlunoParaGravar(alunoId);
        if (r.receitaId() != null && r.copiarDoPlanoId() != null) {
            throw new BadRequestException("Escolha uma receita ou um plano para copiar, não os dois.");
        }
        C conteudo;
        if (r.receitaId() != null) {
            conteudo = daReceita(r.receitaId());
        } else if (r.copiarDoPlanoId() != null) {
            // Só dentro do mesmo aluno: para outro aluno existe a rota auditada de copiar (permissões e conteúdo próprios).
            P origem = buscar(r.copiarDoPlanoId());
            if (!alunoId.equals(origem.getAlunoId())) {
                throw new NaoEncontradoException(nomeDoPlano + " não encontrado.");
            }
            conteudo = comUidsNovos(ler(origem.getRascunho()));
        } else {
            conteudo = vazio();
        }
        PastaPlano pasta = pastaDoAluno(r.pastaId(), alunoId);
        P novo = novoPlano(alunoId, r.titulo().trim(), pasta != null ? pasta.getInicio() : r.inicio(),
                pasta != null ? pasta.getFim() : r.fim(), escrever(conteudo));
        if (pasta != null) {
            novo.definirPasta(pasta.getId());
        }
        return detalhe(planos.saveAndFlush(novo));
    }

    @Transactional
    public void excluir(UUID id) { P plano = buscar(id); plano.arquivar(); planos.saveAndFlush(plano); }

    @Transactional(readOnly = true)
    public PlanoDetalhe<C> detalhe(UUID id) {
        return detalhe(buscar(id));
    }

    @Transactional
    public PlanoDetalhe<C> salvarRascunho(UUID id, SalvarRascunhoRequest<C> r) {
        P plano = buscar(id);
        exigirMesmaVersao(plano, r.versao());
        // Plano em pasta: a pasta dá o período (como no criar); início e fim do corpo são ignorados.
        PastaPlano pasta = plano.getPastaId() == null ? null : pastas.findById(plano.getPastaId()).orElse(null);
        plano.salvarRascunho(r.titulo().trim(), pasta != null ? pasta.getInicio() : r.inicio(),
                pasta != null ? pasta.getFim() : r.fim(),
                escrever(paraGravarRascunho(r.conteudo(), ler(plano.getRascunho()), plano)));
        return detalhe(planos.saveAndFlush(plano));
    }

    @Transactional(readOnly = true)
    public ResultadoValidacao validar(UUID id) {
        P plano = buscar(id);
        return validar(ler(plano.getRascunho()), plano.getInicio(), plano.getFim());
    }

    /**
     * Erros bloqueiam (422 {@code PLANO_INVALIDO}); avisos sem confirmação também (422 {@code CONFIRMAR_AVISOS}).
     * Senão grava a versão n+1 (cópia do rascunho), liga este plano e desliga o anterior do aluno.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PLANO_PUBLICADO",entidade="PLANO",resumo="Publicou uma nova versão de plano.")
    public PlanoDetalhe<C> publicar(UUID id, PublicarRequest r, UUID usuarioId) {
        P plano = buscar(id);
        exigirMesmaVersao(plano, r.versao());
        if (plano.getAlunoId() == null) {
            throw new BadRequestException("Modelo sem aluno não é publicado; crie um plano para o aluno a partir dele.");
        }
        if (plano.isArquivado()) throw new BadRequestException("Este plano foi removido da lista.");
        C conteudo = ler(plano.getRascunho());
        ResultadoValidacao resultado = validar(conteudo, plano.getInicio(), plano.getFim());
        if (resultado.temErros()) {
            throw new ValidacaoException("O plano tem erros que impedem a publicação.", "PLANO_INVALIDO",
                    ResultadoValidacao.comoCampos(resultado.erros()));
        }
        if (resultado.temAvisos() && !r.confirmarAvisos()) {
            throw new ValidacaoException("Confira os avisos antes de publicar.", "CONFIRMAR_AVISOS",
                    ResultadoValidacao.comoCampos(resultado.avisos()));
        }
        Instant agora = Instant.now();
        int numero = plano.getVersaoPublicada() + 1;
        versoes.save(novaVersao(plano, numero, escrever(paraPublicar(conteudo)), usuarioId, agora));
        planos.desativarOutros(plano.getAlunoId(), plano.getId());
        plano.publicar(numero, agora);
        return detalhe(planos.saveAndFlush(plano));
    }

    /** "Replicar para o próximo ciclo": plano novo do mesmo aluno a partir da última versão publicada, uids novos. */
    @Transactional
    public PlanoDetalhe<C> replicar(UUID id, ReplicarRequest r) {
        P origem = buscar(id);
        exigirAlunoParaGravar(origem.getAlunoId());
        String base = origem.getVersaoPublicada() == 0 ? origem.getRascunho()
                : versao(origem, origem.getVersaoPublicada()).getConteudo();
        PastaPlano pasta = pastaDoAluno(r.pastaId(), origem.getAlunoId());
        P novo = novoPlano(origem.getAlunoId(), r.titulo().trim(), pasta != null ? pasta.getInicio() : r.inicio(),
                pasta != null ? pasta.getFim() : r.fim(), escrever(comUidsNovos(ler(base))));
        if (pasta != null) {
            novo.definirPasta(pasta.getId());
        }
        return detalhe(planos.saveAndFlush(novo));
    }

    /**
     * Confere, antes de qualquer efeito, se o plano pode ir para o aluno: origem existente, não arquivada e de um aluno
     * (404); destino existente (404) e não anonimizado (409); aluno diferente (400). Outra consultoria é 404 nos dois lados.
     */
    @Transactional(readOnly = true)
    public void exigirCopiavel(UUID origemId, UUID destinoId) {
        origemCopiavel(origemId, destinoId);
    }

    /**
     * Cópia para OUTRO aluno: plano novo na pasta do destino (que já existe), sempre rascunho, a partir da última versão
     * publicada da origem (o rascunho, se nunca foi publicada), com uids novos e sem o que é pessoal de cada tipo.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PLANO_COPIADO",entidade="PLANO",resumo="Copiou um plano para outro aluno.")
    public PlanoDetalhe<C> copiarParaAluno(UUID origemId, UUID destinoId, UUID pastaId, String titulo) {
        P origem = origemCopiavel(origemId, destinoId);
        PastaPlano pasta = Optional.ofNullable(pastaDoAluno(pastaId, destinoId)).orElseThrow(
                () -> new NaoEncontradoException("Pasta não encontrada."));
        String base = origem.getVersaoPublicada() == 0 ? origem.getRascunho()
                : versao(origem, origem.getVersaoPublicada()).getConteudo();
        P novo = novoPlano(destinoId, titulo.trim(), pasta.getInicio(), pasta.getFim(),
                escrever(paraCopiaDeOutroAluno(comUidsNovos(ler(base)))));
        novo.definirPasta(pasta.getId());
        return detalhe(planos.saveAndFlush(novo));
    }

    @Transactional(readOnly = true)
    public VersaoDetalhe<C> versao(UUID id, int numero) {
        return detalheVersao(versao(buscar(id), numero));
    }

    @Transactional(readOnly = true)
    public C rascunho(UUID id) {
        return ler(buscar(id).getRascunho());
    }

    /**
     * Todos os planos do aluno com versão publicada (inclusive arquivados) e as versões publicadas, para a exportação de
     * dados. Passa por {@link #paraLeitura}: o que quem pede não pode ler (ergogênicos) sai de fora. Rascunho não entra.
     */
    @Transactional(readOnly = true)
    public List<PlanoPublicado<C>> publicadosDoAluno(UUID alunoId) {
        exigirAluno(alunoId);
        return planos.findByAlunoIdOrderByCriadoEmDesc(alunoId).stream().filter(p -> p.getVersaoPublicada() > 0)
                .map(p -> new PlanoPublicado<>(PlanoResumo.de(p),
                        versoes.findByPlanoIdOrderByNumeroAsc(p.getId()).stream().map(this::detalheVersao).toList()))
                .toList();
    }

    /** Versão vigente do aluno (plano ativo já publicado), para as rotas {@code /aluno/**} e o PDF. */
    @Transactional(readOnly = true)
    public Optional<VersaoAtiva<P, V, C>> versaoAtiva(UUID alunoId) {
        return planos.findByAlunoIdAndAtivoTrue(alunoId)
                .filter(p -> p.getVersaoPublicada() > 0)
                .flatMap(p -> versoes.findByPlanoIdAndNumero(p.getId(), p.getVersaoPublicada())
                        .map(v -> new VersaoAtiva<>(p, v, ler(v.getConteudo()))));
    }

    /** Planos publicados e não arquivados do aluno que estão em alguma pasta (rascunho nunca entra). */
    @Transactional(readOnly = true)
    public List<P> publicadosEmPastas(UUID alunoId) {
        return planos.findByAlunoIdOrderByCriadoEmDesc(alunoId).stream()
                .filter(p -> !p.isArquivado() && p.getVersaoPublicada() > 0 && p.getPastaId() != null)
                .toList();
    }

    /** Versão publicada mais recente entre os planos do aluno na pasta; sem plano publicado, vazio. */
    @Transactional(readOnly = true)
    public Optional<VersaoAtiva<P, V, C>> versaoPublicadaDaPasta(UUID alunoId, UUID pastaId) {
        return planos.findByPastaId(pastaId).stream()
                .filter(p -> !p.isArquivado() && p.getVersaoPublicada() > 0 && alunoId.equals(p.getAlunoId()))
                .max(Comparator.comparing(PlanoBase::getPublicadoEm))
                .flatMap(p -> versoes.findByPlanoIdAndNumero(p.getId(), p.getVersaoPublicada())
                        .map(v -> new VersaoAtiva<>(p, v, ler(v.getConteudo()))));
    }

    public C ler(String conteudoJson) {
        return json.readValue(conteudoJson, classe);
    }

    protected String escrever(C conteudo) {
        return json.writeValueAsString(conteudo);
    }

    protected VersaoDetalhe<C> detalheVersao(V v) {
        return new VersaoDetalhe<>(v.getId(), v.getPlanoId(), v.getNumero(), v.getTitulo(), v.getInicio(), v.getFim(),
                v.getPublicadoEm(), paraLeitura(ler(v.getConteudo())));
    }

    private PlanoDetalhe<C> detalhe(P plano) {
        List<VersaoResumo> lista = versoes.findByPlanoIdOrderByNumeroAsc(plano.getId()).stream()
                .map(VersaoResumo::de).toList();
        return new PlanoDetalhe<>(PlanoResumo.de(plano), paraLeitura(ler(plano.getRascunho())), lista);
    }

    private V versao(P plano, int numero) {
        return versoes.findByPlanoIdAndNumero(plano.getId(), numero)
                .orElseThrow(() -> new NaoEncontradoException("Versão não encontrada."));
    }

    private P buscar(UUID id) {
        return planos.findById(id).orElseThrow(() -> new NaoEncontradoException(nomeDoPlano + " não encontrado."));
    }

    /** Pasta pedida, que precisa ser do mesmo aluno; sem pasta, {@code null}. Outra pasta ou aluno → 404. */
    private PastaPlano pastaDoAluno(UUID pastaId, UUID alunoId) {
        if (pastaId == null) {
            return null;
        }
        return pastas.findById(pastaId).filter(p -> !p.isArquivado() && p.getAlunoId().equals(alunoId))
                .orElseThrow(() -> new NaoEncontradoException("Pasta não encontrada."));
    }

    private P origemCopiavel(UUID origemId, UUID destinoId) {
        P origem = buscar(origemId);
        if (origem.isArquivado() || origem.getAlunoId() == null) {
            throw new NaoEncontradoException(nomeDoPlano + " não encontrado.");
        }
        AlunoService.exigirNaoAnonimizado(
                alunos.findById(destinoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
        if (origem.getAlunoId().equals(destinoId)) {
            throw new BadRequestException("Escolha outro aluno: para o mesmo aluno, use Replicar ou Novo plano.");
        }
        return origem;
    }

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }

    /** Plano novo (criar, aplicar modelo, replicar): o aluno existe e não foi anonimizado. */
    private void exigirAlunoParaGravar(UUID alunoId) {
        AlunoService.exigirNaoAnonimizado(alunos.findById(alunoId)
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
    }

    private static void exigirMesmaVersao(PlanoBase plano, Long versao) {
        if (!plano.getVersao().equals(versao)) {
            throw new ConflictException("Outra pessoa ou aba alterou este plano. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }
}
