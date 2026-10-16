package br.com.treinos.api.fotos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.questionarios.LimitesQuestionario;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fotos da atualização do aluno (dado sensível, LGPD). A foto sobe antes do envio e fica pendente; enviar a atualização a
 * liga à resposta na mesma transação; pendente que ninguém ligou é apagada pelo job. Gravar e apagar no bucket é HTTP e
 * fica sempre FORA das transações do banco: a transação só reserva a linha ou enfileira a remoção.
 * Nada daqui vai a log: nem id de foto, nem de aluno, nem o arquivo.
 */
@Service
public class FotoService {

    /** Tamanho máximo de cada foto, enviada e guardada (o corpo da requisição já é limitado a 1 MiB pela biblioteca). */
    public static final int BYTES_MAXIMO = 1_000_000;
    /** Fotos novas por aluno em 24 h (as removidas contam: não dá para subir e apagar sem fim). */
    public static final int POR_DIA = 12;
    static final Duration JANELA_DO_DIA = Duration.ofHours(24);

    public record Configuracao(boolean habilitado, int maximoPorPergunta, int bytesMaximo, int porDia) { }

    /** Metadados que a exportação do titular leva: nunca os bytes. */
    public record FotoExportada(String perguntaId, Instant enviadaEm) { }

    private final AtualizacaoFotoRepository fotos;
    private final FotoRemocaoRepositorio remocoes;
    private final ObjectProvider<ArmazenamentoDeFotos> armazenamento;
    private final FotosProperties propriedades;
    private final AlunoRepository alunos;
    private final PastaRepository pastas;
    private final TransactionTemplate transacao;

    public FotoService(AtualizacaoFotoRepository fotos, FotoRemocaoRepositorio remocoes,
                       ObjectProvider<ArmazenamentoDeFotos> armazenamento, FotosProperties propriedades,
                       AlunoRepository alunos, PastaRepository pastas, PlatformTransactionManager gerenteDeTransacao) {
        this.fotos = fotos;
        this.remocoes = remocoes;
        this.armazenamento = armazenamento;
        this.propriedades = propriedades;
        this.alunos = alunos;
        this.pastas = pastas;
        this.transacao = new TransactionTemplate(gerenteDeTransacao);
    }

    public boolean ligadas() {
        return propriedades.habilitado();
    }

    public Configuracao configuracao() {
        return new Configuracao(ligadas(), LimitesQuestionario.FOTOS_POR_PERGUNTA, BYTES_MAXIMO, POR_DIA);
    }

    /** Recebe a foto do aluno, tira todo metadado, guarda no bucket e devolve o id (pendente até o envio da atualização). */
    public UUID subir(UsuarioAutenticado eu, UUID pastaId, byte[] recebido) {
        ArmazenamentoDeFotos bucket = exigirLigadas();
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        byte[] jpeg = limpar(recebido);
        UUID id = transacao.execute(s -> reservar(alunoId, pastaId, jpeg.length));
        try {
            bucket.gravar(id, jpeg);
        } catch (RuntimeException falha) {
            // Pode ter gravado pela metade: tira a linha e manda apagar o objeto, que a remoção repete até dar certo.
            transacao.executeWithoutResult(s -> {
                fotos.deleteById(id);
                remocoes.enfileirar(List.of(id));
            });
            throw FotoException.falhaNoArmazenamento();
        }
        return id;
    }

