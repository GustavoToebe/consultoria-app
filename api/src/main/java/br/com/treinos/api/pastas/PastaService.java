package br.com.treinos.api.pastas;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.execucao.PesoService;
import br.com.treinos.api.mobilidade.PlanoMobilidadeRepository;
import br.com.treinos.api.mobilidade.PlanoMobilidadeService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoRequest;
import br.com.plataforma.comum.web.ApiError.FieldError;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.pastas.PastaDtos.CopiarPastaRequest;
import br.com.treinos.api.pastas.PastaDtos.CopiarPastaResposta;
import br.com.treinos.api.pastas.PastaDtos.FinalizarRequest;
import br.com.treinos.api.pastas.PastaDtos.PlanoCopiadoDaPasta;
import br.com.treinos.api.pastas.PastaDtos.PlanoPuladoNaCopia;
import br.com.treinos.api.pastas.PastaDtos.PlanoPublicadoNaPasta;
import br.com.treinos.api.pastas.PastaDtos.PlanoPuladoNaPasta;
import br.com.treinos.api.pastas.PastaDtos.PublicarPastaResposta;
import br.com.treinos.api.planos.PlanoServiceBase;
import br.com.treinos.api.planos.dto.PlanoDtos.PublicarRequest;
import br.com.treinos.api.web.ValidacaoException;
import br.com.treinos.api.pastas.PastaDtos.PastaRequest;
import br.com.treinos.api.pastas.PastaDtos.PastaResumo;
import br.com.treinos.api.pastas.PastaDtos.PastaVigenteResposta;
import br.com.treinos.api.planos.PlanoBase;
import br.com.treinos.api.planos.dto.PlanoDtos.ReplicarRequest;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.ConflitoComRecursoException;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Pastas de plano do aluno. O período da pasta vale para os treinos, dietas e mobilidades dentro dela: ao mudar, o rascunho de cada
 * plano acompanha (versão publicada é imutável, então o plano aparece como "alterado desde a publicação"). Replicar a
 * pasta cria outra com cópia de todos os planos (conteúdo da última publicação, uids novos).
 */
@Service
public class PastaService {

    private final PastaRepository pastas;
    private final AlunoRepository alunos;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final PlanoMobilidadeRepository mobilidades;
    private final PlanoTreinoService servicoTreino;
    private final PlanoDietaService servicoDieta;
    private final PlanoMobilidadeService servicoMobilidade;
    private final PesoService pesos;
    private final AtualizacaoRepository atualizacoes;
    private final PastaVigente vigente;
    private final br.com.treinos.api.conta.PlanoDaConsultoria plano;
    private final Auditoria auditoria;

    public PastaService(PastaRepository pastas, AlunoRepository alunos, PlanoTreinoRepository treinos,
                        PlanoDietaRepository dietas, PlanoMobilidadeRepository mobilidades,
                        PlanoTreinoService servicoTreino, PlanoDietaService servicoDieta,
                        PlanoMobilidadeService servicoMobilidade, PesoService pesos,
                        AtualizacaoRepository atualizacoes, PastaVigente vigente,
                        br.com.treinos.api.conta.PlanoDaConsultoria plano, Auditoria auditoria) {
        this.plano = plano;
        this.auditoria = auditoria;
        this.atualizacoes = atualizacoes;
        this.vigente = vigente;
        this.pastas = pastas;
        this.alunos = alunos;
        this.treinos = treinos;
        this.dietas = dietas;
        this.mobilidades = mobilidades;
        this.servicoTreino = servicoTreino;
        this.servicoDieta = servicoDieta;
        this.servicoMobilidade = servicoMobilidade;
        this.pesos = pesos;
    }

    @Transactional(readOnly = true)
    public List<PastaResumo> listar(UUID alunoId) {
        exigirAluno(alunoId);
        return pastas.findByAlunoIdOrderByCriadoEmDesc(alunoId).stream().filter(p -> !p.isArquivado()).map(PastaResumo::de).toList();
    }

