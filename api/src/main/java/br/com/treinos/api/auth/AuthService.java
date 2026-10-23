package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.Autenticador;
import br.com.plataforma.comum.seguranca.login.LimiteLogin;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ForbiddenException;
import br.com.plataforma.comum.web.UnauthorizedException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.dto.EuResponse;
import br.com.treinos.api.auth.dto.UsuarioResumo;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.consultoria.MarcaPublica;
import br.com.treinos.api.integracao.AcessoPorDireitos;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.termos.Termos;
import br.com.treinos.api.termos.TermosService;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.NaoEncontradoException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;
import java.util.UUID;

/**
 * Login, renovação, logout e troca de senha. O fluxo de sessão (limite de tentativas, senha, segundo fator, tokens e rotação do
 * refresh) é do {@link Autenticador} da plataforma; aqui ficam o e-mail normalizado, a consultoria suspensa pela Central e os
 * dados da tela. {@code entrar} e {@code renovar} <b>não</b> rodam dentro de transação: o módulo revoga as sessões em transação
 * própria quando detecta o reuso de um refresh.
 */
@Service
public class AuthService {

    private static final String SESSAO_INVALIDA = "Sessão inválida ou expirada. Entre de novo.";
    static final String TROCA_DE_SENHA_NECESSARIA = "TROCA_DE_SENHA_NECESSARIA";

    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    private final AlunoRepository alunos;
    private final PasswordEncoder passwordEncoder;
    private final Autenticador autenticador;
    private final br.com.treinos.api.equipe.PerfilRepository perfis;
    private final br.com.treinos.api.equipe.PermissoesDoUsuario permissoes;
    private final AcessoPorDireitos acesso;
    private final TermosService termos;
    private final AberturaDeSessao abertura;
    private final br.com.treinos.api.conta.PlanoDaConsultoria plano;
    private final LimiteLogin limite;
    private final Auditoria auditoria;
    private final br.com.treinos.api.pagamentos.PagamentosProperties pagamentos;
    private final br.com.treinos.api.pagamentos.InfinitePayProperties infinitePay;
    private final TransactionTemplate transacao;
    private final TransactionTemplate leitura;

    public AuthService(UsuarioRepository usuarios, ConsultoriaRepository consultorias, AlunoRepository alunos,
                       PasswordEncoder passwordEncoder, Autenticador autenticador,
                       br.com.treinos.api.equipe.PerfilRepository perfis,
                       br.com.treinos.api.equipe.PermissoesDoUsuario permissoes, AcessoPorDireitos acesso,
                       TermosService termos, AberturaDeSessao abertura, PlatformTransactionManager transacoes,
                       br.com.treinos.api.conta.PlanoDaConsultoria plano, LimiteLogin limite, Auditoria auditoria,
                       br.com.treinos.api.pagamentos.PagamentosProperties pagamentos,
                       br.com.treinos.api.pagamentos.InfinitePayProperties infinitePay) {
        this.pagamentos = pagamentos;
        this.infinitePay = infinitePay;
        this.plano = plano;
        this.limite = limite;
        this.auditoria = auditoria;
        this.abertura = abertura;
        this.perfis = perfis;
        this.permissoes = permissoes;
        this.acesso = acesso;
        this.termos = termos;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
        this.alunos = alunos;
        this.passwordEncoder = passwordEncoder;
        this.autenticador = autenticador;
        this.transacao = new TransactionTemplate(transacoes);
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
    }

    /**
     * Com a senha provisória do treinador ({@code trocarSenha}), a sessão só abre quando vem {@code novaSenha}: sem ela,
     * 401 {@code TROCA_DE_SENHA_NECESSARIA} (nenhuma sessão, nenhum registro de login). Sem a marca, {@code novaSenha} é ignorada.
     */
    public Sessao entrar(String email, String senha, String codigoMfa, String novaSenha, String ip) {
        Autenticador.Identidade identidade;
        try {
            identidade = autenticador.verificarCredenciais(Emails.normalizar(email), senha, codigoMfa, ip);
        } catch (UnauthorizedException recusado) {
            throw credenciaisInvalidas();
        }
        Usuario usuario = carregar(identidade.sujeito());
        liberarAcesso(usuario);
        long versao = identidade.versao();
        if (usuario.isTrocarSenha()) {
            if (novaSenha == null || novaSenha.isEmpty()) {
                throw new UnauthorizedException("Crie a sua senha para entrar.", TROCA_DE_SENHA_NECESSARIA);
            }
            versao = trocarSenhaProvisoria(usuario.getId(), senha, novaSenha);
        }
        Usuario registrado = abertura.entrou(usuario.getId());
        return montar(registrado, autenticador.novaSessao(identidade.sujeito(), versao, ip));
    }

    /**
     * Primeiro acesso: troca a senha provisória pela do aluno e devolve a versão nova das credenciais (a da identidade
     * ficou velha). Com o usuário travado confere de novo a marca e a senha: se o treinador definiu outra no meio, recusa.
     */
    private long trocarSenhaProvisoria(UUID usuarioId, String provisoria, String novaSenha) {
        return transacao.execute(status -> {
            Usuario usuario = usuarios.buscarParaAlterar(usuarioId).orElseThrow(AuthService::credenciaisInvalidas);
            if (!usuario.isTrocarSenha() || !passwordEncoder.matches(provisoria, usuario.getSenhaHash())) {
                throw credenciaisInvalidas();
            }
            RegrasSenha.validar(novaSenha, usuario.getEmail());
            if (passwordEncoder.matches(novaSenha, usuario.getSenhaHash())) {
                throw new BadRequestException("A nova senha precisa ser diferente da que o treinador passou.");
            }
            usuario.trocarSenha(passwordEncoder.encode(novaSenha));
            usuarios.saveAndFlush(usuario);
            auditoria.senhaDoPrimeiroAcesso(usuario);
            return usuario.getCredenciaisVersao();
        });
    }