    private UUID reservar(UUID alunoId, UUID pastaId, int tamanho) {
        // Trava o aluno: duas fotos ao mesmo tempo não passam juntas do limite do dia.
        Exigir.existe(alunos.buscarParaAlterar(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
        Exigir.existe(pastas.findById(pastaId).filter(p -> p.getAlunoId().equals(alunoId)),
                () -> new NaoEncontradoException("Atualização não encontrada."));
        Instant agora = Instant.now();
        if (fotos.countByAlunoIdAndCriadaEmAfter(alunoId, agora.minus(JANELA_DO_DIA)) >= POR_DIA) {
            throw FotoException.limiteDoDia();
        }
        return fotos.saveAndFlush(new AtualizacaoFoto(alunoId, pastaId, tamanho, agora)).getId();
    }

    static byte[] limpar(byte[] recebido) {
        if (recebido == null || recebido.length == 0) {
            throw FotoException.invalida();
        }
        if (recebido.length > BYTES_MAXIMO) {
            throw FotoException.grandeDemais();
        }
        byte[] limpo;
        try {
            limpo = JpegSemMetadados.limpar(recebido);
        } catch (IllegalArgumentException e) {
            throw FotoException.invalida();
        }
        if (limpo.length > BYTES_MAXIMO) {
            throw FotoException.grandeDemais();
        }
        return limpo;
    }

    /** Remove foto pendente do aluno (a já enviada faz parte da atualização e não se apaga). Repetir é inofensivo. */
    @Transactional
    public void remover(UsuarioAutenticado eu, UUID id) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        AtualizacaoFoto foto = fotos.findById(id).filter(f -> f.getAlunoId().equals(alunoId))
                .orElseThrow(() -> new NaoEncontradoException("Foto não encontrada."));
        if (foto.getRemovidaEm() != null) {
            return;
        }
        if (foto.getAtualizacaoId() != null) {
            throw new ConflictException("Esta foto já foi enviada com a atualização.", "FOTO_JA_ENVIADA");
        }
        if (fotos.removerPendente(id, alunoId, Instant.now()) == 1) {
            remocoes.enfileirar(List.of(id));
        }
    }

    /** O aluno vê só as próprias fotos (de outro aluno ou consultoria: 404). */
    @Transactional(readOnly = true)
    public byte[] lerDoAluno(UsuarioAutenticado eu, UUID id) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        Exigir.existe(fotos.findById(id).filter(f -> f.getAlunoId().equals(alunoId) && f.getRemovidaEm() == null),
                () -> new NaoEncontradoException("Foto não encontrada."));
        return exigirLigadas().ler(id);
    }

    /** O treinador vê pela atualização a que a foto pertence; a permissão é conferida na rota. Outra consultoria: 404. */
    @Transactional(readOnly = true)
    public byte[] lerDoTreinador(UUID atualizacaoId, UUID id) {
        Exigir.existe(fotos.findById(id).filter(f -> atualizacaoId.equals(f.getAtualizacaoId()) && f.getRemovidaEm() == null),
                () -> new NaoEncontradoException("Foto não encontrada."));
        return exigirLigadas().ler(id);
    }

    private ArmazenamentoDeFotos exigirLigadas() {
        ArmazenamentoDeFotos bucket = ligadas() ? armazenamento.getIfAvailable() : null;
        if (bucket == null) {
            throw FotoException.indisponivel();
        }
        return bucket;
    }

    /**
     * Liga as fotos pendentes à resposta da pergunta, na transação do envio. Cada id precisa ser do aluno, da pasta, estar
     * pendente e não removido; qualquer falha derruba o envio inteiro (422 no campo da pergunta).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void ligar(UUID alunoId, UUID pastaId, UUID atualizacaoId, String perguntaId, List<UUID> ids) {
        Instant agora = Instant.now();
        for (UUID id : ids) {
            if (fotos.ligar(id, alunoId, pastaId, atualizacaoId, perguntaId, agora) != 1) {
                throw new ValidacaoException("Confira as respostas.", "ATUALIZACAO_INVALIDA", List.of(new ApiError.FieldError(
                        perguntaId, "Uma das fotos não está mais disponível. Remova e anexe de novo.")));
            }
        }
    }

    /** Anonimização do aluno: todas as fotos dele saem do ar e do bucket (pela fila). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void removerTodasDoAluno(UUID alunoId) {
        Instant agora = Instant.now();
        List<AtualizacaoFoto> doAluno = fotos.findByAlunoIdAndRemovidaEmIsNull(alunoId);
        doAluno.forEach(f -> f.remover(agora));
        fotos.flush();
        remocoes.enfileirar(doAluno.stream().map(AtualizacaoFoto::getId).toList());
    }

    /** Exportação do titular: de cada atualização, em que pergunta e quando as fotos foram enviadas (sem os bytes). */
    @Transactional(readOnly = true)
    public Map<UUID, List<FotoExportada>> metadados(Collection<UUID> atualizacaoIds) {
        if (atualizacaoIds.isEmpty()) {
            return Map.of();
        }
        return fotos.findByAtualizacaoIdInAndRemovidaEmIsNullOrderByCriadaEmAsc(atualizacaoIds).stream()
                .collect(Collectors.groupingBy(AtualizacaoFoto::getAtualizacaoId,
                        Collectors.mapping(f -> new FotoExportada(f.getPerguntaId(), f.getCriadaEm()), Collectors.toList())));
    }
}