    /** A pasta que o aluno está usando agora (regra única em {@link PastaVigente}); nenhuma = {@code pasta} nulo. */
    @Transactional(readOnly = true)
    public PastaVigenteResposta vigente(UUID alunoId) {
        exigirAluno(alunoId);
        return new PastaVigenteResposta(vigente.de(alunoId).map(PastaResumo::de).orElse(null));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PASTA_CRIADA",entidade="PASTA",resumo="Criou uma pasta de plano.")
    public PastaResumo criar(UUID alunoId, PastaRequest r) {
        return PastaResumo.de(gravarPasta(alunoId, r));
    }

    /** Grava a pasta sem auditoria própria: a cópia da pasta para outro aluno grava uma linha só ({@code PASTA_COPIADA}). */
    private PastaPlano gravarPasta(UUID alunoId, PastaRequest r) {
        exigirAlunoParaGravar(alunoId);
        exigirPeriodo(r.inicio(), r.fim());
        return pastas.saveAndFlush(new PastaPlano(alunoId, r.titulo().trim(), r.inicio(), r.fim()));
    }

    @Transactional
    public PastaResumo atualizar(UUID id, PastaRequest r) {
        exigirPeriodo(r.inicio(), r.fim());
        PastaPlano pasta = buscar(id);
        pasta.atualizar(r.titulo().trim(), r.inicio(), r.fim());
        treinos.findByPastaId(id).forEach(p -> p.definirPeriodo(r.inicio(), r.fim()));
        dietas.findByPastaId(id).forEach(p -> p.definirPeriodo(r.inicio(), r.fim()));
        mobilidades.findByPastaId(id).forEach(p -> p.definirPeriodo(r.inicio(), r.fim()));
        PastaResumo resumo = PastaResumo.de(pastas.saveAndFlush(pasta));
        // A linha da atualização guarda a data; enquanto ABERTA ela acompanha o fim da pasta.
        if (r.fim() != null) {
            atualizacoes.moverDataDaAberta(id, r.fim());
        }
        return resumo;
    }

    /** Nova pasta com cópia dos treinos, dietas e mobilidades da origem; plano com título próprio mantém o título. */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PASTA_REPLICADA",entidade="PASTA",resumo="Replicou uma pasta de plano.")
    public PastaResumo replicar(UUID id, PastaRequest r) {
        exigirPeriodo(r.inicio(), r.fim());
        PastaPlano origem = buscar(id);
        exigirAlunoParaGravar(origem.getAlunoId());
        exigirPermissoesDosPlanos(id);
        PastaPlano nova = pastas.saveAndFlush(new PastaPlano(origem.getAlunoId(), r.titulo().trim(), r.inicio(), r.fim()));
        for (PlanoBase p : treinos.findByPastaId(id)) {
            if (p.isArquivado()) continue;
            servicoTreino.replicar(p.getId(),
                    new ReplicarRequest(tituloDaCopia(p, origem, nova), r.inicio(), r.fim(), nova.getId()));
        }
        for (PlanoBase p : dietas.findByPastaId(id)) {
            if (p.isArquivado()) continue;
            servicoDieta.replicar(p.getId(),
                    new ReplicarRequest(tituloDaCopia(p, origem, nova), r.inicio(), r.fim(), nova.getId()));
        }
        // Plano sem mobilidade: a pasta nova sai sem ela (renovar a pasta não pode quebrar por causa disso).
        boolean comMobilidade = plano.funcionalidadeLiberada(br.com.treinos.api.conta.RecursosDoApp.FUNCIONALIDADE_MOBILIDADE);
        for (PlanoBase p : comMobilidade ? mobilidades.findByPastaId(id) : List.<PlanoBase>of()) {
            if (p.isArquivado()) continue;
            servicoMobilidade.replicar(p.getId(),
                    new ReplicarRequest(tituloDaCopia(p, origem, nova), r.inicio(), r.fim(), nova.getId()));
        }
        return PastaResumo.de(nova);
    }

    /**
     * Dá a pasta como concluída. Com peso informado, grava (ou substitui, na mesma data) o registro de peso do aluno
     * na mesma transação: se o peso for recusado, a pasta continua aberta.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PASTA_FINALIZADA",entidade="PASTA",resumo="Finalizou uma pasta de plano.")
    public PastaResumo finalizar(UUID id, FinalizarRequest r, UUID usuarioId) {
        PastaPlano pasta = buscar(id);
        if (pasta.getConcluidaEm() != null) {
            throw new ConflictException("Esta pasta já foi finalizada.", "PASTA_JA_FINALIZADA");
        }
        if (r.pesoKg() == null && r.observacao() != null && !r.observacao().isBlank()) {
            throw new BadRequestException("Informe o peso para gravar a observação.");
        }
        if (r.pesoKg() != null) {
            br.com.treinos.api.equipe.AcessoAtual.exigir("ALUNO_SENSIVEL_ALTERAR");
            LocalDate data = r.data() != null ? r.data() : LocalDate.now(Fuso.BRASILIA);
            pesos.registrar(pasta.getAlunoId(), new PesoRequest(data, r.pesoKg(), r.observacao()), usuarioId);
        }
        pasta.concluir(Instant.now());
        return PastaResumo.de(pastas.saveAndFlush(pasta));
    }

    @Transactional
    public PastaResumo reabrir(UUID id) {
        PastaPlano pasta = buscar(id);
        pasta.reabrir();
        return PastaResumo.de(pastas.saveAndFlush(pasta));
    }

    @Transactional
    public void excluir(UUID id) {
        PastaPlano p = buscar(id);
        exigirPermissoesDosPlanos(id);
        treinos.findByPastaId(id).forEach(PlanoBase::arquivar);
        dietas.findByPastaId(id).forEach(PlanoBase::arquivar);
        mobilidades.findByPastaId(id).forEach(PlanoBase::arquivar);
        p.arquivar(); pastas.saveAndFlush(p);
    }

    /**
     * "Publicar tudo": publica o rascunho de treino, dieta e mobilidade da pasta de uma vez, numa transação só.
     * Ordem: pasta (404, também a arquivada) → cálculo dos planos pendentes → permissão de publicar de CADA tipo que
     * tem plano pendente (403; treino e mobilidade pedem a do treino, dieta a da dieta; tipo sem alteração não pede
     * permissão e, sem nenhum pendente, nenhuma permissão específica é exigida além da da rota) → um só plano pendente
     * por tipo (409 {@code PLANOS_PENDENTES_DUPLICADOS}) → as versões que a tela viu (409 {@code CONFLITO_EDICAO}: plano
     * pendente com versão diferente da enviada em {@code versoes}, ou ausente dela) → validação de todos os planos a
     * publicar → só então publica. Tudo isso antes de qualquer efeito e antes de o {@code confirmarAvisos} valer, para a
     * confirmação nunca cobrir um aviso que ninguém viu. Um erro em qualquer plano ({@code PLANO_INVALIDO}) ou aviso sem
     * {@code confirmarAvisos} ({@code CONFIRMAR_AVISOS}) devolve 422 com a lista por plano e nada é publicado. Cada
     * publicação passa pelo {@code publicar} do serviço do tipo (a mesma versão imutável e a mesma auditoria da rota
     * individual), com a versão que a tela enviou. Chamada simultânea nunca publica duas vezes nem pela metade: o lock
     * otimista (tratado pela biblioteca como 409 {@code CONFLITO_EDICAO}) e a versão única do plano (convertida aqui no
     * mesmo 409) derrubam a segunda e a transação inteira volta. Plano sem publicação, ou com o rascunho alterado depois
     * da última (inclusive pela mudança de período da pasta), entra; plano já publicado e sem alteração é pulado, sem
     * versão nova, e só aparece em {@code pulados} se a pessoa pode ler o tipo ({@code TREINO_LER} para treino e
     * mobilidade, {@code DIETA_LER} para dieta). Plano arquivado não entra, e mobilidade só com a funcionalidade ligada
     * no plano da consultoria.
     */
    @Transactional
    public PublicarPastaResposta publicarTudo(UUID id, boolean confirmarAvisos, Map<UUID, Long> versoes, UUID usuarioId) {
        buscarAtiva(id);
        List<Alvo> alvos = planosDaPasta(id);
        List<Alvo> aPublicar = alvos.stream().filter(Alvo::pendente).toList();
        exigirPermissaoDosAlvos(aPublicar, "PUBLICAR");
        exigirUmPendentePorTipo(aPublicar);
        exigirVersoesDaTela(aPublicar, versoes);
        List<FieldError> erros = new ArrayList<>();
        List<FieldError> avisos = new ArrayList<>();
        for (Alvo a : aPublicar) {
            var resultado = a.servico().validar(a.plano().getId());
            resultado.erros().forEach(p -> erros.add(new FieldError(campo(a, p.caminho()), p.mensagem())));
            resultado.avisos().forEach(p -> avisos.add(new FieldError(campo(a, p.caminho()), p.mensagem())));
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Há planos com erros que impedem a publicação. Nada foi publicado.",
                    "PLANO_INVALIDO", erros);
        }
        if (!avisos.isEmpty() && !confirmarAvisos) {
            throw new ValidacaoException("Confira os avisos antes de publicar. Nada foi publicado.", "CONFIRMAR_AVISOS", avisos);
        }
        // Antes de publicar: depois, os publicados também deixam de ter alteração pendente.
        List<PlanoPuladoNaPasta> pulados = alvos.stream().filter(a -> !aPublicar.contains(a))
                .filter(a -> AcessoAtual.pode(permissaoDeLeitura(a)))
                .map(a -> new PlanoPuladoNaPasta(a.tipo(), a.plano().getId())).toList();
        List<PlanoPublicadoNaPasta> publicados = new ArrayList<>();
        try {
            for (Alvo a : aPublicar) {
                var publicado = a.servico().publicar(a.plano().getId(),
                        new PublicarRequest(versoes.get(a.plano().getId()), confirmarAvisos), usuarioId);
                publicados.add(new PlanoPublicadoNaPasta(a.tipo(), a.plano().getId(), publicado.plano().versaoPublicada()));
            }
        } catch (DataIntegrityViolationException corrida) {
            // Outra chamada publicou o mesmo plano ao mesmo tempo: só a violação da versão (ou do plano ativo) vira 409;
            // qualquer outra restrição é defeito e sobe como erro. A transação inteira volta.
            if (violouVersaoDoPlano(corrida)) throw conflitoDeEdicao();
            throw corrida;
        }
        return new PublicarPastaResposta(List.copyOf(publicados), pulados);
    }

