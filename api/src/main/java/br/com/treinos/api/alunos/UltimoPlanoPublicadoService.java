package br.com.treinos.api.alunos;

import br.com.treinos.api.alunos.UltimaPublicacaoRepository.Publicacao;
import br.com.treinos.api.alunos.dto.AlunoDtos.UltimoPlanoPublicado;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Cabeçalho da ficha: a última versão publicada de treino, dieta ou mobilidade do aluno, só dos tipos que quem pede pode
 * ler (treino e mobilidade com {@code TREINO_LER}, dieta com {@code DIETA_LER}). O nome do autor (nunca em log) sai do membro da
 * mesma consultoria; sumido ou de outra consultoria vira nulo.
 */
@Component
class UltimoPlanoPublicadoService {

    private static final PageRequest UMA = PageRequest.of(0, 1);

    private final UltimaPublicacaoRepository publicacoes;
    private final UsuarioRepository usuarios;

    UltimoPlanoPublicadoService(UltimaPublicacaoRepository publicacoes, UsuarioRepository usuarios) {
        this.publicacoes = publicacoes;
        this.usuarios = usuarios;
    }

    UltimoPlanoPublicado de(UUID alunoId) {
        boolean treino = AcessoAtual.pode("TREINO_LER");
        boolean dieta = AcessoAtual.pode("DIETA_LER");
        if (!treino && !dieta) return null;
        List<Publicacao> candidatas = Stream.of(
                        treino ? publicacoes.treino(alunoId, UMA) : List.<Publicacao>of(),
                        treino ? publicacoes.mobilidade(alunoId, UMA) : List.<Publicacao>of(),
                        dieta ? publicacoes.dieta(alunoId, UMA) : List.<Publicacao>of())
                .flatMap(List::stream).toList();
        return candidatas.stream().max(Comparator.comparing(Publicacao::em))
                .map(p -> new UltimoPlanoPublicado(p.em(), nomeDoMembro(p.por()))).orElse(null);
    }

    private String nomeDoMembro(UUID usuarioId) {
        if (usuarioId == null) return null;
        UUID consultoria = TenantContext.get();
        return usuarios.findById(usuarioId).filter(u -> consultoria.equals(u.getConsultoriaId())).map(Usuario::getNome).orElse(null);
    }
}
