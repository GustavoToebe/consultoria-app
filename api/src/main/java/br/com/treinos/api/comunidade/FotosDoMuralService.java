package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.fotos.FotoException;
import br.com.treinos.api.fotos.JpegSemMetadados;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Fotos dos posts do mural (C7 a C9). Uma por requisição, pendente até o post; só JPEG, conferido e regravado sem metadados
 * (1600 px, 300 KB depois da limpeza); só quem a regra de idade e a chave do treinador deixam anexar. Os bytes ficam no banco
 * e só saem pela API, com {@code no-store}; nunca em log. A pendente com mais de 24 h é apagada pela manutenção
 * ({@code fotos/FotosManutencao}). O teto de 20 envios em 24 h é do {@code LimiteTentativas.fotoDoMuralCabe}.
 */
@Service
public class FotosDoMuralService {

    static final int BYTES_MAXIMO = 300_000;
    static final int LADO_MAXIMO = 1600;

    private final ComunidadeMuralFotoRepository fotos;
    private final AlunoRepository alunos;
    private final ConfiguracaoDaComunidadeService configuracao;
    private final LimiteTentativas limite;

    public FotosDoMuralService(ComunidadeMuralFotoRepository fotos, AlunoRepository alunos,
                               ConfiguracaoDaComunidadeService configuracao, LimiteTentativas limite) {
        this.fotos = fotos;
        this.alunos = alunos;
        this.configuracao = configuracao;
        this.limite = limite;
    }

    /**
     * 403 {@code PUBLICACAO_DESLIGADA} (treinador desligou a publicação dos alunos) e 403 {@code FOTO_NAO_PERMITIDA} antes de ler
     * o arquivo; depois 422 do arquivo e do teto diário.
     */
    @Transactional
    public UUID enviar(UsuarioAutenticado eu, byte[] recebido) {
        configuracao.exigirQueAlunosPublicam(eu);
        configuracao.exigirQuePodeAnexarFoto(eu, aluno(eu));
        byte[] jpeg = limpar(recebido);
        if (!limite.fotoDoMuralCabe(eu.usuarioId())) {
            throw FotoException.limiteDoDia();
        }
        return fotos.saveAndFlush(new ComunidadeMuralFoto(eu.usuarioId(), jpeg, Instant.now())).getId();
    }

    /** Só a pendente do próprio aluno; de outro autor, já ligada a um post ou inexistente = 404. */
    @Transactional
    public void apagarPendente(UsuarioAutenticado eu, UUID id) {
        ComunidadeMuralFoto f = fotos.findById(id)
                .filter(x -> x.getPostId() == null && x.getAutorId().equals(eu.usuarioId()))
                .orElseThrow(() -> new NaoEncontradoException("Foto não encontrada."));
        fotos.delete(f);
        fotos.flush();
    }

    /** Foto de post (a consultoria já filtra) ou a própria pendente; o post oculto não tem foto (a moderação as apaga). */
    @Transactional(readOnly = true)
    public byte[] lerDoAluno(UsuarioAutenticado eu, UUID id) {
        return fotos.findById(id)
                .filter(f -> f.getPostId() != null || f.getAutorId().equals(eu.usuarioId()))
                .map(ComunidadeMuralFoto::getBytes)
                .orElseThrow(() -> new NaoEncontradoException("Foto não encontrada."));
    }

    /** A equipe só vê foto de post; a pendente ainda é só do aluno. */
    @Transactional(readOnly = true)
    public byte[] lerDaEquipe(UUID id) {
        return fotos.findById(id)
                .filter(f -> f.getPostId() != null)
                .map(ComunidadeMuralFoto::getBytes)
                .orElseThrow(() -> new NaoEncontradoException("Foto não encontrada."));
    }

    private Aluno aluno(UsuarioAutenticado eu) {
        return alunos.findById(AlunoAppService.alunoDaSessao(eu)).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
    }

    private static byte[] limpar(byte[] recebido) {
        if (recebido == null || recebido.length == 0) {
            throw FotoException.invalida();
        }
        if (recebido.length > 4 * BYTES_MAXIMO) {
            throw FotoException.grandeDemais();
        }
        byte[] limpo;
        try {
            limpo = JpegSemMetadados.limpar(recebido, LADO_MAXIMO);
        } catch (IllegalArgumentException e) {
            throw FotoException.invalida();
        }
        if (limpo.length > BYTES_MAXIMO) {
            throw FotoException.grandeDemais();
        }
        return limpo;
    }
}