    /** Restrições que uma publicação simultânea do mesmo plano fere: versão única do plano e plano ativo único do aluno. */
    private static final Set<String> RESTRICOES_DA_PUBLICACAO = Set.of(
            "plano_treino_versao_plano_id_numero_key", "plano_dieta_versao_plano_id_numero_key",
            "plano_mobilidade_versao_plano_id_numero_key", "ux_plano_treino_ativo", "ux_plano_dieta_ativo",
            "ux_plano_mobilidade_ativo");

    /** Só olha o nome da restrição, nunca a mensagem do banco. */
    static boolean violouVersaoDoPlano(DataIntegrityViolationException e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c
                    && RESTRICOES_DA_PUBLICACAO.contains(c.getConstraintName())) {
                return true;
            }
        }
        return false;
    }

    private static ConflictException conflitoDeEdicao() {
        return new ConflictException("Outra pessoa alterou os planos desta pasta. Recarregue e confira antes de publicar. "
                + "Nada foi publicado.", "CONFLITO_EDICAO");
    }

    /**
     * Dois ou mais planos pendentes do mesmo tipo: a pasta não sabe qual publicar (o aluno passaria a ver o último). 409
     * {@code PLANOS_PENDENTES_DUPLICADOS}, com um item em {@code fieldErrors} por plano ({@code field} = o tipo,
     * {@code message} = o id do plano).
     */
    private static void exigirUmPendentePorTipo(List<Alvo> aPublicar) {
        List<FieldError> repetidos = new ArrayList<>();
        List<String> tipos = new ArrayList<>();
        for (String tipo : List.of("treino", "dieta", "mobilidade")) {
            List<Alvo> doTipo = aPublicar.stream().filter(a -> a.tipo().equals(tipo)).toList();
            if (doTipo.size() > 1) {
                tipos.add(tipo);
                doTipo.forEach(a -> repetidos.add(new FieldError(tipo, a.plano().getId().toString())));
            }
        }
        if (!repetidos.isEmpty()) {
            throw new ConflitoComRecursoException("A pasta tem mais de um plano de " + String.join(" e de ", tipos)
                    + " com alteração a publicar. Deixe só um por tipo (arquive ou publique o outro) e tente de novo. "
                    + "Nada foi publicado.", "PLANOS_PENDENTES_DUPLICADOS", repetidos);
        }
    }

    /**
     * A tela só publica o que viu: todo plano pendente precisa estar em {@code versoes} com a versão que ele tem agora.
     * Rascunho salvo por outra pessoa depois (ou plano que ficou pendente depois) = 409 {@code CONFLITO_EDICAO}.
     */
    private static void exigirVersoesDaTela(List<Alvo> aPublicar, Map<UUID, Long> versoes) {
        for (Alvo a : aPublicar) {
            if (!Objects.equals(versoes.get(a.plano().getId()), a.plano().getVersao())) {
                throw conflitoDeEdicao();
            }
        }
    }

    private static String permissaoDeLeitura(Alvo a) {
        return a.tipo().equals("dieta") ? "DIETA_LER" : "TREINO_LER";
    }

    /**
     * Copia a pasta para OUTRO aluno: pasta nova no destino (com o título e o período do corpo, sem o questionário
     * escolhido da origem) e, dentro dela, uma cópia de cada plano, sempre em rascunho, a partir da última versão
     * publicada (o rascunho, se nunca publicou), com uids novos e sem o que é pessoal de cada tipo (ergogênicos da dieta);
     * é o mesmo {@code copiarParaAluno} dos planos. Tudo é conferido antes de criar qualquer coisa: pasta de origem
     * inexistente, arquivada ou de outra consultoria = 404; destino inexistente ou de outra consultoria = 404, anonimizado
     * = 409; mesmo aluno = 400; sem o {@code *_ALTERAR} de algum tipo presente = 403. Auditoria: uma linha só,
     * {@code PASTA_COPIADA} (a pasta nova), sem as linhas por plano ({@code TREINO_COPIADO}…) nem {@code PASTA_CRIADA}.
     */
    @Transactional
    public CopiarPastaResposta copiarParaAluno(UUID id, CopiarPastaRequest r) {
        AcessoAtual.exigir("PASTA_ALTERAR"); // cria uma pasta nova
        PastaPlano origem = buscarAtiva(id);
        br.com.treinos.api.alunos.AlunoService.exigirNaoAnonimizado(
                alunos.findById(r.alunoId()).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
        if (origem.getAlunoId().equals(r.alunoId())) {
            throw new BadRequestException("Escolha outro aluno: para o mesmo aluno, use Renovar pasta.");
        }
        exigirPeriodo(r.inicio(), r.fim());
        List<Alvo> alvos = planosDaPasta(id);
        exigirPermissaoDosAlvos(alvos, "ALTERAR");
        PastaPlano nova = gravarPasta(r.alunoId(), new PastaRequest(r.titulo(), r.inicio(), r.fim()));
        List<PlanoCopiadoDaPasta> copiados = new ArrayList<>();
        for (Alvo a : alvos) {
            var copia = a.servico().copiarParaAlunoSemAuditoria(a.plano().getId(), r.alunoId(), nova.getId(),
                    tituloDaCopia(a.plano(), origem, nova));
            copiados.add(new PlanoCopiadoDaPasta(a.tipo(), copia.plano().id()));
        }
        auditoria.registrarEvento("PASTA_COPIADA", "PASTA", nova.getId(), "Copiou uma pasta de plano para outro aluno.");
        return new CopiarPastaResposta(nova.getId(), List.copyOf(copiados), puladosDaCopia(id));
    }

    /** Motivo fixo de {@code pulados} na cópia: a funcionalidade não está no plano da consultoria. */
    public static final String MOTIVO_FORA_DO_PLANO = "FUNCIONALIDADE_FORA_DO_PLANO";

    /**
     * O que a origem tinha e a cópia não levou: hoje só a mobilidade, quando a funcionalidade está desligada no plano da
     * consultoria. Só diz que existe a quem pode ler o tipo ({@code TREINO_LER}); arquivada não conta.
     */
    private List<PlanoPuladoNaCopia> puladosDaCopia(UUID pastaId) {
        if (plano.funcionalidadeLiberada(br.com.treinos.api.conta.RecursosDoApp.FUNCIONALIDADE_MOBILIDADE)
                || !AcessoAtual.pode("TREINO_LER")) {
            return List.of();
        }
        boolean temMobilidade = mobilidades.findByPastaId(pastaId).stream().anyMatch(p -> !p.isArquivado());
        return temMobilidade ? List.of(new PlanoPuladoNaCopia("mobilidade", MOTIVO_FORA_DO_PLANO)) : List.of();
    }

    /** Um plano da pasta com o serviço do tipo; {@code tipo} é o que vai no corpo e no prefixo dos erros. */
    private record Alvo(String tipo, PlanoBase plano, PlanoServiceBase<?, ?, ?> servico) {
        /** Nunca publicado, ou com o rascunho alterado depois da última publicação. */
        boolean pendente() {
            return plano.getVersaoPublicada() == 0 || plano.rascunhoAlteradoDepoisDePublicar();
        }
    }

    /** Planos não arquivados da pasta: treino, dieta e mobilidade (esta só com a funcionalidade ligada), na ordem de criação. */
    private List<Alvo> planosDaPasta(UUID pastaId) {
        List<Alvo> alvos = new ArrayList<>();
        treinos.findByPastaId(pastaId).stream().filter(p -> !p.isArquivado()).sorted(PLANOS_POR_CRIACAO)
                .forEach(p -> alvos.add(new Alvo("treino", p, servicoTreino)));
        dietas.findByPastaId(pastaId).stream().filter(p -> !p.isArquivado()).sorted(PLANOS_POR_CRIACAO)
                .forEach(p -> alvos.add(new Alvo("dieta", p, servicoDieta)));
        if (plano.funcionalidadeLiberada(br.com.treinos.api.conta.RecursosDoApp.FUNCIONALIDADE_MOBILIDADE)) {
            mobilidades.findByPastaId(pastaId).stream().filter(p -> !p.isArquivado()).sorted(PLANOS_POR_CRIACAO)
                    .forEach(p -> alvos.add(new Alvo("mobilidade", p, servicoMobilidade)));
        }
        return alvos;
    }

    private static final Comparator<PlanoBase> PLANOS_POR_CRIACAO = Comparator
            .comparing(PlanoBase::getCriadoEm, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(PlanoBase::getId);

    /** {@code sufixo}: {@code PUBLICAR} ou {@code ALTERAR}. Treino e mobilidade usam a do treino. Antes de qualquer efeito. */
    private static void exigirPermissaoDosAlvos(List<Alvo> alvos, String sufixo) {
        if (alvos.stream().anyMatch(a -> !a.tipo().equals("dieta"))) AcessoAtual.exigir("TREINO_" + sufixo);
        if (alvos.stream().anyMatch(a -> a.tipo().equals("dieta"))) AcessoAtual.exigir("DIETA_" + sufixo);
    }

    /** {@code treino.<caminho>}: com um só plano pendente por tipo, o tipo basta para achar o plano. */
    private static String campo(Alvo alvo, String caminho) {
        return caminho == null || caminho.isBlank() ? alvo.tipo() : alvo.tipo() + "." + caminho;
    }

    /** Pasta que existe nesta consultoria e não foi arquivada; senão 404. */
    private PastaPlano buscarAtiva(UUID id) {
        PastaPlano pasta = buscar(id);
        if (pasta.isArquivado()) {
            throw new NaoEncontradoException("Pasta não encontrada.");
        }
        return pasta;
    }

    private static String tituloDaCopia(PlanoBase plano, PastaPlano origem, PastaPlano nova) {
        return plano.getTitulo().equals(origem.getTitulo()) ? nova.getTitulo() : plano.getTitulo();
    }

    private PastaPlano buscar(UUID id) {
        return pastas.findById(id).orElseThrow(() -> new NaoEncontradoException("Pasta não encontrada."));
    }

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }

    /** Gravar dado novo: o aluno existe e não foi anonimizado (dado de saúde num cadastro anonimizado contraria a LGPD). */
    private void exigirAlunoParaGravar(UUID alunoId) {
        br.com.treinos.api.alunos.AlunoService.exigirNaoAnonimizado(
                alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
    }

    /**
     * Replicar ou excluir a pasta cria ou arquiva os planos dela: só com a permissão de alterar cada tipo presente, como
     * aplicar modelo e copiar plano já exigem (mobilidade usa a do treino). Antes de qualquer efeito.
     */
    private void exigirPermissoesDosPlanos(UUID pastaId) {
        boolean treino = treinos.findByPastaId(pastaId).stream().anyMatch(p -> !p.isArquivado())
                || mobilidades.findByPastaId(pastaId).stream().anyMatch(p -> !p.isArquivado());
        if (treino) br.com.treinos.api.equipe.AcessoAtual.exigir("TREINO_ALTERAR");
        if (dietas.findByPastaId(pastaId).stream().anyMatch(p -> !p.isArquivado())) {
            br.com.treinos.api.equipe.AcessoAtual.exigir("DIETA_ALTERAR");
        }
    }

    private static void exigirPeriodo(LocalDate inicio, LocalDate fim) {
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            throw new BadRequestException("O fim do período não pode ser antes do início.");
        }
    }
}
