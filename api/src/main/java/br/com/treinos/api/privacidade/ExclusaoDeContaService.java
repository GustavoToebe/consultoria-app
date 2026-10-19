package br.com.treinos.api.privacidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.AuthService;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.privacidade.PrivacidadeDtos.ExcluirContaRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * "Excluir minha conta" feito pelo próprio aluno, dentro do app (diretriz 5.1.1(v) da App Store; direito de eliminação da
 * LGPD). O efeito é a mesma anonimização que o treinador faz ({@link AnonimizacaoService}): o treino e as cargas ficam
 * para a consultoria, sem o nome; peso, dieta, respostas, fotos, nome, e-mail e senha saem. Sem volta.
 * <p>
 * A ordem importa: primeiro o "EXCLUIR" (barato, não conta tentativa), depois o limite de tentativas da troca de senha
 * ({@link AuthService#limitarTrocaDeSenha}: sem ele, quem pega o celular desbloqueado poderia adivinhar a senha) e só
 * então a transação. O limite fica <b>fora</b> dela: a senha errada desfaz a transação, e a tentativa precisa continuar
 * contada. Dentro dela: senha, anonimização, sessões encerradas e a auditoria {@code ALUNO_EXCLUIU_CONTA} (o ator é o
 * próprio aluno, com resumo fixo), tudo ou nada.
 */
@Service
public class ExclusaoDeContaService {

    /** Texto que o aluno digita para confirmar. Igual a {@code dominio/excluirConta.ts} no app. */
    public static final String CONFIRMACAO = "EXCLUIR";

    private final AnonimizacaoService anonimizacao;
    private final AuthService auth;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;
    private final Auditoria auditoria;
    private final TransactionTemplate transacao;

    public ExclusaoDeContaService(AnonimizacaoService anonimizacao, AuthService auth, UsuarioRepository usuarios,
                                  PasswordEncoder senhas, Auditoria auditoria, PlatformTransactionManager transacoes) {
        this.anonimizacao = anonimizacao;
        this.auth = auth;
        this.usuarios = usuarios;
        this.senhas = senhas;
        this.auditoria = auditoria;
        this.transacao = new TransactionTemplate(transacoes);
    }

    /** Lança {@code LimiteLoginException} (429) quando a conta ou o IP passou do limite; o controller põe o Retry-After. */
    public void excluir(UsuarioAutenticado eu, ExcluirContaRequest r, String ip) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        if (!confirmou(r.confirmacao())) {
            throw new ValidacaoException("Digite EXCLUIR para confirmar.", "CONFIRMACAO_INVALIDA",
                    List.of(new ApiError.FieldError("confirmacao", "Digite EXCLUIR para confirmar.")));
        }
        auth.limitarTrocaDeSenha(eu.usuarioId(), ip);
        transacao.executeWithoutResult(status -> {
            // Sem trava aqui: a anonimização trava o aluno e depois o usuário, a mesma ordem do caminho do treinador.
            var usuario = usuarios.findById(eu.usuarioId()).orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
            if (!senhas.matches(r.senha(), usuario.getSenhaHash())) {
                throw new BadRequestException("A senha não confere.", "SENHA_INCORRETA");
            }
            anonimizacao.anonimizarPeloProprioAluno(alunoId);
            auditoria.registrarEvento("ALUNO_EXCLUIU_CONTA", "ALUNO", alunoId, "O aluno excluiu a própria conta pelo app.");
        });
    }

    /** Sem diferença de maiúsculas nem espaços nas pontas: o que importa é a pessoa ter digitado a palavra. */
    static boolean confirmou(String digitado) {
        return digitado != null && digitado.strip().toUpperCase(Locale.ROOT).equals(CONFIRMACAO);
    }
}
