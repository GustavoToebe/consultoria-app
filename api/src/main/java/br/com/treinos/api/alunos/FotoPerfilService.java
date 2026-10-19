package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.ForbiddenException;
import br.com.treinos.api.fotos.FotoException;
import br.com.treinos.api.fotos.JpegSemMetadados;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Foto de perfil do aluno (opcional, reunião de 17/10): o aluno troca ou apaga a própria; quem tem {@code ALUNO_LER} vê a
 * de um aluno da consultoria. Só JPEG (o app reencoda e reduz), regravado sem metadados (EXIF, GPS, comentários) e
 * pequeno, porque fica no banco. Outra consultoria ou outro aluno: 404. Aluno anonimizado não recebe foto nova.
 */
@Service
public class FotoPerfilService {

    /** Depois da limpeza: o app manda 512 px, então isto sobra. */
    public static final int BYTES_MAXIMO = 300_000;
    public static final int LADO_MAXIMO = 1024;

    private final FotoPerfilRepository fotos;
    private final AlunoRepository alunos;

    public FotoPerfilService(FotoPerfilRepository fotos, AlunoRepository alunos) {
        this.fotos = fotos;
        this.alunos = alunos;
    }

    @Transactional
    public Instant gravarDoAluno(UsuarioAutenticado eu, byte[] recebido) {
        UUID alunoId = alunoDaSessao(eu);
        byte[] jpeg = limpar(recebido);
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        FotoPerfil foto = fotos.findById(alunoId).orElseGet(() -> new FotoPerfil(alunoId));
        foto.trocar(jpeg, Instant.now());
        return fotos.saveAndFlush(foto).getAtualizadaEm();
    }

    @Transactional
    public void removerDoAluno(UsuarioAutenticado eu) {
        removerDoAluno(alunoDaSessao(eu));
    }

    /** Também usada pela anonimização. Sem foto, não faz nada. */
    @Transactional
    public void removerDoAluno(UUID alunoId) {
        fotos.findById(alunoId).ifPresent(f -> {
            fotos.delete(f);
            fotos.flush();
        });
    }

    @Transactional(readOnly = true)
    public byte[] lerDoAluno(UsuarioAutenticado eu) {
        return ler(alunoDaSessao(eu));
    }

    /** A permissão é conferida na rota; aluno de outra consultoria some pelo filtro do tenant (404). */
    @Transactional(readOnly = true)
    public byte[] lerDoTreinador(UUID alunoId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        return ler(aluno.getId());
    }

    /** Para a exportação: só quando foi trocada, nunca os bytes. */
    @Transactional(readOnly = true)
    public Optional<Instant> atualizadaEm(UUID alunoId) {
        return fotos.atualizadaEm(alunoId);
    }

    private byte[] ler(UUID alunoId) {
        return fotos.findById(alunoId).map(FotoPerfil::getJpeg)
                .orElseThrow(() -> new NaoEncontradoException("Sem foto de perfil."));
    }

    static byte[] limpar(byte[] recebido) {
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

    private static UUID alunoDaSessao(UsuarioAutenticado eu) {
        if (eu.alunoId() == null) {
            throw new ForbiddenException("Acesso negado.");
        }
        return eu.alunoId();
    }
}
