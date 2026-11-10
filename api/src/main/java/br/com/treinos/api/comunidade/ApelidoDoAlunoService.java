package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Apelido do aluno na comunidade (V069, decisões 6 e 7 do plano). O próprio aluno o define ({@code PUT /aluno/comunidade/apelido},
 * sempre o da sessão) e quem tem {@code COMUNIDADE_MODERAR} o limpa. O apelido nunca vai a log, auditoria ou mensagem de erro:
 * as duas ações de auditoria levam resumo fixo e só saem quando o valor muda.
 */
@Service
public class ApelidoDoAlunoService {

    static final int MINIMO = 2;
    static final int MAXIMO = 24;
    /** Letras (com acento, Unicode), números, espaço comum e {@code _ . -}. */
    private static final Pattern FORMATO = Pattern.compile("[\\p{L}\\p{Nd} _.-]+");
    /**
     * Link, em versão simples: "www.", "http" (cobre http:// e https://; "://" nem passa no formato) ou final de endereço com um
     * domínio comum ("site.com", "x.br"). E-mail ("@") também fica de fora pelo formato. Não pega todo endereço possível
     * (shortcut: lista curta de domínios; ampliar se aparecer abuso).
     */
    private static final Pattern LINK = Pattern.compile(
            "www\\.|http|\\.(com|net|org|br|io|gg|me|tv|app|link|dev|xyz|ly|co)(?![\\p{L}\\p{Nd}])", Pattern.CASE_INSENSITIVE);

    /** Preenchimentos Hangul (categoria Lo, não aparecem na tela): o formato os aceitaria como "letra". */
    private static final Pattern INVISIVEL = Pattern.compile("[\\u115F\\u1160\\u3164\\uFFA0]");
    private static final Pattern LETRA_OU_DIGITO = Pattern.compile("[\\p{L}\\p{Nd}]");

    static final String MENSAGEM_FORMATO = "Use de 2 a 24 letras, números, espaço, _ . ou -.";
    static final String MENSAGEM_LINK = "O apelido não pode ser um link.";
    /** Resumos fixos: nunca o apelido, nem o anterior. */
    static final String RESUMO_ALTERADO = "O aluno alterou o apelido na comunidade.";
    static final String RESUMO_REMOVIDO = "A moderação removeu o apelido de um aluno na comunidade.";

    private final AlunoRepository alunos;
    private final Auditoria auditoria;

    public ApelidoDoAlunoService(AlunoRepository alunos, Auditoria auditoria) {
        this.alunos = alunos;
        this.auditoria = auditoria;
    }

    /** O aluno da sessão troca (ou, vazio, apaga) o próprio apelido. Anonimizado = 409; a auditoria sai só quando muda. */
    @Transactional
    public void alterar(UsuarioAutenticado eu, String informado) {
        Aluno aluno = alunos.buscarParaAlterar(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        String novo = normalizar(informado);
        if (!Objects.equals(novo, aluno.getApelido())) {
            aluno.definirApelido(novo);
            auditoria.registrarEvento("ALUNO_APELIDO_ALTERADO", "ALUNO", aluno.getId(), RESUMO_ALTERADO);
        }
    }

    /**
     * Moderação: limpa o apelido do aluno cujo usuário é {@code autorId} (o id que o mural expõe). Idempotente (sem apelido, 204 e
     * nada a auditar); aluno de outra consultoria ou usuário que não é aluno = 404.
     */
    @Transactional
    public void remover(UUID autorId) {
        Aluno aluno = alunos.buscarPorUsuarioParaAlterar(autorId)
                .orElseThrow(() -> new NaoEncontradoException("Perfil não encontrado."));
        if (aluno.getApelido() != null) {
            aluno.definirApelido(null);
            auditoria.registrarEvento("COMUNIDADE_APELIDO_REMOVIDO", "ALUNO", aluno.getId(), RESUMO_REMOVIDO);
        }
    }

    /** Nulo ou vazio = sem apelido (apaga). Senão 2 a 24 caracteres depois do strip; fora da regra, 422 {@code APELIDO_INVALIDO} no campo. */
    static String normalizar(String informado) {
        if (informado == null || informado.isBlank()) {
            return null;
        }
        // O corte antes do Normalizer evita processar corpo enorme; o tamanho de verdade é conferido depois.
        if (informado.length() > 4 * MAXIMO) {
            throw invalido(MENSAGEM_FORMATO);
        }
        String limpo = Normalizer.normalize(informado, Normalizer.Form.NFC).strip();
        int tamanho = limpo.codePointCount(0, limpo.length());
        if (tamanho < MINIMO || tamanho > MAXIMO || !FORMATO.matcher(limpo).matches()
                || INVISIVEL.matcher(limpo).find() || !LETRA_OU_DIGITO.matcher(limpo).find()) {
            throw invalido(MENSAGEM_FORMATO);
        }
        // NFKC só para conferir o link: "ｗｗｗ.site.ｃｏｍ" (largura total) e letras matemáticas viram ASCII; grava o NFC.
        String paraLink = Normalizer.normalize(limpo, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
        if (LINK.matcher(paraLink).find()) {
            throw invalido(MENSAGEM_LINK);
        }
        return limpo;
    }

    private static ValidacaoException invalido(String mensagem) {
        return new ValidacaoException("Confira o apelido.", "APELIDO_INVALIDO",
                List.of(new ApiError.FieldError("apelido", mensagem)));
    }
}