    public Sessao renovar(String refreshTokenBruto, String ip) {
        // A conferência da consultoria roda dentro da rotação: se ela recusar, o refresh antigo continua valendo.
        Autenticador.Sessao sessao = autenticador.renovar(refreshTokenBruto, ip, sujeito -> {
            Usuario usuario = carregar(sujeito);
            if (usuario.isTrocarSenha()) { // não deveria acontecer: definir a senha provisória já encerra as sessões
                throw new UnauthorizedException(SESSAO_INVALIDA);
            }
            liberarAcesso(usuario);
            return Map.of();
        });
        return montar(carregar(sessao.sujeito()), sessao);
    }

    public void sair(String refreshTokenBruto) {
        if (refreshTokenBruto != null && !refreshTokenBruto.isBlank()) {
            autenticador.sair(refreshTokenBruto);
        }
    }

    /** Sessão para um usuário recém-criado (cadastro de treinador, convite aceito). */
    public Sessao sessaoNova(Usuario usuario) {
        liberarAcesso(usuario);
        abertura.abriu(usuario);
        return montar(usuario, autenticador.novaSessao(usuario.getId().toString(), usuario.getCredenciaisVersao(), ipAtual()));
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
        var perfil = usuario.getPerfilId() == null ? null : perfis.buscar(usuario.getPerfilId(), usuario.getConsultoriaId())
                .map(p -> new EuResponse.PerfilResumo(p.getId(), p.getNome(), p.isAcessoTotal())).orElse(null);
        return new EuResponse(UsuarioResumo.de(usuario), marca(usuario), aluno, perfil,
                usuario.getPapel() == Papel.TREINADOR ? permissoes.codigos(usuario) : null,
                termos.pendente(usuario.getId()), Termos.VERSAO,
                plano.funcionalidadesLiberadas(usuario.getConsultoriaId()), pagamentos.habilitado(),
                pagamentos.habilitado() && infinitePay.habilitado(), pagamentos.pagarNoIos(), pagamentos.pagarNoAndroid());
    }

    /**
     * Cada troca de senha própria passa pelo mesmo limite do login (IP e conta), como o MFA: sem isso quem tem a sessão
     * poderia adivinhar a senha atual sem freio. Lança {@code LimiteLoginException} (429); a biblioteca não tem "limpar".
     */
    public void limitarTrocaDeSenha(UUID usuarioId, String ip) {
        String email = usuarios.findById(usuarioId).map(u -> Emails.normalizar(u.getEmail())).orElse(null);
        limite.registrar(ip, email);
    }

    /**
     * Troca a própria senha: confere a atual, incrementa a versão das credenciais (Bearer antigo recusado na hora),
     * encerra todas as sessões e devolve uma sessão nova para esta continuar aberta.
     */
    public Sessao trocarSenha(UsuarioAutenticado autenticado, String senhaAtual, String senhaNova, String ip) {
        long versao = transacao.execute(status -> {
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
            if (usuario.getConsultoriaId() != null) {
                auditoria.registrarEvento("SENHA_ALTERADA", "USUARIO", usuario.getId(), "Trocou a própria senha.");
            }
            return usuario.getCredenciaisVersao();
        });
        return reabrirSessao(autenticado.usuarioId(), versao, ip);
    }

    /**
     * Depois de a versão das credenciais subir (troca de senha, ativação ou desativação do MFA): encerra as demais sessões do
     * usuário e abre uma nova para quem fez a troca continuar.
     */
    public Sessao reabrirSessao(UUID usuarioId, long versao, String ip) {
        String sujeito = usuarioId.toString();
        autenticador.encerrarSessoes(sujeito);
        return montar(carregar(sujeito), autenticador.novaSessao(sujeito, versao, ip));
    }

    private Usuario carregar(String sujeito) {
        try {
            return usuarios.findById(UUID.fromString(sujeito)).filter(Usuario::isAtivo)
                    .orElseThrow(() -> new UnauthorizedException(SESSAO_INVALIDA));
        } catch (IllegalArgumentException semUuid) {
            throw new UnauthorizedException(SESSAO_INVALIDA);
        }
    }

    /** Todo caminho que abre sessão (login, renovação, convite aceito) passa por aqui: consultoria suspensa não entra. */
    private void liberarAcesso(Usuario usuario) {
        var decisao = acesso.decidir(usuario.getConsultoriaId());
        if (!decisao.liberado()) {
            throw new ForbiddenException(decisao.motivo(), "ACESSO_BLOQUEADO");
        }
    }

    private Sessao montar(Usuario usuario, Autenticador.Sessao sessao) {
        return leitura.execute(status -> new Sessao(sessao.accessToken(), sessao.expiraEmSegundos(), sessao.refreshToken(),
                UsuarioResumo.de(usuario), marca(usuario)));
    }

    private MarcaPublica marca(Usuario usuario) {
        return consultorias.findById(usuario.getConsultoriaId())
                .map(MarcaPublica::de)
                .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
    }

    private static String ipAtual() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes atributos) {
            HttpServletRequest requisicao = atributos.getRequest();
            return requisicao.getRemoteAddr();
        }
        return null;
    }

    private static UnauthorizedException credenciaisInvalidas() {
        return new UnauthorizedException("E-mail ou senha inválidos.", "CREDENCIAIS_INVALIDAS");
    }

    public record Sessao(String accessToken, long expiresIn, String refreshTokenBruto, UsuarioResumo usuario,
                         MarcaPublica marca) {
    }
}
