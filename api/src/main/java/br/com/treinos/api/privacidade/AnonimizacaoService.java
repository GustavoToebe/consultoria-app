package br.com.treinos.api.privacidade;

import br.com.treinos.api.inscricoes.InscricaoDoAluno;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.auditoria.Auditar;
import br.com.plataforma.comum.auth.Autenticador;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.dieta.PlanoDietaVersaoRepository;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.alunos.FotoPerfilService;
import br.com.treinos.api.fotos.FotoService;
import br.com.treinos.api.lesoes.LesaoRepository;
import br.com.treinos.api.privacidade.PrivacidadeDtos.AnonimizarRequest;
import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Anonimização do aluno que saiu (LGPD). Só aluno já inativo; o servidor confere o nome digitado. Apaga o que é pessoal
 * ou sensível (peso, lesões, respostas e feedback das atualizações, respostas das anamneses, observações das séries, dieta inteira, nome, e-mail,
 * senha, convite, sessões e a inscrição pelo link que virou o aluno) e mantém pastas, treinos e registros (carga e repetições) para as contagens. Sem volta:
 * o cadastro anonimizado não é editado nem reativado. Nada disso vai a log ou à auditoria, que grava um resumo fixo.
 */
@Service
public class AnonimizacaoService {

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final Autenticador autenticador;
    private final PasswordEncoder senhas;
    private final RegistroPesoRepository pesos;
    private final LesaoRepository lesoes;
    private final AtualizacaoRepository atualizacoes;
    private final PlanoDietaRepository dietas;
    private final PlanoDietaVersaoRepository versoesDeDieta;
    private final AnonimizacaoRepositorio nativo;
    private final FotoService fotos;
    private final FotoPerfilService fotoPerfil;
    private final InscricaoDoAluno inscricao;
    private final br.com.treinos.api.anamneses.AnamneseService anamneses;

    public AnonimizacaoService(AlunoRepository alunos, UsuarioRepository usuarios, Autenticador autenticador,
                               PasswordEncoder senhas, RegistroPesoRepository pesos,
                               LesaoRepository lesoes, AtualizacaoRepository atualizacoes, PlanoDietaRepository dietas,
                               PlanoDietaVersaoRepository versoesDeDieta, AnonimizacaoRepositorio nativo,
                               FotoService fotos, FotoPerfilService fotoPerfil, InscricaoDoAluno inscricao,
                               br.com.treinos.api.anamneses.AnamneseService anamneses) {
        this.anamneses = anamneses;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.autenticador = autenticador;
        this.senhas = senhas;
        this.pesos = pesos;
        this.lesoes = lesoes;
        this.atualizacoes = atualizacoes;
        this.dietas = dietas;
        this.versoesDeDieta = versoesDeDieta;
        this.nativo = nativo;
        this.fotos = fotos;
        this.fotoPerfil = fotoPerfil;
        this.inscricao = inscricao;
    }

    @Transactional
    @Auditar(acao = "ALUNO_ANONIMIZADO", entidade = "ALUNO", resumo = "Anonimizou o cadastro de um aluno.")
    public AlunoDetalhe anonimizar(UUID alunoId, AnonimizarRequest r) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (aluno.isAnonimizado()) {
            throw new ConflictException("Este aluno já foi anonimizado.", "ALUNO_ANONIMIZADO");
        }
        if (aluno.isAtivo()) {
            throw new ConflictException("Inative o aluno antes de anonimizar.", "ALUNO_ATIVO");
        }
        if (!igual(aluno.getNome(), r.nomeConfirmado())) {
            throw new ValidacaoException("O nome digitado não confere com o do aluno.", "NOME_NAO_CONFERE",
                    List.of(new ApiError.FieldError("nomeConfirmado", "Digite o nome do aluno exatamente como está no cadastro.")));
        }
        UUID consultoriaId = aluno.getConsultoriaId();

        // Dado sensível: apaga as linhas (entidades normais) e limpa o texto livre das imutáveis por SQL nativo.
        pesos.deleteAll(pesos.findByAlunoIdOrderByDataAsc(alunoId));
        lesoes.deleteAll(lesoes.findByAlunoIdOrderByDataInicioDescCriadoEmDesc(alunoId));
        atualizacoes.findByAlunoIdOrderByDataAtualizacaoDesc(alunoId).forEach(a -> a.limparDadosPessoais());
        anamneses.anonimizarDoAluno(alunoId);
        for (var plano : dietas.findByAlunoIdOrderByCriadoEmDesc(alunoId)) {
            versoesDeDieta.deleteAll(versoesDeDieta.findByPlanoIdOrderByNumeroAsc(plano.getId()));
        }
        versoesDeDieta.flush();
        dietas.deleteAll(dietas.findByAlunoIdOrderByCriadoEmDesc(alunoId));
        dietas.flush();
        // Fotos de corpo: saem do ar na hora e o bucket é esvaziado pela fila de remoção (HTTP fora desta transação).
        fotos.removerTodasDoAluno(alunoId);
        fotoPerfil.removerDoAluno(alunoId);
        // A inscrição pelo link que virou este aluno (nome, contato, objetivo e notas) sai inteira.
        inscricao.apagarDoAluno(alunoId);
        nativo.apagarObservacoesDasExecucoes(consultoriaId, alunoId);
        nativo.apagarNomesDosTitulos(consultoriaId, alunoId);
        nativo.apagarTextoLivreDosPlanos(consultoriaId, alunoId);

        if (aluno.getUsuarioId() != null) {
            usuarios.buscarParaAlterar(aluno.getUsuarioId()).ifPresent(u -> {
                u.anonimizar(Aluno.NOME_ANONIMIZADO, "anonimizado+" + u.getId() + "@anonimizado.invalid",
                        senhas.encode(segredoAleatorio()));
            });
            autenticador.encerrarSessoes(aluno.getUsuarioId().toString());
        }
        aluno.anonimizar(Instant.now());
        return AlunoDetalhe.de(alunos.saveAndFlush(aluno));
    }

    private static boolean igual(String nome, String digitado) {
        return nome.strip().equalsIgnoreCase(digitado == null ? "" : digitado.strip());
    }

    private static String segredoAleatorio() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
