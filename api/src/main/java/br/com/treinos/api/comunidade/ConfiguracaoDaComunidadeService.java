package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ConfiguracaoDoAluno;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ConfiguracaoRequest;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ConfiguracaoResponse;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Chaves da comunidade do treinador (C9) e a regra de quem pode anexar foto (C8): só aluno com data de nascimento e 18 anos
 * completos (data de Brasília) e com a chave {@code alunosAnexamFotos} ligada. A data de nascimento nunca sai daqui: nem em DTO,
 * nem em log, nem em mensagem.
 */
@Service
public class ConfiguracaoDaComunidadeService {

    /** Resumo fixo: nunca o valor das chaves. */
    static final String RESUMO_ALTERADA = "Alterou as chaves da comunidade.";

    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;
    private final AlunoRepository alunos;

    public ConfiguracaoDaComunidadeService(ConsultoriaRepository consultorias, Auditoria auditoria, AlunoRepository alunos) {
        this.consultorias = consultorias;
        this.auditoria = auditoria;
        this.alunos = alunos;
    }

    @Transactional(readOnly = true)
    public ConfiguracaoResponse obter(UsuarioAutenticado eu) {
        Consultoria c = consultoria(eu);
        return new ConfiguracaoResponse(c.isComunidadeAlunosPublicam(), c.isComunidadeAlunosAnexamFotos());
    }

    /** A auditoria sai só quando alguma chave muda. */
    @Transactional
    public ConfiguracaoResponse alterar(UsuarioAutenticado eu, ConfiguracaoRequest r) {
        Consultoria c = consultorias.travar(eu.consultoriaId()).orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
        boolean publicam = r.alunosPublicam();
        boolean anexam = r.alunosAnexamFotos();
        if (publicam != c.isComunidadeAlunosPublicam() || anexam != c.isComunidadeAlunosAnexamFotos()) {
            c.definirChavesDaComunidade(publicam, anexam);
            consultorias.saveAndFlush(c);
            auditoria.registrarEvento("COMUNIDADE_CONFIGURACAO_ALTERADA", "CONSULTORIA", c.getId(), RESUMO_ALTERADA);
        }
        return new ConfiguracaoResponse(publicam, anexam);
    }

    /** Sempre o aluno da sessão. */
    @Transactional(readOnly = true)
    public ConfiguracaoDoAluno doAluno(UsuarioAutenticado eu) {
        Aluno aluno = alunos.findById(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        Consultoria c = consultoria(eu);
        return new ConfiguracaoDoAluno(c.isComunidadeAlunosPublicam(), podeAnexarFoto(c, aluno));
    }

    /** 403 {@code PUBLICACAO_DESLIGADA} se o treinador desligou a publicação dos alunos. */
    @Transactional(readOnly = true)
    public void exigirQueAlunosPublicam(UsuarioAutenticado eu) {
        if (!consultoria(eu).isComunidadeAlunosPublicam()) {
            throw ComunidadeException.publicacaoDesligada();
        }
    }

    /** 403 {@code FOTO_NAO_PERMITIDA} sem a chave ligada, sem data de nascimento ou com menos de 18 anos. */
    @Transactional(readOnly = true)
    public void exigirQuePodeAnexarFoto(UsuarioAutenticado eu, Aluno aluno) {
        if (!podeAnexarFoto(consultoria(eu), aluno)) {
            throw ComunidadeException.fotoNaoPermitida();
        }
    }

    private static boolean podeAnexarFoto(Consultoria c, Aluno aluno) {
        return c.isComunidadeAlunosAnexamFotos()
                && RegrasDoPerfil.maiorDeIdade(aluno.getDataNascimento(), LocalDate.now(Fuso.BRASILIA));
    }

    private Consultoria consultoria(UsuarioAutenticado eu) {
        return consultorias.findById(eu.consultoriaId()).orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
    }
}
