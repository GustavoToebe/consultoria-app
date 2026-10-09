package br.com.treinos.api.auth;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.dto.EuResponse;
import br.com.treinos.api.auth.dto.UsuarioResumo;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.consultoria.MarcaPublica;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.security.JwtService;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.NaoAutorizadoException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class AuthService {

    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    private final AlunoRepository alunos;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokens;
    private final br.com.treinos.api.equipe.PerfilRepository perfis;
    private final br.com.treinos.api.equipe.PermissoesDoUsuario permissoes;

    /**
     * Hash de uma senha aleatória, calculado uma vez. Com e-mail inexistente o BCrypt roda contra ele: a resposta
     * leva o mesmo tempo que uma senha errada e não revela quais e-mails têm conta (seção 5.1).
     */
    private final String hashFicticio;

    public AuthService(UsuarioRepository usuarios, ConsultoriaRepository consultorias, AlunoRepository alunos,
                       PasswordEncoder passwordEncoder, JwtService jwtService, RefreshTokenService refreshTokens,br.com.treinos.api.equipe.PerfilRepository perfis,
                       br.com.treinos.api.equipe.PermissoesDoUsuario permissoes) {
        this.perfis=perfis;this.permissoes=permissoes;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
        this.alunos = alunos;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokens = refreshTokens;
        this.hashFicticio = passwordEncoder.encode(OpaqueTokenGenerator.gerar());
    }

    @Transactional
    public Sessao entrar(String email, String senha, DestinoCliente cliente) {
        Usuario usuario = usuarios.buscarPorEmail(Emails.normalizar(email)).orElse(null);
        if (usuario == null) {
            passwordEncoder.matches(senha, hashFicticio);
            throw credenciaisInvalidas();
        }
        if (!passwordEncoder.matches(senha, usuario.getSenhaHash()) || !usuario.isAtivo()) {
            throw credenciaisInvalidas();
        }
        usuario.registrarLogin(Instant.now());
        return sessaoNova(usuario, cliente);
    }

    @Transactional
    public Sessao renovar(String refreshTokenBruto) {
        RefreshTokenService.Rotacao rotacao = refreshTokens.rotacionar(refreshTokenBruto);
        return sessao(rotacao.usuario(), rotacao.refreshTokenBruto());
    }

    @Transactional
    public void sair(String refreshTokenBruto) {
        if (refreshTokenBruto != null && !refreshTokenBruto.isBlank()) {
            refreshTokens.revogar(refreshTokenBruto);
        }
    }

    /** Sessão para um usuário recém-criado (cadastro de treinador, convite aceito) ou que acabou de entrar. */
    @Transactional
    public Sessao sessaoNova(Usuario usuario, DestinoCliente cliente) {
        return sessao(usuario, refreshTokens.emitir(usuario, cliente));
    }

    @Transactional(readOnly = true)
    public EuResponse eu(UsuarioAutenticado autenticado) {
        Usuario usuario = usuarios.findById(autenticado.usuarioId())
                .orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
        EuResponse.AlunoResumo aluno = null;
        if (usuario.getAlunoId() != null) {
            aluno = alunos.findById(usuario.getAlunoId())
                    .map(a -> new EuResponse.AlunoResumo(a.getId(), a.getNome()))
                    .orElse(null);
        }
        var perfil=usuario.getPerfilId()==null ? null : perfis.buscar(usuario.getPerfilId(),usuario.getConsultoriaId())
                .map(p -> new EuResponse.PerfilResumo(p.getId(),p.getNome(),p.isAcessoTotal())).orElse(null);
        return new EuResponse(UsuarioResumo.de(usuario), marca(usuario), aluno,perfil,
                usuario.getPapel()==Papel.TREINADOR ? permissoes.codigos(usuario) : null);
    }

    /**
     * Troca a própria senha: confere a atual, incrementa a versão das credenciais (Bearer antigo recusado na hora),
     * encerra todas as sessões e devolve uma sessão nova para esta continuar aberta.
     */
    @Transactional
    public Sessao trocarSenha(UsuarioAutenticado autenticado, String senhaAtual, String senhaNova,
                              DestinoCliente cliente) {
        Usuario usuario = usuarios.buscarParaAlterar(autenticado.usuarioId())
                .orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
        if (!passwordEncoder.matches(senhaAtual, usuario.getSenhaHash())) {
            throw new BadRequestException("A senha atual não confere.");
        }
        RegrasSenha.validar(senhaNova, usuario.getEmail());
        if (passwordEncoder.matches(senhaNova, usuario.getSenhaHash())) {
            throw new BadRequestException("A nova senha precisa ser diferente da atual.");
        }
        usuario.trocarSenha(passwordEncoder.encode(senhaNova));
        usuarios.saveAndFlush(usuario);
        refreshTokens.encerrarTodas(usuario.getId());
        return sessaoNova(usuario, cliente);
    }

    private Sessao sessao(Usuario usuario, String refreshBruto) {
        return new Sessao(
                jwtService.gerarAccessToken(usuario.getId(), usuario.getCredenciaisVersao(), usuario.getPapel().name()),
                jwtService.expiresInSeconds(),
                refreshBruto,
                UsuarioResumo.de(usuario),
                marca(usuario));
    }

    private MarcaPublica marca(Usuario usuario) {
        return consultorias.findById(usuario.getConsultoriaId())
                .map(MarcaPublica::de)
                .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
    }

    private static NaoAutorizadoException credenciaisInvalidas() {
        return new NaoAutorizadoException("E-mail ou senha inválidos.", "CREDENCIAIS_INVALIDAS");
    }

    public record Sessao(String accessToken, long expiresIn, String refreshTokenBruto, UsuarioResumo usuario,
                         MarcaPublica marca) {
    }
}
